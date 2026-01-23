/**
 * API routes for database backend
 * Provides REST endpoints for cached Airtable data
 */

import { AIRTABLE_TABLE_NAMES } from "../lib/airtable/schema";
import { loggers } from "../lib/logger";
import {
	countTableRecords,
	flipActiveVersion,
	getActiveVersion,
	getCacheStats,
	getRecord,
	getTableRecords,
	getTables,
} from "../lib/sqlite/helpers";
import { sqliteService } from "../lib/sqlite/index";
import { normalizeKey } from "../lib/utils/index";
import { logAuthAttempt, requireAuth } from "./auth";
import type {
	ApiResponse,
	CacheStats,
	HealthInfo,
	RecordResponse,
	TableRecordsResponse,
	TablesListResponse,
} from "./types";

const logger = loggers.api;

/**
 * Utilities for API responses
 */
function createSuccessResponse<T>(data: T, meta?: any): ApiResponse<T> {
	return {
		success: true,
		data,
		meta: {
			timestamp: new Date().toISOString(),
			...meta,
		},
	};
}

function createErrorResponse(error: string, message: string, code = "INTERNAL_ERROR"): Response {
	return new Response(
		JSON.stringify({
			success: false,
			error,
			message,
			code,
			meta: {
				timestamp: new Date().toISOString(),
			},
		}),
		{
			status: code === "NOT_FOUND" ? 404 : code === "BAD_REQUEST" ? 400 : 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		},
	);
}

function createJsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Authorization, Content-Type",
			"X-Cache-Version": data.meta?.version?.toString() || "unknown",
			"X-Cache-Timestamp": data.meta?.timestamp || new Date().toISOString(),
			"Cache-Control": "public, max-age=30",
		},
	});
}

/**
 * Health check endpoint
 */
export async function handleHealth(request: Request): Promise<Response> {
	try {
		const startTime = Date.now();

		// Test database
		const dbHealthy = await sqliteService.healthCheck();

		const healthInfo: HealthInfo = {
			status: dbHealthy ? "healthy" : "degraded",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			services: {
				database: dbHealthy,
				worker: true,
			},
		};

		const response = createSuccessResponse(healthInfo);

		logger.debug("Health check completed", {
			duration: Date.now() - startTime,
			status: healthInfo.status,
		});

		return createJsonResponse(response, dbHealthy ? 200 : 503);
	} catch (error) {
		logger.error("Health check failed:", error);
		return createErrorResponse(
			"Health check failed",
			"Unable to check system health",
			"HEALTH_CHECK_FAILED",
		);
	}
}

/**
 * List of available tables
 */
export async function handleTables(request: Request): Promise<Response> {
	const authError = requireAuth(request);
	if (authError) {
		logAuthAttempt(request, false);
		return authError;
	}

	logAuthAttempt(request, true);

	try {
		const version = await getActiveVersion();

		// Get tables from the active version
		let tables = await getTables(false);

		// If no tables in the active version, try the inactive version
		if (tables.length === 0) {
			tables = await getTables(true);
		}

		// Normalize table names for consistency
		const normalizedTables =
			tables.length > 0 ? tables.map((table) => normalizeKey(table)) : [...AIRTABLE_TABLE_NAMES];

		const response: TablesListResponse = {
			tables: normalizedTables,
			version: `v${version}`,
			total: tables.length || AIRTABLE_TABLE_NAMES.length,
		};

		logger.debug("Tables list requested", {
			total: response.total,
			normalized: true,
		});

		return createJsonResponse(createSuccessResponse(response, { version }));
	} catch (error) {
		logger.error("Error fetching tables:", error);
		return createErrorResponse(
			"Failed to fetch tables",
			"Unable to retrieve table list",
			"TABLES_FETCH_FAILED",
		);
	}
}

/**
 * Records from a specific table
 */
