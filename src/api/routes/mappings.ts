/**
 * Routes for table mappings API
 */

import type { Hono } from "hono";
import type { AppContext } from "../app";
import { handleGetMappings, handleGetTableMapping } from "../handlers/mappings";

export function setupMappingsRoutes(app: Hono<AppContext>): void {
	// GET /api/mappings - List all table mappings
	app.get("/api/mappings", async (c) => {
		return await handleGetMappings();
	});

	// GET /api/mappings/:identifier - Get specific table mapping
	app.get("/api/mappings/:identifier", async (c) => {
		const identifier = c.req.param("identifier");
		return await handleGetTableMapping(identifier);
	});
}
