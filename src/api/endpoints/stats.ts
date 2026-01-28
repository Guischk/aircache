import { Elysia } from "elysia";
import { sqliteService } from "../../lib/sqlite";

export const stats = new Elysia({ prefix: "/api/stats" }).get("/", async () => {
	const stats = await sqliteService.getStats();
	return {
		backend: "sqlite",
		...stats,
	};
});
