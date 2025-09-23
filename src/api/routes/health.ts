/**
 * 🏥 Health Check Routes
 */

import type { Hono } from "hono";
import type { AppContext } from "../app";
import { handleHealth } from "../handlers/health";
import { convertResponseToHono } from "../utils";

export function setupHealthRoutes(app: Hono<AppContext>) {
	// ❤️ Health check endpoint - no authentication required
	app.get("/health", async (c) => {
		const response = await handleHealth();
		return convertResponseToHono(response, c);
	});
}
