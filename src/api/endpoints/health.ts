import { Elysia } from "elysia";
import { sqliteService } from "../../lib/sqlite";

export const health = new Elysia({ prefix: "/health" }).get("/", async () => {
	const stats = await sqliteService.getStats();

	return {
		status: "ok",
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
		backend: "sqlite",
		database: "sqlite",
		tables: stats.totalTables,
		totalRecords: stats.totalRecords,
		dbSize: stats.dbSize,
	};
});
