/**
 * Serveur API unifié supportant Redis et SQLite
 */

import { detectBackend, type BackendType } from "../server/index";
import { handleHealth } from "./handlers/health";
import { handleTables, handleTableRecords, handleSingleRecord } from "./handlers/tables";
import { handleStats, handleRefresh } from "./handlers/stats";
import { validateBearerToken, createUnauthorizedResponse, createOptionsResponse, addCorsHeaders } from "./middleware/auth";

/**
 * Router unifié pour gérer les différentes routes avec support Redis/SQLite
 */
async function handleRequest(request: Request, backend: BackendType, worker?: Worker): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  console.log(`< ${method} ${pathname} (${backend})`);

  // Gestion CORS préliminaire
  if (method === "OPTIONS") {
    return createOptionsResponse();
  }

  // Authentification pour toutes les routes sauf /health
  if (pathname !== "/health" && !validateBearerToken(request)) {
    return createUnauthorizedResponse();
  }

  // Routes
  let response: Response;

  switch (pathname) {
    case "/health":
      response = await handleHealth(backend);
      break;

    case "/api/tables":
      response = await handleTables(backend);
      break;

    case "/api/stats":
      response = await handleStats(backend);
      break;

    case "/api/refresh":
      if (method === "POST") {
        response = await handleRefresh(backend, worker);
      } else {
        response = new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" }
        });
      }
      break;

    default:
      // Route dynamique pour les tables: /api/tables/:tableName ou /api/tables/:tableName/:recordId
      const tableMatch = pathname.match(/^\/api\/tables\/([^\/]+)(?:\/(.+))?$/);
      if (tableMatch) {
        const tableName = decodeURIComponent(tableMatch[1]);
        const recordId = tableMatch[2] ? decodeURIComponent(tableMatch[2]) : undefined;

        if (recordId) {
          // Route: /api/tables/:tableName/:recordId
          response = await handleSingleRecord(backend, tableName, recordId);
        } else {
          // Route: /api/tables/:tableName
          response = await handleTableRecords(backend, tableName, url);
        }
      } else {
        response = new Response(JSON.stringify({
          error: "Route not found",
          backend,
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
 * Démarre le serveur API Redis sur le port spécifié
 */
export async function startApiServer(port: number): Promise<void> {
  const backend = 'redis';
  console.log(`🌐 Démarrage du serveur API Redis sur le port ${port}`);

  Bun.serve({
    port,
    hostname: "0.0.0.0",
    fetch: (request) => handleRequest(request, backend),
    error: (error) => {
      console.error("❌ Erreur serveur:", error);
      return new Response(JSON.stringify({ error: "Internal server error", backend }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  console.log(`✅ Serveur API Redis démarré: http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📋 Tables: http://localhost:${port}/api/tables`);
  console.log(`📈 Stats: http://localhost:${port}/api/stats`);
}

/**
 * Démarre le serveur API SQLite sur le port spécifié
 */
export async function startSQLiteApiServer(port: number, worker?: Worker): Promise<void> {
  const backend = 'sqlite';
  console.log(`🌐 Démarrage du serveur API SQLite sur le port ${port}`);

  Bun.serve({
    port,
    hostname: "0.0.0.0",
    fetch: (request) => handleRequest(request, backend, worker),
    error: (error) => {
      console.error("❌ Erreur serveur:", error);
      return new Response(JSON.stringify({ error: "Internal server error", backend }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  console.log(`✅ Serveur API SQLite démarré: http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📋 Tables: http://localhost:${port}/api/tables`);
  console.log(`📈 Stats: http://localhost:${port}/api/stats`);
  console.log(`🔄 Refresh: POST http://localhost:${port}/api/refresh`);
}

// Export pour usage externe
export { handleRequest };