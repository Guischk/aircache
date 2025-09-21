/**
 * Stats handlers pour Redis et SQLite
 */

import type { BackendType } from "../../server/index";

export async function handleStats(backend: BackendType): Promise<Response> {
  try {
    if (backend === 'sqlite') {
      const { sqliteService } = await import("../../lib/sqlite/index");
      const stats = await sqliteService.getStats(1);

      return new Response(JSON.stringify({
        backend: "sqlite",
        stats
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const { redisService } = await import("../../lib/redis/index");
      const stats = await redisService.getStats();

      return new Response(JSON.stringify({
        backend: "redis",
        stats
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      backend
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function handleRefresh(backend: BackendType, worker?: Worker): Promise<Response> {
  try {
    if (!worker) {
      return new Response(JSON.stringify({
        error: "Worker not available",
        backend
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Déclencher le refresh via le worker
    worker.postMessage({ type: "refresh:start", manual: true });

    return new Response(JSON.stringify({
      message: "Refresh triggered",
      backend
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      backend
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}