/**
 * 📋 TABLE HANDLERS
 *
 * These functions handle requests related to table data:
 * - List of available tables
 * - Retrieving records from a table (with pagination)
 * - Retrieving a specific record by ID
 *
 * PATTERN USED:
 * 1. Dynamic import of SQLite service
 * 2. Business logic processing
 * 3. Return JSON Response with error handling
 */

/**
 * 📋 HANDLER: List all tables
 * Route: GET /api/tables
 * Returns the list of available tables in SQLite cache
 */
export async function handleTables(): Promise<Response> {
	try {
		// 📦 Dynamic import to optimize startup time
		const { sqliteService } = await import("../../lib/sqlite/index");
		const tables = await sqliteService.getTables(false);

		// ✅ Successful response with table list (tables are already normalized in storage)
		return new Response(
			JSON.stringify({
				tables,
				backend: "sqlite", // Indicates data comes from SQLite cache
			}),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		// ❌ Error handling with HTTP 500 status
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
				backend: "sqlite",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

/**
 * 📄 HANDLER: Table records with pagination
 * Route: GET /api/tables/:tableName?page=1&limit=100
 * Returns records from a specific table with pagination support
 *
 * Query parameters:
 * - page: page number (default: 1)
 * - limit: number of records per page (default: 100)
 */
export async function handleTableRecords(tableName: string, url: URL): Promise<Response> {
	try {
		// 🔢 Parse pagination parameters from URL
		const page = Number.parseInt(url.searchParams.get("page") || "1");
		const limit = Number.parseInt(url.searchParams.get("limit") || "100");

		// 📦 Dynamic import of SQLite service
		const { sqliteService } = await import("../../lib/sqlite/index");

		// 🧮 Calculate offset for pagination
		const offset = (page - 1) * limit;

		// 📋 Retrieve records with pagination from active database
		const records = await sqliteService.getTableRecords(
			tableName,
			false, // useInactive = false → read from activeDb
			limit,
			offset,
		);

		// ✅ Response with pagination metadata
		return new Response(
			JSON.stringify({
				records,
				page, // Current page
				limit, // Limit per page
				backend: "sqlite",
			}),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		// ❌ Error handling (non-existent table, etc.)
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
				backend: "sqlite",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

/**
 * 🎯 HANDLER: Specific record by ID
 * Route: GET /api/tables/:tableName/:recordId
 * Returns a specific record identified by its ID
 *
 * Parameters:
 * - tableName: Airtable table name
 * - recordId: unique record identifier
 */
export async function handleSingleRecord(tableName: string, recordId: string): Promise<Response> {
	try {
		// 📦 Dynamic import of SQLite service
		const { sqliteService } = await import("../../lib/sqlite/index");

		// 🔍 Search for the specific record in active database first
		let record = await sqliteService.getRecord(tableName, recordId, false);

		// 🔄 If not found in active, try inactive (useful during full refresh)
		if (!record) {
			record = await sqliteService.getRecord(tableName, recordId, true);
		}

		// 🚫 Check if record exists
		if (!record) {
			return new Response(
				JSON.stringify({
					error: "Record not found",
					backend: "sqlite",
				}),
				{
					status: 404, // HTTP 404 Not Found
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// ✅ Successful response with record
		return new Response(
			JSON.stringify({
				record,
				backend: "sqlite",
			}),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		// ❌ Error handling (non-existent table, invalid ID, etc.)
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
				backend: "sqlite",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
