/**
 * 🚀 Hono-based API server for Aircache
 * Provides REST endpoints for cached Airtable data using Hono framework
 */

import { createApp } from "./app";

/**
 * 🚀 API SERVER STARTUP WITH HONO
 *
 * This function initializes the Bun server with Hono:
 * - Creates Hono application with all routes
 * - Configures Bun.serve() to use Hono's fetch handler
 * - Passes worker instance to Hono context
 */
export async function startSQLiteApiServer(
	port: number,
	worker?: Worker,
): Promise<void> {
	console.log(`🌐 Starting Hono API server on port ${port}`);

	// 🚀 Create Hono application with all routes and middleware
	const app = createApp(worker);

	// 🌐 BUN SERVER CONFIGURATION WITH HONO
	Bun.serve({
		port, // Configurable port via environment
		hostname: "0.0.0.0", // Listen on all interfaces
		fetch: app.fetch, // 🔑 Use Hono's fetch handler
	});

	console.log(`✅ Hono API server started: http://localhost:${port}`);
	console.log(`📊 Health check: http://localhost:${port}/health`);
	console.log(`📋 Tables: http://localhost:${port}/api/tables`);
	console.log(`📈 Stats: http://localhost:${port}/api/stats`);
	console.log(`🔄 Refresh: POST http://localhost:${port}/api/refresh`);
}
