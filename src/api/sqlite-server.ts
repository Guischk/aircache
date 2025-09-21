/**
 * Serveur API principal utilisant SQLite
 */

import {
  handleSQLiteHealth,
  handleSQLiteTables,
  handleSQLiteTableRecords,
  handleSQLiteSingleRecord,
  handleSQLiteStats,
  handleSQLiteRefresh
} from "./sqlite-routes";
import { handleOptions } from "./routes";

/**
 * Router pour les routes SQLite
 */
async function handleSQLiteRequest(request: Request, worker?: Worker): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  console.log(`< ${method} ${pathname} (SQLite)`);

  // CORS preflight
  if (method === "OPTIONS") {
    return handleOptions();
  }

  // Health check (pas d'auth)
  if (pathname === "/health") {
    return handleSQLiteHealth(request);
  }

  // Refresh manuel
  if (pathname === "/api/refresh") {
    return handleSQLiteRefresh(request, worker);
  }

  // API Routes (avec auth)
  if (pathname === "/api/tables") {
    return handleSQLiteTables(request);
  }

  if (pathname === "/api/stats") {
    return handleSQLiteStats(request);
  }

  // Route table spécifique: /api/tables/:tableName
  const tableMatch = pathname.match(/^\/api\/tables\/([^\/]+)$/);
  if (tableMatch) {
    const tableName = decodeURIComponent(tableMatch[1]);
    return handleSQLiteTableRecords(request, tableName);
  }

  // Route record spécifique: /api/tables/:tableName/:recordId
  const recordMatch = pathname.match(/^\/api\/tables\/([^\/]+)\/([^\/]+)$/);
  if (recordMatch) {
    const tableName = decodeURIComponent(recordMatch[1]);
    const recordId = decodeURIComponent(recordMatch[2]);
    return handleSQLiteSingleRecord(request, tableName, recordId);
  }

  // Route attachments: /api/attachments/:fileId
  const attachmentMatch = pathname.match(/^\/api\/attachments\/(.+)$/);
  if (attachmentMatch) {
    const fileId = decodeURIComponent(attachmentMatch[1]);
    return handleAttachmentFile(request, fileId);
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
        "GET /api/stats",
        "POST /api/refresh",
        "GET /api/attachments/:fileId"
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
 * Gestion des fichiers d'attachments
 */
async function handleAttachmentFile(request: Request, fileId: string): Promise<Response> {
  try {
    const { sqliteService } = await import("../lib/sqlite/index");

    // Récupérer l'attachment depuis la base
    const attachment = await sqliteService.getAttachment(fileId);

    if (!attachment || !attachment.local_path) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Attachment not found",
          message: `Attachment '${fileId}' not found or not downloaded`,
          code: "ATTACHMENT_NOT_FOUND"
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

    // Vérifier que le fichier existe
    const file = Bun.file(attachment.local_path);
    const exists = await file.exists();

    if (!exists) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "File not found",
          message: `Attachment file not found on disk`,
          code: "FILE_NOT_FOUND"
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

    // Servir le fichier
    const mimeType = attachment.type || "application/octet-stream";
    const fileName = attachment.filename || "attachment";

    return new Response(file, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000" // 1 an pour les attachments
      }
    });

  } catch (error) {
    console.error(`❌ Error serving attachment ${fileId}:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal Server Error",
        message: "Unable to serve attachment",
        code: "ATTACHMENT_ERROR"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}

/**
 * Démarre le serveur API SQLite
 */
export async function startSQLiteApiServer(port: number = 3000, worker?: Worker): Promise<void> {
  console.log("🚀 Démarrage du serveur API SQLite...");

  // Initialiser SQLite
  const { sqliteService } = await import("../lib/sqlite/index");
  await sqliteService.connect();

  const server = Bun.serve({
    port,
    hostname: "0.0.0.0",
    fetch: (request) => handleSQLiteRequest(request, worker),

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

  console.log(`✅ Serveur API SQLite démarré sur http://localhost:${port}`);
  console.log(`📋 Endpoints disponibles:`);
  console.log(`   GET  /health                     - Health check`);
  console.log(`   GET  /api/tables                 - Liste des tables`);
  console.log(`   GET  /api/tables/:table          - Records d'une table`);
  console.log(`   GET  /api/tables/:table/:id      - Record spécifique`);
  console.log(`   GET  /api/stats                  - Statistiques du cache`);
  console.log(`   POST /api/refresh                - Refresh manuel`);
  console.log(`   GET  /api/attachments/:id        - Fichiers attachés`);
  console.log(`🔐 Authentication: Bearer Token requis pour /api/*`);
  console.log(`💾 Storage: ${process.env.STORAGE_PATH || './data/attachments'}`);
}

// Export pour usage externe
export { handleSQLiteRequest };