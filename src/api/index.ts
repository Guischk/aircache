/**
 * API server for Aircache
 * Provides REST endpoints for cached Airtable data
 */

import {
	handleAttachment,
	handleTableAttachments,
	handleRecordAttachments,
	handleFieldAttachments,
	handleSpecificAttachment,
} from "./handlers/attachments";
import { handleHealth } from "./handlers/health";
import { handleRefresh, handleStats } from "./handlers/stats";
import {
	handleSingleRecord,
	handleTableRecords,
	handleTables,
} from "./handlers/tables";
import {
	addCorsHeaders,
	createOptionsResponse,
	createUnauthorizedResponse,
	validateBearerToken,
} from "./middleware/auth";

/**
 * 🛣️ MAIN ROUTING SYSTEM
 *
 * This function is the heart of Aircache's routing system.
 * Unlike Express or other frameworks, we use MANUAL routing
 * that analyzes the URL and routes to the appropriate handlers.
 *
 * ADVANTAGES:
 * - Maximum performance with Bun.serve()
 * - Full control over routing
 * - No heavy external dependencies
 * - Flexibility for complex patterns
 *
 * PROCESSING FLOW:
 * 1. Parse URL and HTTP method
 * 2. Handle CORS (preflight OPTIONS)
 * 3. Authentication (except /health)
 * 4. Route to appropriate handlers
 * 5. Add CORS headers to response
 */
async function handleRequest(
	request: Request,
	worker?: Worker,
): Promise<Response> {
	// 🔍 Extract request information
	const url = new URL(request.url);
	const pathname = url.pathname;
	const method = request.method;

	console.log(`< ${method} ${pathname}`);

	// 🌐 CORS handling: automatic response to preflight requests
	if (method === "OPTIONS") {
		return createOptionsResponse();
	}

	// 🔒 Authentication: Bearer token validation (except /health)
	if (pathname !== "/health" && !validateBearerToken(request)) {
		return createUnauthorizedResponse();
	}

	// 🛣️ ROUTING SECTION: This is where ALL routes are defined!
	let response: Response;

	// 📋 STATIC ROUTES: Exact path matching
	switch (pathname) {
		// ❤️ Health check: only route without authentication
		case "/health":
			response = await handleHealth();
			break;

		// 📋 List of all available tables
		case "/api/tables":
			response = await handleTables();
			break;

		// 📈 Cache statistics (number of records, etc.)
		case "/api/stats":
			response = await handleStats();
			break;

		// 🔄 Manual cache refresh (POST only)
		case "/api/refresh":
			if (method === "POST") {
				response = await handleRefresh(worker);
			} else {
				// HTTP method not allowed
				response = new Response(
					JSON.stringify({ error: "Method not allowed" }),
					{
						status: 405,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			break;

		default:
			// 🔄 DYNAMIC ROUTES: Using regex to match patterns

			// 📁 ATTACHMENTS ROUTE: /api/attachments/(.+)
			// This regex captures everything after '/api/attachments/'
			const attachmentMatch = pathname.match(/^\/api\/attachments\/(.+)$/);
			if (attachmentMatch) {
				// Split path into segments and URL decode
				const pathParts = attachmentMatch[1].split('/').map(part => decodeURIComponent(part));

				// Routing based on number of segments:
				if (pathParts.length === 1) {
					// 🔗 Legacy route: /api/attachments/:attachmentId
					response = await handleAttachment(request, pathParts[0]);
				} else if (pathParts.length === 2) {
					// 📋 Table route: /api/attachments/:table
					response = await handleTableAttachments(request, pathParts[0]);
				} else if (pathParts.length === 3) {
					// 📄 Record route: /api/attachments/:table/:record
					response = await handleRecordAttachments(request, pathParts[0], pathParts[1]);
				} else if (pathParts.length === 4) {
					// 📎 Field route: /api/attachments/:table/:record/:field
					response = await handleFieldAttachments(request, pathParts[0], pathParts[1], pathParts[2]);
				} else if (pathParts.length === 5) {
					// 📁 Specific file route: /api/attachments/:table/:record/:field/:filename
					response = await handleSpecificAttachment(request, pathParts[0], pathParts[1], pathParts[2], pathParts[3]);
				} else {
					// Too many segments = error
					response = new Response(
						JSON.stringify({
							error: "Invalid attachment route",
							message: "Attachment routes support: /api/attachments/:id or /api/attachments/:table[/:record[/:field[/:filename]]]"
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			} else {
				// 📋 TABLES ROUTE: /api/tables/:tableName or /api/tables/:tableName/:recordId
				// Regex explanation:
				// - ([^\/]+): capture table name (everything except '/')
				// - (?:\/(.+))?: optional group to capture record ID
				const tableMatch = pathname.match(
					/^\/api\/tables\/([^\/]+)(?:\/(.+))?$/,
				);
				if (tableMatch) {
					// URL parameter decoding
					const tableName = decodeURIComponent(tableMatch[1]);
					const recordId = tableMatch[2]
						? decodeURIComponent(tableMatch[2])
						: undefined;

					if (recordId) {
						// 📄 Specific record route: /api/tables/:tableName/:recordId
						response = await handleSingleRecord(tableName, recordId);
					} else {
						// 📋 Records list route: /api/tables/:tableName (with pagination)
						response = await handleTableRecords(tableName, url);
					}
				} else {
					// ❌ UNKNOWN ROUTE: No pattern matches
					// 404 response with list of all available routes
					response = new Response(
						JSON.stringify({
							error: "Route not found",
							// 🗺️ Automatic documentation of all routes
							availableRoutes: [
								"GET /health",
								"GET /api/tables",
								"GET /api/tables/:tableName",
								"GET /api/tables/:tableName/:recordId",
								"GET /api/stats",
								"POST /api/refresh",
								"GET /api/attachments/:attachmentId (legacy)",
								"GET /api/attachments/:table",
								"GET /api/attachments/:table/:record",
								"GET /api/attachments/:table/:record/:field",
								"GET /api/attachments/:table/:record/:field/:filename",
							],
						}),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			}
			break;
	}

	// 🌐 Automatic CORS headers addition to any response
	return addCorsHeaders(response);
}

/**
 * 🚀 API SERVER STARTUP
 *
 * This function initializes the Bun server with:
 * - Port and hostname configuration
 * - Binding with handleRequest function for all requests
 * - Global error handling
 *
 * IMPORTANT: This is where Bun.serve() is configured with our routing system!
 */
export async function startSQLiteApiServer(
	port: number,
	worker?: Worker,
): Promise<void> {
	console.log(`🌐 Starting SQLite API server on port ${port}`);

	// 🌐 BUN SERVER CONFIGURATION
	// All HTTP requests go through handleRequest()
	Bun.serve({
		port, // Configurable port via environment
		hostname: "0.0.0.0", // Listen on all interfaces
		fetch: (request) => handleRequest(request, worker), // 🔑 SINGLE ENTRY POINT
		error: (error) => {
			// Global server error handling
			console.error("❌ Server error:", error);
			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		},
	});

	console.log(`✅ SQLite API server started: http://localhost:${port}`);
	console.log(`📊 Health check: http://localhost:${port}/health`);
	console.log(`📋 Tables: http://localhost:${port}/api/tables`);
	console.log(`📈 Stats: http://localhost:${port}/api/stats`);
	console.log(`🔄 Refresh: POST http://localhost:${port}/api/refresh`);
}

// Export pour usage externe
export { handleRequest };
