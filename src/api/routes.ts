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
  QueryParams
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