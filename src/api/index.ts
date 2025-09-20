/**
 * Serveur API principal utilisant Bun.serve()
 */

import {
  handleHealth,
  handleTables,
  handleTableRecords,
  handleSingleRecord,
  handleStats,
  handleOptions
} from "./routes";

/**
 * Router simple pour gérer les différentes routes
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  console.log(`< ${method} ${pathname}`);

  // CORS preflight
  if (method === "OPTIONS") {
    return handleOptions();
  }

  // Health check (pas d'auth)
  if (pathname === "/health") {
    return handleHealth(request);
  }

  // API Routes (avec auth)
  if (pathname === "/api/tables") {
    return handleTables(request);
  }

  if (pathname === "/api/stats") {
    return handleStats(request);
  }

  // Route table spécifique: /api/tables/:tableName
  const tableMatch = pathname.match(/^\/api\/tables\/([^\/]+)$/);
  if (tableMatch) {
    const tableName = decodeURIComponent(tableMatch[1]);
    return handleTableRecords(request, tableName);
  }

  // Route record spécifique: /api/tables/:tableName/:recordId
  const recordMatch = pathname.match(/^\/api\/tables\/([^\/]+)\/([^\/]+)$/);
  if (recordMatch) {
    const tableName = decodeURIComponent(recordMatch[1]);
    const recordId = decodeURIComponent(recordMatch[2]);
    return handleSingleRecord(request, tableName, recordId);
  }

  // Route non trouvée
  return new Response(
    JSON.stringify({
      success: false,
      error: "Not Found",
      message: `Route '${pathname}' not found`,
      code: "ROUTE_NOT_FOUND",
      availableRoutes: [
        "GET /health",
        "GET /api/tables",
        "GET /api/tables/:tableName",
        "GET /api/tables/:tableName/:recordId",
        "GET /api/stats"
      ]
    }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}

/**
 * Démarre le serveur API
 */
export async function startApiServer(port: number = 3000): Promise<void> {
  console.log("=🚀 Démarrage du serveur API...");

  const server = Bun.serve({
    port,
    hostname: "0.0.0.0",
    fetch: handleRequest,

    // Gestion d'erreurs du serveur
    error(error) {
      console.error("❌ Erreur serveur:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Internal Server Error",
          message: "An unexpected error occurred",
          code: "INTERNAL_SERVER_ERROR"
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  });

  console.log(`✅ Serveur API démarré sur http://localhost:${port}`);
  console.log(`=📋 Endpoints disponibles:`);
  console.log(`   GET  /health                     - Health check`);
  console.log(`   GET  /api/tables                 - Liste des tables`);
  console.log(`   GET  /api/tables/:table          - Records d'une table`);
  console.log(`   GET  /api/tables/:table/:id      - Record spécifique`);
  console.log(`   GET  /api/stats                  - Statistiques du cache`);
  console.log(`🔐 Authentication: Bearer Token requis pour /api/*`);
}

// Export pour usage externe
export { handleRequest };