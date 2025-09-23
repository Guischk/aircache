/**
 * 📈 Stats and Refresh Routes
 */

import type { Hono } from "hono";
import type { AppContext } from "../app";
import { handleRefresh, handleStats } from "../handlers/stats";
import { convertResponseToHono } from "../utils";

export function setupStatsRoutes(app: Hono<AppContext>) {
	// 📈 Cache statistics
	app.get("/api/stats", async (c) => {
		const response = await handleStats();
		return convertResponseToHono(response, c);
	});

	// 🔄 Manual cache refresh (POST only)
	app.post("/api/refresh", async (c) => {
		const worker = c.env.worker;
		const response = await handleRefresh(worker);
		return convertResponseToHono(response, c);
	});
}
