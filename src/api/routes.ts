/**
 * API routes for database backend
 * Provides REST endpoints for cached Airtable data
 */

import { AIRTABLE_TABLE_NAMES } from "../lib/airtable/schema";
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

function createErrorResponse(
	error: string,
	message: string,
	code = "INTERNAL_ERROR",
): Response {
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

		console.log(
			`🩺 Health check - ${Date.now() - startTime}ms - Status: ${healthInfo.status}`,
		);

		return createJsonResponse(response, dbHealthy ? 200 : 503);
	} catch (error) {
		console.error("❌ Health check failed:", error);
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
			tables.length > 0
				? tables.map((table) => normalizeKey(table))
				: [...AIRTABLE_TABLE_NAMES];

		const response: TablesListResponse = {
			tables: normalizedTables,
			version: `v${version}`,
			total: tables.length || AIRTABLE_TABLE_NAMES.length,
		};

		console.log(
			`📋 Tables list requested - ${response.total} tables (normalized)`,
		);

		return createJsonResponse(createSuccessResponse(response, { version }));
	} catch (error) {
		console.error("❌ Error fetching tables:", error);
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
export async function handleTableRecords(
	request: Request,
	tableName: string,
): Promise<Response> {
	const authError = requireAuth(request);
	if (authError) {
		logAuthAttempt(request, false);
		return authError;
	}

	logAuthAttempt(request, true);

	try {
		// Check that the table exists (accept original or normalized names)
		const originalTableNames = AIRTABLE_TABLE_NAMES.map((name) =>
			normalizeKey(name),
		);
		if (
			!originalTableNames.includes(tableName as any) &&
			!AIRTABLE_TABLE_NAMES.includes(tableName as any)
		) {
			return createErrorResponse(
				"Table not found",
				`Table '${tableName}' does not exist`,
				"NOT_FOUND",
			);
		}

		const version = await getActiveVersion();
		const normalizedTableName = normalizeKey(tableName);

		// Pagination
		const url = new URL(request.url);
		const limitParam = url.searchParams.get("limit");
		const offsetParam = url.searchParams.get("offset");
		const fieldsParam = url.searchParams.get("fields");

		const DEFAULT_LIMIT = Number.parseInt(
			process.env.API_DEFAULT_LIMIT || "200",
		);
		const limit = Math.max(
			0,
			Math.min(
				1000,
				limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT,
			),
		);
		const offset = Math.max(
			0,
			offsetParam ? Number.parseInt(offsetParam, 10) : 0,
		);
		const fields = fieldsParam
			? fieldsParam
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: null;

		// Get records with pagination (try active version first, then inactive)
		// Try with normalized name first
		let allRecords = await getTableRecords(
			normalizedTableName,
			false,
			limit,
			offset,
		);
		let totalCount = await countTableRecords(normalizedTableName, false);

		// If no records, try with original name
		if (totalCount === 0) {
			const originalTableName = AIRTABLE_TABLE_NAMES.find(
				(name) => normalizeKey(name) === normalizedTableName,
			);
			if (originalTableName) {
				allRecords = await getTableRecords(
					originalTableName,
					false,
					limit,
					offset,
				);
				totalCount = await countTableRecords(originalTableName, false);

				// If still no records, try inactive version with original name
				if (totalCount === 0) {
					allRecords = await getTableRecords(
						originalTableName,
						true,
						limit,
						offset,
					);
					totalCount = await countTableRecords(originalTableName, true);
				}
			}
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

		console.log(
			`📊 Table '${tableName}' requested - ${records.length} records`,
		);

		return createJsonResponse(createSuccessResponse(response, { version }));
	} catch (error) {
		console.error(`❌ Error fetching records for table '${tableName}':`, error);
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
		// Check that the table exists (accept original or normalized names)
		const originalTableNames = AIRTABLE_TABLE_NAMES.map((name) =>
			normalizeKey(name),
		);
		if (
			!originalTableNames.includes(tableName as any) &&
			!AIRTABLE_TABLE_NAMES.includes(tableName as any)
		) {
			return createErrorResponse(
				"Table not found",
				`Table '${tableName}' does not exist`,
				"NOT_FOUND",
			);
		}

		const version = await getActiveVersion();
		const normalizedTableName = normalizeKey(tableName);

		// Optional field filtering
		const url = new URL(request.url);
		const fieldsParam = url.searchParams.get("fields");
		const fields = fieldsParam
			? fieldsParam
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: null;

		// Try active version first, then inactive
		// Try with normalized name first
		let recordData = await getRecord(normalizedTableName, recordId, false);

		// If no record, try with original name
		if (!recordData) {
			const originalTableName = AIRTABLE_TABLE_NAMES.find(
				(name) => normalizeKey(name) === normalizedTableName,
			);
			if (originalTableName) {
				recordData = await getRecord(originalTableName, recordId, false);

				// If still no record, try inactive version with original name
				if (!recordData) {
					recordData = await getRecord(originalTableName, recordId, true);
				}
			}
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

		console.log(`🔍 Record '${recordId}' from table '${tableName}' requested`);

		return createJsonResponse(createSuccessResponse(response, { version }));
	} catch (error) {
		console.error(
			`❌ Error fetching record '${recordId}' from table '${tableName}':`,
			error,
		);
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

		console.log(
			`📈 Stats requested - ${stats.totalRecords} records across ${stats.totalTables} tables`,
		);

		return createJsonResponse(
			createSuccessResponse(stats, { version: stats.activeVersion }),
		);
	} catch (error) {
		console.error("❌ Error fetching stats:", error);
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
export async function handleRefresh(
	request: Request,
	worker?: Worker,
): Promise<Response> {
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

		console.log("🔄 Manual refresh triggered");

		// Trigger the refresh
		worker.postMessage({ type: "refresh:start" });

		const response = {
			message: "Refresh started successfully",
			timestamp: new Date().toISOString(),
			type: "manual",
		};

		return createJsonResponse(createSuccessResponse(response));
	} catch (error) {
		console.error("❌ Error triggering refresh:", error);
		return createErrorResponse(
			"Failed to trigger refresh",
			"Unable to start manual refresh",
			"REFRESH_FAILED",
		);
	}
}
