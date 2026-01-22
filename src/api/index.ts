/**
 * 🚀 Hono-based API server for Aircache
 * Provides REST endpoints for cached Airtable data using Hono framework
 */

import { loggers } from "../lib/logger";
import { createApp } from "./app";

const logger = loggers.server;

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
	logger.start("Starting Hono API server", { port });

	// 🚀 Create Hono application with all routes and middleware
	const app = createApp(worker);

	// 🌐 BUN SERVER CONFIGURATION WITH HONO
	Bun.serve({
		port, // Configurable port via environment
		hostname: "0.0.0.0", // Listen on all interfaces
		fetch: app.fetch, // 🔑 Use Hono's fetch handler
	});

	logger.success("Hono API server started", {
		url: `http://localhost:${port}`,
		healthCheck: `http://localhost:${port}/health`,
		tables: `http://localhost:${port}/api/tables`,
		stats: `http://localhost:${port}/api/stats`,
		refresh: `POST http://localhost:${port}/api/refresh`,
	});
}
