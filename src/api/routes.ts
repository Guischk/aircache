/**
 * Routes API pour accéder aux données cachées d'Airtable
 */

import { redisService } from "../lib/redis/index";
import { getActiveNamespace, keyRecord, keyIndex } from "../lib/redis/helpers";
import { normalizeForRedis } from "../lib/utils/index";
import { AIRTABLE_TABLE_NAMES } from "../lib/airtable/schema";
import { requireAuth, logAuthAttempt, isAuthenticated } from "./auth";
import type {
  ApiResponse,
  HealthInfo,
  CacheStats,
  TablesListResponse,
  TableRecordsResponse,
  RecordResponse,
  QueryParams,
  BenchmarkResponse,
  BenchmarkResult
} from "./types";

/**
 * Utilitaires pour les réponses API
 */
function createSuccessResponse<T>(data: T, meta?: any): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

function createErrorResponse(error: string, message: string, code: string = "INTERNAL_ERROR"): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      message,
      code,
      meta: {
        timestamp: new Date().toISOString()
      }
    }),
    {
      status: code === "NOT_FOUND" ? 404 : code === "BAD_REQUEST" ? 400 : 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}

function createJsonResponse<T>(data: ApiResponse<T>, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "X-Cache-Namespace": data.meta?.namespace || "unknown",
      "X-Cache-Timestamp": data.meta?.timestamp || new Date().toISOString(),
      "Cache-Control": "public, max-age=30"
    }
  });
}

/**
 * Health check endpoint (pas d'auth requise)
 */
export async function handleHealth(request: Request): Promise<Response> {
  try {
    const startTime = Date.now();

    // Test Redis
    const redisHealthy = await redisService.healthCheck();

    const healthInfo: HealthInfo = {
      status: redisHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        redis: redisHealthy,
        worker: true // Simplifié pour MVP
      }
    };

    const response = createSuccessResponse(healthInfo);

    console.log(`🩺 Health check - ${Date.now() - startTime}ms - Status: ${healthInfo.status}`);

    return createJsonResponse(response, redisHealthy ? 200 : 503);

  } catch (error) {
    console.error("❌ Health check failed:", error);
    return createErrorResponse(
      "Health check failed",
      "Unable to check system health",
      "HEALTH_CHECK_FAILED"
    );
  }
}

/**
 * Liste des tables disponibles
 */
export async function handleTables(request: Request): Promise<Response> {
  // Vérification auth
  const authError = requireAuth(request);
  if (authError) {
    logAuthAttempt(request, false);
    return authError;
  }

  logAuthAttempt(request, true);

  try {
    const namespace = await getActiveNamespace();

    const response: TablesListResponse = {
      tables: [...AIRTABLE_TABLE_NAMES], // Convert readonly array to mutable
      namespace,
      total: AIRTABLE_TABLE_NAMES.length
    };

    console.log(`📋 Tables list requested - ${AIRTABLE_TABLE_NAMES.length} tables`);

    return createJsonResponse(
      createSuccessResponse(response, { namespace })
    );

  } catch (error) {
    console.error("❌ Error fetching tables:", error);
    return createErrorResponse(
      "Failed to fetch tables",
      "Unable to retrieve table list",
      "TABLES_FETCH_FAILED"
    );
  }
}

/**
 * Records d'une table spécifique
 */
export async function handleTableRecords(request: Request, tableName: string): Promise<Response> {
  // Vérification auth
  const authError = requireAuth(request);
  if (authError) {
    logAuthAttempt(request, false);
    return authError;
  }

  logAuthAttempt(request, true);

  try {
    // Vérifier que la table existe
    if (!AIRTABLE_TABLE_NAMES.includes(tableName as any)) {
      return createErrorResponse(
        "Table not found",
        `Table '${tableName}' does not exist`,
        "NOT_FOUND"
      );
    }

    const namespace = await getActiveNamespace();
    const normalizedTableName = normalizeForRedis(tableName);

    // Pagination et filtrage des champs
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const fieldsParam = url.searchParams.get("fields");

    const DEFAULT_LIMIT = parseInt(process.env.API_DEFAULT_LIMIT || "200");
    const limit = Math.max(0, Math.min(1000, limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT));
    const offset = Math.max(0, offsetParam ? parseInt(offsetParam, 10) : 0);
    const fields = fieldsParam ? fieldsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

    // Utiliser l'index d'IDs et MGET pour des performances optimales
    const indexKey = keyIndex(namespace, normalizedTableName);
    // Récupère les IDs, trie pour déterminisme puis applique la pagination
    const ids = await redisService.smembers(indexKey);
    ids.sort();
    const totalAvailable = ids.length;

    const selectedIds = limit > 0 ? ids.slice(offset, offset + limit) : ids;
    const recordKeys = selectedIds.map((id) => keyRecord(namespace, normalizedTableName, id));

    const values = recordKeys.length > 0 ? await redisService.mget(recordKeys) : [];
    const records = [] as any[];
    for (const value of values) {
      if (!value) continue;
      try {
        const parsed = JSON.parse(value);
        if (fields && fields.length > 0) {
          const projected: Record<string, any> = {};
          for (const f of fields) {
            if (Object.prototype.hasOwnProperty.call(parsed, f)) projected[f] = parsed[f];
          }
          // Toujours renvoyer l'identifiant
          if (parsed.record_id && projected.record_id === undefined) projected.record_id = parsed.record_id;
          records.push(projected);
        } else {
          records.push(parsed);
        }
      } catch (parseError) {
        // ignorer les items invalides
      }
    }

    const response: TableRecordsResponse = {
      records,
      table: tableName,
      namespace,
      total: totalAvailable,
      limit: limit > 0 ? limit : undefined,
      offset: offset || undefined
    };

    console.log(`📊 Table '${tableName}' requested - ${records.length} records`);

    return createJsonResponse(
      createSuccessResponse(response, { namespace })
    );

  } catch (error) {
    console.error(`❌ Error fetching records for table '${tableName}':`, error);
    return createErrorResponse(
      "Failed to fetch table records",
      `Unable to retrieve records for table '${tableName}'`,
      "RECORDS_FETCH_FAILED"
    );
  }
}