export async function handleTableRecords(request: Request, tableName: string): Promise<Response> {
	const authError = requireAuth(request);
	if (authError) {
		logAuthAttempt(request, false);
		return authError;
	}

	logAuthAttempt(request, true);

	try {
		// Check that the table exists (only accept normalized names)
		const normalizedTableNames = AIRTABLE_TABLE_NAMES.map((name) => normalizeKey(name));
		const normalizedTableName = normalizeKey(tableName);

		if (!normalizedTableNames.includes(normalizedTableName)) {
			return createErrorResponse(
				"Table not found",
				`Table '${tableName}' does not exist`,
				"NOT_FOUND",
			);
		}

		const version = await getActiveVersion();

		// Pagination
		const url = new URL(request.url);
		const limitParam = url.searchParams.get("limit");
		const offsetParam = url.searchParams.get("offset");
		const fieldsParam = url.searchParams.get("fields");

		const DEFAULT_LIMIT = Number.parseInt(process.env.API_DEFAULT_LIMIT || "200");
		const limit = Math.max(
			0,
			Math.min(1000, limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT),
		);
		const offset = Math.max(0, offsetParam ? Number.parseInt(offsetParam, 10) : 0);
		const fields = fieldsParam
			? fieldsParam
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: null;

		// Get records with pagination (use only normalized table name)
		let allRecords = await getTableRecords(normalizedTableName, false, limit, offset);
		let totalCount = await countTableRecords(normalizedTableName, false);

		// If no records in active version, try inactive version
		if (totalCount === 0) {
			allRecords = await getTableRecords(normalizedTableName, true, limit, offset);
			totalCount = await countTableRecords(normalizedTableName, true);
		}

		// Field filtering if requested
		const records = allRecords.map((record) => {
			if (!fields || fields.length === 0) return record;

			const projected: Record<string, any> = {};
			for (const field of fields) {
				if (Object.prototype.hasOwnProperty.call(record, field)) {
					projected[field] = record[field];
				}
			}
			// Always return the identifier
			if (record.record_id && projected.record_id === undefined) {
				projected.record_id = record.record_id;
			}
			return projected;
		});

		const response: TableRecordsResponse = {
			records,
			table: tableName,
			version: `v${version}`,
			total: totalCount,
			limit: limit > 0 ? limit : undefined,
			offset: offset || undefined,
		};

		logger.debug("Table records requested", {
			tableName,
			recordCount: records.length,
		});

		return createJsonResponse(createSuccessResponse(response, { version }));
	} catch (error) {
		logger.error("Error fetching table records", { tableName, error });
		return createErrorResponse(
			"Failed to fetch table records",
			`Unable to retrieve records for table '${tableName}'`,
			"RECORDS_FETCH_FAILED",
		);
	}
}

/**
 * Specific record by ID
 */
export async function handleSingleRecord(
	request: Request,
	tableName: string,
	recordId: string,
): Promise<Response> {
	const authError = requireAuth(request);
	if (authError) {
		logAuthAttempt(request, false);
		return authError;
	}

	logAuthAttempt(request, true);

	try {
		// Check that the table exists (only accept normalized names)
		const normalizedTableNames = AIRTABLE_TABLE_NAMES.map((name) => normalizeKey(name));
		const normalizedTableName = normalizeKey(tableName);

		if (!normalizedTableNames.includes(normalizedTableName)) {
			return createErrorResponse(
				"Table not found",
				`Table '${tableName}' does not exist`,
				"NOT_FOUND",
			);
		}

		const version = await getActiveVersion();

		// Optional field filtering
		const url = new URL(request.url);
		const fieldsParam = url.searchParams.get("fields");
		const fields = fieldsParam
			? fieldsParam
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: null;

		// Try active version first, then inactive (use only normalized table name)
		let recordData = await getRecord(normalizedTableName, recordId, false);

		// If no record in active version, try inactive version
		if (!recordData) {
			recordData = await getRecord(normalizedTableName, recordId, true);
		}

		if (!recordData) {
			return createErrorResponse(
				"Record not found",
				`Record '${recordId}' not found in table '${tableName}'`,
				"NOT_FOUND",
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
			version: `v${version}`,
		};

		logger.debug("Single record requested", {
			tableName,
			recordId,
		});

		return createJsonResponse(createSuccessResponse(response, { version }));
	} catch (error) {
		logger.error("Error fetching record", {
			tableName,
			recordId,
			error,
		});
		return createErrorResponse(
			"Failed to fetch record",
			`Unable to retrieve record '${recordId}' from table '${tableName}'`,
			"RECORD_FETCH_FAILED",
		);
	}
}

/**
 * Cache statistics
 */
export async function handleStats(request: Request): Promise<Response> {
	const authError = requireAuth(request);
	if (authError) {
		logAuthAttempt(request, false);
		return authError;
	}

	logAuthAttempt(request, true);

	try {
		const stats = await getCacheStats();

		logger.debug("Stats requested", {
			totalRecords: stats.totalRecords,
			totalTables: stats.totalTables,
		});

		return createJsonResponse(createSuccessResponse(stats, { version: stats.activeVersion }));
	} catch (error) {
		logger.error("Error fetching stats:", error);
		return createErrorResponse(
			"Failed to fetch stats",
			"Unable to retrieve cache statistics",
			"STATS_FETCH_FAILED",
		);
	}
}

/**
 * Manual refresh endpoint
 */
export async function handleRefresh(request: Request, worker?: Worker): Promise<Response> {
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
			"METHOD_NOT_ALLOWED",
		);
	}

	try {
		if (!worker) {
			return createErrorResponse(
				"Worker not available",
				"Refresh worker is not available",
				"WORKER_NOT_AVAILABLE",
			);
		}

		logger.info("Manual refresh triggered");

		// Trigger the refresh
		worker.postMessage({ type: "refresh:start" });

		const response = {
			message: "Refresh started successfully",
			timestamp: new Date().toISOString(),
			type: "manual",
		};

		return createJsonResponse(createSuccessResponse(response));
	} catch (error) {
		logger.error("Error triggering refresh:", error);
		return createErrorResponse(
			"Failed to trigger refresh",
			"Unable to start manual refresh",
			"REFRESH_FAILED",
		);
	}
}
