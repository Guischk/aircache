/**
 * API server for Aircache
 * Provides REST endpoints for cached Airtable data
 */

import { handleHealth } from "./handlers/health";
import { handleTables, handleTableRecords, handleSingleRecord } from "./handlers/tables";
import { handleStats, handleRefresh } from "./handlers/stats";
import { validateBearerToken, createUnauthorizedResponse, createOptionsResponse, addCorsHeaders } from "./middleware/auth";

/**
 * Request handler for SQLite API routes
 */
async function handleRequest(request: Request, worker?: Worker): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  console.log(`< ${method} ${pathname}`);

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return createOptionsResponse();
  }

  // Authentication for all routes except /health
  if (pathname !== "/health" && !validateBearerToken(request)) {
    return createUnauthorizedResponse();
  }

  // Route handling
  let response: Response;

  switch (pathname) {
    case "/health":
      response = await handleHealth();
      break;

    case "/api/tables":
      response = await handleTables();
      break;

    case "/api/stats":
      response = await handleStats();
      break;

    case "/api/refresh":
      if (method === "POST") {
        response = await handleRefresh(worker);
      } else {
        response = new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" }
        });
      }
      break;

    default:
      // Dynamic route for tables: /api/tables/:tableName or /api/tables/:tableName/:recordId
      const tableMatch = pathname.match(/^\/api\/tables\/([^\/]+)(?:\/(.+))?$/);
      if (tableMatch) {
        const tableName = decodeURIComponent(tableMatch[1]);
        const recordId = tableMatch[2] ? decodeURIComponent(tableMatch[2]) : undefined;

        if (recordId) {
          // Route: /api/tables/:tableName/:recordId
          response = await handleSingleRecord(tableName, recordId);
        } else {
          // Route: /api/tables/:tableName
          response = await handleTableRecords(tableName, url);
        }
      } else {
        response = new Response(JSON.stringify({
          error: "Route not found",
          availableRoutes: [
            "GET /health",
            "GET /api/tables",
            "GET /api/tables/:tableName",
            "GET /api/tables/:tableName/:recordId",
            "GET /api/stats",
            "POST /api/refresh"
          ]
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      break;
  }

  return addCorsHeaders(response);
}

/**
 * Start the SQLite API server on the specified port
 */
export async function startSQLiteApiServer(port: number, worker?: Worker): Promise<void> {
  console.log(`🌐 Starting SQLite API server on port ${port}`);

  Bun.serve({
    port,
    hostname: "0.0.0.0",
    fetch: (request) => handleRequest(request, worker),
    error: (error) => {
      console.error("❌ Server error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  console.log(`✅ SQLite API server started: http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📋 Tables: http://localhost:${port}/api/tables`);
  console.log(`📈 Stats: http://localhost:${port}/api/stats`);
  console.log(`🔄 Refresh: POST http://localhost:${port}/api/refresh`);
}

// Export pour usage externe
export { handleRequest };