/**
 * Record spécifique par ID
 */
export async function handleSingleRecord(request: Request, tableName: string, recordId: string): Promise<Response> {
  // Vérification auth
  const authError = requireAuth(request);
  if (authError) {
    logAuthAttempt(request, false);
    return authError;
  }

  logAuthAttempt(request, true);

  try {
    // Vérifier que la table existe
    if (!AIRTABLE_TABLE_NAMES.includes(tableName as any)) {
      return createErrorResponse(
        "Table not found",
        `Table '${tableName}' does not exist`,
        "NOT_FOUND"
      );
    }

    const namespace = await getActiveNamespace();
    const normalizedTableName = normalizeForRedis(tableName);
    const key = keyRecord(namespace, normalizedTableName, recordId);

    // Filtrage des champs optionnel
    const url = new URL(request.url);
    const fieldsParam = url.searchParams.get("fields");
    const fields = fieldsParam ? fieldsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

    const recordData = await redisService.get(key);

    if (!recordData) {
      return createErrorResponse(
        "Record not found",
        `Record '${recordId}' not found in table '${tableName}'`,
        "NOT_FOUND"
      );
    }

    const parsed = JSON.parse(recordData);
    const record = (() => {
      if (!fields || fields.length === 0) return parsed;
      const projected: Record<string, any> = {};
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(parsed, f)) projected[f] = parsed[f];
      }
      if (parsed.record_id && projected.record_id === undefined) projected.record_id = parsed.record_id;
      return projected;
    })();

    const response: RecordResponse = {
      record,
      table: tableName,
      recordId,
      namespace
    };

    console.log(`🔍 Record '${recordId}' from table '${tableName}' requested`);

    return createJsonResponse(
      createSuccessResponse(response, { namespace })
    );

  } catch (error) {
    console.error(`❌ Error fetching record '${recordId}' from table '${tableName}':`, error);
    return createErrorResponse(
      "Failed to fetch record",
      `Unable to retrieve record '${recordId}' from table '${tableName}'`,
      "RECORD_FETCH_FAILED"
    );
  }
}

/**
 * Statistiques du cache
 */
export async function handleStats(request: Request): Promise<Response> {
  // Vérification auth
  const authError = requireAuth(request);
  if (authError) {
    logAuthAttempt(request, false);
    return authError;
  }

  logAuthAttempt(request, true);

  try {
    const namespace = await getActiveNamespace();

    // Compter les records par table
    const tableStats = [];
    let totalRecords = 0;

    // Paralleliser le comptage pour réduire la latence
    const counts = await Promise.all(
      AIRTABLE_TABLE_NAMES.map(async (t) => {
        const normalizedTableName = normalizeForRedis(t);
        const indexKey = keyIndex(namespace, normalizedTableName);
        const count = await redisService.scard(indexKey);
        return { name: t, count };
      })
    );

    for (const { name, count } of counts) {
      tableStats.push({ name, recordCount: count });
      totalRecords += count;
    }

    const stats: CacheStats = {
      activeNamespace: namespace,
      totalTables: AIRTABLE_TABLE_NAMES.length,
      totalRecords,
      tables: tableStats
    };

    console.log(`📈 Stats requested - ${totalRecords} records across ${AIRTABLE_TABLE_NAMES.length} tables`);

    return createJsonResponse(
      createSuccessResponse(stats, { namespace })
    );

  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    return createErrorResponse(
      "Failed to fetch stats",
      "Unable to retrieve cache statistics",
      "STATS_FETCH_FAILED"
    );
  }
}

/**
 * Benchmark de performance pour la production
 */
