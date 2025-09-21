/**
 * Tables handlers for SQLite
 */

export async function handleTables(): Promise<Response> {
  try {
    const { sqliteService } = await import("../../lib/sqlite/index");
    const tables = await sqliteService.getTables(1);

    return new Response(JSON.stringify({
      tables,
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

export async function handleTableRecords(
  tableName: string,
  url: URL
): Promise<Response> {
  try {
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "100");

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

export async function handleSingleRecord(
  tableName: string,
  recordId: string
): Promise<Response> {
  try {
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