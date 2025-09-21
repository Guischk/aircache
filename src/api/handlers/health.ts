/**
 * Health check handlers pour Redis et SQLite
 */

import type { BackendType } from "../../server/index";

export async function handleHealth(backend: BackendType): Promise<Response> {
  try {
    if (backend === 'sqlite') {
      const { sqliteService } = await import("../../lib/sqlite/index");
      const stats = await sqliteService.getStats();

      return new Response(JSON.stringify({
        status: "ok",
        backend: "sqlite",
        database: "data/aircache.db",
        tables: stats.totalTables,
        totalRecords: stats.totalRecords,
        dbSize: stats.dbSize
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const { redisService } = await import("../../lib/redis/index");
      const isConnected = await redisService.ping();

      if (!isConnected) {
        throw new Error("Redis connection failed");
      }

      return new Response(JSON.stringify({
        status: "ok",
        backend: "redis",
        redis: "connected"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      backend,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}