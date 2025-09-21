/**
 * Routes API adaptées pour SQLite
 * Compatible avec l'interface Redis existante
 */

import { sqliteService } from "../lib/sqlite/index";
import {
  getActiveVersion,
  getTableRecords,
  getRecord,
  countTableRecords,
  getTables,
  getCacheStats,
  flipActiveVersion
} from "../lib/sqlite/helpers";
import { normalizeForRedis } from "../lib/utils/index";
import { AIRTABLE_TABLE_NAMES } from "../lib/airtable/schema";
import { requireAuth, logAuthAttempt } from "./auth";
import type {
  ApiResponse,
  HealthInfo,
  CacheStats,
  TablesListResponse,
  TableRecordsResponse,
  RecordResponse
} from "./types";

/**
 * Utilitaires pour les réponses API (identiques)
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "X-Cache-Version": data.meta?.version?.toString() || "unknown",
      "X-Cache-Timestamp": data.meta?.timestamp || new Date().toISOString(),
      "Cache-Control": "public, max-age=30"
    }
  });
}

/**
 * Health check endpoint (SQLite)
 */
export async function handleSQLiteHealth(request: Request): Promise<Response> {
  try {
    const startTime = Date.now();

    // Test SQLite
    const sqliteHealthy = await sqliteService.healthCheck();

    const healthInfo: HealthInfo = {
      status: sqliteHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        sqlite: sqliteHealthy,
        worker: true
      }
    };

    const response = createSuccessResponse(healthInfo);

    console.log(`🩺 Health check (SQLite) - ${Date.now() - startTime}ms - Status: ${healthInfo.status}`);

    return createJsonResponse(response, sqliteHealthy ? 200 : 503);

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
 * Liste des tables disponibles (SQLite)
 */
export async function handleSQLiteTables(request: Request): Promise<Response> {
  const authError = requireAuth(request);
  if (authError) {
    logAuthAttempt(request, false);
    return authError;
  }

  logAuthAttempt(request, true);

  try {
    const version = await getActiveVersion();
    const tables = await getTables(false);

    const response: TablesListResponse = {
      tables: tables.length > 0 ? tables : [...AIRTABLE_TABLE_NAMES],
      namespace: `v${version}`,
      total: tables.length || AIRTABLE_TABLE_NAMES.length
    };

    console.log(`📋 Tables list requested (SQLite) - ${response.total} tables`);

    return createJsonResponse(
      createSuccessResponse(response, { version })
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
 * Records d'une table spécifique (SQLite)
 */
export async function handleSQLiteTableRecords(request: Request, tableName: string): Promise<Response> {
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

    const version = await getActiveVersion();
    const normalizedTableName = normalizeForRedis(tableName);

    // Pagination
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const fieldsParam = url.searchParams.get("fields");

    const DEFAULT_LIMIT = parseInt(process.env.API_DEFAULT_LIMIT || "200");
    const limit = Math.max(0, Math.min(1000, limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT));
    const offset = Math.max(0, offsetParam ? parseInt(offsetParam, 10) : 0);
    const fields = fieldsParam ? fieldsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

    // Récupérer les records avec pagination
    const allRecords = await getTableRecords(normalizedTableName, false, limit, offset);
    const totalCount = await countTableRecords(normalizedTableName, false);

    // Filtrage des champs si demandé
    const records = allRecords.map(record => {
      if (!fields || fields.length === 0) return record;

      const projected: Record<string, any> = {};
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(record, field)) {
          projected[field] = record[field];
        }
      }
      // Toujours renvoyer l'identifiant
      if (record.record_id && projected.record_id === undefined) {
        projected.record_id = record.record_id;
      }
      return projected;
    });

    const response: TableRecordsResponse = {
      records,
      table: tableName,
      namespace: `v${version}`,
      total: totalCount,
      limit: limit > 0 ? limit : undefined,
      offset: offset || undefined
    };

    console.log(`📊 Table '${tableName}' requested (SQLite) - ${records.length} records`);

    return createJsonResponse(
      createSuccessResponse(response, { version })
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
 * Record spécifique par ID (SQLite)
 */
export async function handleSQLiteSingleRecord(request: Request, tableName: string, recordId: string): Promise<Response> {
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

    const version = await getActiveVersion();
    const normalizedTableName = normalizeForRedis(tableName);

    // Filtrage des champs optionnel
    const url = new URL(request.url);
    const fieldsParam = url.searchParams.get("fields");
    const fields = fieldsParam ? fieldsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

    const recordData = await getRecord(normalizedTableName, recordId, version);

    if (!recordData) {
      return createErrorResponse(
        "Record not found",
        `Record '${recordId}' not found in table '${tableName}'`,
        "NOT_FOUND"
      );
    }

    const record = (() => {
      if (!fields || fields.length === 0) return recordData;

      const projected: Record<string, any> = {};
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(recordData, field)) {
          projected[field] = recordData[field];
        }
      }
      if (recordData.record_id && projected.record_id === undefined) {
        projected.record_id = recordData.record_id;
      }
      return projected;
    })();

    const response: RecordResponse = {
      record,
      table: tableName,
      recordId,
      namespace: `v${version}`
    };

    console.log(`🔍 Record '${recordId}' from table '${tableName}' requested (SQLite)`);

    return createJsonResponse(
      createSuccessResponse(response, { version })
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
 * Statistiques du cache (SQLite)
 */
export async function handleSQLiteStats(request: Request): Promise<Response> {
  const authError = requireAuth(request);
  if (authError) {
    logAuthAttempt(request, false);
    return authError;
  }

  logAuthAttempt(request, true);

  try {
    const stats = await getCacheStats();

    console.log(`📈 Stats requested (SQLite) - ${stats.totalRecords} records across ${stats.totalTables} tables`);

    return createJsonResponse(
      createSuccessResponse(stats, { version: stats.activeVersion })
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
 * Endpoint de refresh manuel (SQLite)
 */
export async function handleSQLiteRefresh(request: Request, worker?: Worker): Promise<Response> {
  const authError = requireAuth(request);
  if (authError) {
    logAuthAttempt(request, false);
    return authError;
  }

  logAuthAttempt(request, true);

  if (request.method !== "POST") {
    return createErrorResponse(
      "Method not allowed",
      "This endpoint only accepts POST requests",
      "METHOD_NOT_ALLOWED"
    );
  }

  try {
    if (!worker) {
      return createErrorResponse(
        "Worker not available",
        "Refresh worker is not available",
        "WORKER_NOT_AVAILABLE"
      );
    }

    console.log("🔄 Manual refresh triggered (SQLite)");

    // Déclencher le refresh
    worker.postMessage({ type: "refresh:start" });

    const response = {
      message: "Refresh started successfully",
      timestamp: new Date().toISOString(),
      type: "manual"
    };

    return createJsonResponse(
      createSuccessResponse(response)
    );

  } catch (error) {
    console.error("❌ Error triggering refresh:", error);
    return createErrorResponse(
      "Failed to trigger refresh",
      "Unable to start manual refresh",
      "REFRESH_FAILED"
    );
  }
}