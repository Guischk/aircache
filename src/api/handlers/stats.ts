/**
 * Stats handlers for SQLite
 */

export async function handleStats(): Promise<Response> {
  try {
    const { sqliteService } = await import("../../lib/sqlite/index");
    const stats = await sqliteService.getStats(1);

    return new Response(JSON.stringify({
      backend: "sqlite",
      stats
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      backend: "sqlite"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function handleRefresh(worker?: Worker): Promise<Response> {
  try {
    if (!worker) {
      return new Response(JSON.stringify({
        error: "Worker not available",
        backend: "sqlite"
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Trigger refresh via worker
    worker.postMessage({ type: "refresh:start", manual: true });

    return new Response(JSON.stringify({
      message: "Refresh triggered",
      backend: "sqlite"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      backend: "sqlite"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}