/**
 * Routes for TypeScript types generation API
 */

import type { Hono } from "hono";
import type { AppContext } from "../app";
import { handleGetTypes } from "../handlers/types";

export function setupTypesRoutes(app: Hono<AppContext>): void {
	// GET /api/types - Generate TypeScript types
	// Query: ?format=json for JSON metadata
	app.get("/api/types", async (c) => {
		const format = c.req.query("format");
		return await handleGetTypes(format);
	});
}
