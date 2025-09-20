/**
 * Routes API pour accéder aux données cachées d'Airtable
 */

import { redisService } from "../lib/redis/index";
import { getActiveNamespace, keyRecord } from "../lib/redis/helpers";
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
      "X-Cache-Timestamp": data.meta?.timestamp || new Date().toISOString()
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

    // Récupérer tous les records de la table (simplifié pour MVP)
    // Dans une vraie implémentation, on utiliserait SCAN pour la pagination
    const pattern = `${namespace}:${normalizedTableName}:rec:*`;
    const keys = await redisService.native.keys(pattern);

    const records = [];
    for (const key of keys) {
      try {
        const recordData = await redisService.get(key);
        if (recordData) {
          records.push(JSON.parse(recordData));
        }
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse record ${key}:`, parseError);
      }
    }

    const response: TableRecordsResponse = {
      records,
      table: tableName,
      namespace,
      total: records.length
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

    const recordData = await redisService.get(key);

    if (!recordData) {
      return createErrorResponse(
        "Record not found",
        `Record '${recordId}' not found in table '${tableName}'`,
        "NOT_FOUND"
      );
    }

    const record = JSON.parse(recordData);

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

    for (const tableName of AIRTABLE_TABLE_NAMES) {
      const normalizedTableName = normalizeForRedis(tableName);
      const pattern = `${namespace}:${normalizedTableName}:rec:*`;
      const keys = await redisService.native.keys(pattern);

      tableStats.push({
        name: tableName,
        recordCount: keys.length
      });

      totalRecords += keys.length;
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