export async function handleBenchmark(request: Request): Promise<Response> {
  // Vérification auth
  const authError = requireAuth(request);
  if (authError) {
    logAuthAttempt(request, false);
    return authError;
  }

  logAuthAttempt(request, true);

  try {
    const url = new URL(request.url);
    const benchmarkType = url.searchParams.get("type") || "performance";
    const requests = parseInt(url.searchParams.get("requests") || "100");
    const concurrent = parseInt(url.searchParams.get("concurrent") || "10");
    const tableName = url.searchParams.get("table") || AIRTABLE_TABLE_NAMES[0];

    console.log(`🏁 Starting benchmark: ${benchmarkType} (${requests} requests, ${concurrent} concurrent)`);

    const startTime = Date.now();
    const results: BenchmarkResult[] = [];

    // Benchmark des endpoints disponibles
    const endpoints = [
      { path: "/health", auth: false, name: "Health Check" },
      { path: "/api/tables", auth: true, name: "Tables List" },
      { path: "/api/stats", auth: true, name: "Cache Stats" },
      { path: `/api/tables/${encodeURIComponent(tableName)}`, auth: true, name: `Table Records (${tableName})` }
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await runBenchmarkTest(endpoint.path, {
          requests: Math.min(requests, endpoint.auth ? 50 : 200), // Limiter selon l'endpoint
          concurrent: Math.min(concurrent, endpoint.auth ? 5 : 20),
          withAuth: endpoint.auth
        });
        
        results.push({
          endpoint: endpoint.path,
          name: endpoint.name,
          ...result
        });

        // Pause entre les tests pour éviter la surcharge
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Benchmark failed for ${endpoint.path}:`, error);
        results.push({
          endpoint: endpoint.path,
          name: endpoint.name,
          requests: 0,
          successCount: 0,
          errorCount: 1,
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          p95ResponseTime: 0,
          requestsPerSecond: 0,
          errors: [error instanceof Error ? error.message : String(error)]
        });
      }
    }

    const totalTime = Date.now() - startTime;
    const totalRequests = results.reduce((sum, r) => sum + r.requests, 0);
    const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);

    const benchmarkResponse: BenchmarkResponse = {
      type: benchmarkType,
      totalTime,
      totalRequests,
      totalSuccess,
      totalErrors,
      successRate: totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0,
      results,
      config: {
        requests,
        concurrent,
        tableName,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`✅ Benchmark completed in ${totalTime}ms - ${totalSuccess}/${totalRequests} successful (${benchmarkResponse.successRate.toFixed(1)}%)`);

    return createJsonResponse(
      createSuccessResponse(benchmarkResponse, { 
        namespace: await getActiveNamespace(),
        benchmarkType,
        totalTime 
      })
    );

  } catch (error) {
    console.error("❌ Error running benchmark:", error);
    return createErrorResponse(
      "Benchmark failed",
      "Unable to execute performance benchmark",
      "BENCHMARK_FAILED"
    );
  }
}

/**
 * Exécute un test de benchmark sur un endpoint spécifique
 */
async function runBenchmarkTest(
  endpoint: string, 
  options: { requests: number; concurrent: number; withAuth: boolean }
): Promise<Omit<BenchmarkResult, 'endpoint' | 'name'>> {
  const { requests, concurrent, withAuth } = options;
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const fullUrl = `${baseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {};
  if (withAuth && process.env.BEARER_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.BEARER_TOKEN}`;
  }

  const responseTimes: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Créer des batches de requêtes concurrentes
  const batches = Math.ceil(requests / concurrent);
  const startTime = Date.now();

  for (let batch = 0; batch < batches; batch++) {
    const batchPromises = [];
    const batchSize = Math.min(concurrent, requests - (batch * concurrent));

    for (let i = 0; i < batchSize; i++) {
      batchPromises.push(
        fetch(fullUrl, { headers })
          .then(async (response) => {
            const requestTime = Date.now();
            const responseTime = requestTime - startTime;
            
            if (response.ok) {
              successCount++;
              responseTimes.push(responseTime);
            } else {
              errorCount++;
              errors.push(`HTTP ${response.status}: ${response.statusText}`);
            }
          })
          .catch((error) => {
            errorCount++;
            errors.push(error.message);
          })
      );
    }

    await Promise.all(batchPromises);
    
    // Petite pause entre les batches pour éviter la surcharge
    if (batch < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  const totalTime = Date.now() - startTime;
  const sortedTimes = responseTimes.sort((a, b) => a - b);
  
  return {
    requests,
    successCount,
    errorCount,
    avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
    minResponseTime: sortedTimes[0] || 0,
    maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
    p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0,
    requestsPerSecond: totalTime > 0 ? (successCount / totalTime) * 1000 : 0,
    errors: errors.slice(0, 10) // Limiter à 10 erreurs pour éviter des réponses trop lourdes
  };
}

/**
 * Gestion des OPTIONS pour CORS
 */
export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}