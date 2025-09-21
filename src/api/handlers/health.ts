/**
 * Health check handler for SQLite
 */

export async function handleHealth(): Promise<Response> {
  try {
    const { sqliteService } = await import("../../lib/sqlite/index");
    const stats = await sqliteService.getStats();

    return new Response(JSON.stringify({
      status: "ok",
      backend: "sqlite",
      database: "data/aircache-v1.sqlite, data/aircache-v2.sqlite",
      tables: stats.totalTables,
      totalRecords: stats.totalRecords,
      dbSize: stats.dbSize
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      backend: "sqlite",
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}