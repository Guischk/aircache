/**
 * TypeScript types for the REST API
 */

/**
 * Standard API response
 */
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
	code?: string;
	meta?: {
		total?: number;
		version?: string;
		timestamp?: string;
	};
}

/**
 * API error response
 */
export interface ApiError {
	success: false;
	error: string;
	message: string;
	code: string;
	meta?: {
		timestamp: string;
	};
}

/**
 * System health information
 */
export interface HealthInfo {
	status: "healthy" | "degraded" | "unhealthy";
	timestamp: string;
	uptime: number;
	services: {
		database: boolean;
		worker: boolean;
	};
	version?: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
	activeVersion: string;
	totalTables: number;
	totalRecords: number;
	lastRefresh?: string;
	nextRefresh?: string;
	tables: Array<{
		name: string;
		recordCount: number;
		lastUpdated?: string;
	}>;
}

/**
 * Table information
 */
export interface TableInfo {
	name: string;
	normalizedName: string;
	recordCount: number;
	version: string;
	sampleRecord?: Record<string, any>;
}

/**
 * Available tables list
 */
export interface TablesListResponse {
	tables: string[];
	version: string;
	total: number;
}

/**
 * Table records with basic pagination
 */
export interface TableRecordsResponse {
	records: Record<string, any>[];
	table: string;
	version: string;
	total: number;
	limit?: number;
	offset?: number;
}

/**
 * Individual record
 */
export interface RecordResponse {
	record: Record<string, any>;
	table: string;
	recordId: string;
	version: string;
}

/**
 * Query parameters for endpoints
 */
export interface QueryParams {
	limit?: string;
	offset?: string;
	fields?: string; // Comma-separated field names
}

/**
 * Custom headers for responses
 */
export interface ApiHeaders {
	"Content-Type": "application/json";
	"X-Cache-Version"?: string;
	"X-Cache-Timestamp"?: string;
	"X-RateLimit-Remaining"?: string;
	"Access-Control-Allow-Origin"?: string;
	"Access-Control-Allow-Methods"?: string;
	"Access-Control-Allow-Headers"?: string;
}

/**
 * Individual benchmark test result
 */
export interface BenchmarkResult {
	endpoint: string;
	name: string;
	requests: number;
	successCount: number;
	errorCount: number;
	avgResponseTime: number; // in milliseconds
	minResponseTime: number; // in milliseconds
	maxResponseTime: number; // in milliseconds
	p95ResponseTime: number; // in milliseconds
	requestsPerSecond: number;
	errors: string[]; // List of encountered errors
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
	requests: number;
	concurrent: number;
	tableName: string;
	timestamp: string;
}

/**
 * Complete benchmark response
 */
export interface BenchmarkResponse {
	type: string; // Benchmark type (performance, load, stress)
	totalTime: number; // Total time in milliseconds
	totalRequests: number;
	totalSuccess: number;
	totalErrors: number;
	successRate: number; // Success percentage
	results: BenchmarkResult[];
	config: BenchmarkConfig;
}
