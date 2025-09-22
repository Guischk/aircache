/**
 * 💚 HEALTH CHECK HANDLER
 *
 * This handler provides system health information and basic statistics.
 * It's the only endpoint that doesn't require authentication, making it
 * perfect for monitoring and load balancer health checks.
 */

/**
 * 💚 HANDLER: Health check endpoint
 * Route: GET /health
 * Returns server status and basic system information
 * This is the only endpoint that doesn't require authentication
 */
export async function handleHealth(): Promise<Response> {
	try {
		// 📦 Dynamic import of SQLite service
		const { sqliteService } = await import("../../lib/sqlite/index");
		const stats = await sqliteService.getStats();

		// ✅ Healthy response with system statistics
		return new Response(
			JSON.stringify({
				status: "ok",
				backend: "sqlite", // Backend type indicator
				database: "data/aircache-v1.sqlite, data/aircache-v2.sqlite", // Dual database info
				tables: stats.totalTables, // Number of cached tables
				totalRecords: stats.totalRecords, // Total cached records
				dbSize: stats.dbSize, // Database size in bytes
			}),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		// ❌ Error response when SQLite service is unavailable
		return new Response(
			JSON.stringify({
				status: "error",
				backend: "sqlite",
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500, // HTTP 500 Internal Server Error
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
