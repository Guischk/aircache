/**
 * Tables handlers pour Redis et SQLite
 */

import type { BackendType } from "../../server/index";

export async function handleTables(backend: BackendType): Promise<Response> {
  try {
    if (backend === 'sqlite') {
      const { sqliteService } = await import("../../lib/sqlite/index");
      const tables = await sqliteService.getTables(1);

      return new Response(JSON.stringify({
        tables,
        backend: "sqlite"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const { redisService } = await import("../../lib/redis/index");
      const tables = await redisService.getTables();

      return new Response(JSON.stringify({
        tables,
        backend: "redis"
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

export async function handleTableRecords(
  backend: BackendType,
  tableName: string,
  url: URL
): Promise<Response> {
  try {
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    if (backend === 'sqlite') {
      const { sqliteService } = await import("../../lib/sqlite/index");
      const records = await sqliteService.getTableRecords(tableName, 1, limit, page);

      return new Response(JSON.stringify({
        records,
        page,
        limit,
        backend: "sqlite"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const { redisService } = await import("../../lib/redis/index");
      const records = await redisService.getTableRecords(tableName, page, limit);

      return new Response(JSON.stringify({
        records,
        page,
        limit,
        backend: "redis"
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

export async function handleSingleRecord(
  backend: BackendType,
  tableName: string,
  recordId: string
): Promise<Response> {
  try {
    if (backend === 'sqlite') {
      const { sqliteService } = await import("../../lib/sqlite/index");
      const record = await sqliteService.getRecord(tableName, recordId, 1);

      if (!record) {
        return new Response(JSON.stringify({
          error: "Record not found",
          backend: "sqlite"
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        record,
        backend: "sqlite"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const { redisService } = await import("../../lib/redis/index");
      const record = await redisService.getRecord(tableName, recordId);

      if (!record) {
        return new Response(JSON.stringify({
          error: "Record not found",
          backend: "redis"
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        record,
        backend: "redis"
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