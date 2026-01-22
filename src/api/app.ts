/**
 * 🚀 Hono Application for Aircache
 * Main application setup with routes and middleware
 */

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { loggers } from "../lib/logger";
import { setupAttachmentRoutes } from "./routes/attachments";
// Import route handlers
import { setupHealthRoutes } from "./routes/health";
import { setupMappingsRoutes } from "./routes/mappings";
import { setupStatsRoutes } from "./routes/stats";
import { setupTableRoutes } from "./routes/tables";
import { setupTypesRoutes } from "./routes/types";
import { setupWebhookRoutes } from "./routes/webhooks";

const log = loggers.api;

// Types for context
interface AppBindings {
	worker?: Worker;
}

type AppContext = {
	Bindings: AppBindings;
};

/**
 * Create and configure the Hono application
 */
export function createApp(worker?: Worker): Hono<AppContext> {
	const app = new Hono<AppContext>();

	// 📝 Request logging
	app.use("*", logger());

	// 🌐 CORS middleware - allow all origins for API access
	app.use(
		"*",
		cors({
			origin: "*",
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
			maxAge: 86400,
		}),
	);

	// 🔒 Bearer token authentication (except for /health)
	const bearerToken = process.env.BEARER_TOKEN;
	if (bearerToken && bearerToken.trim() !== "") {
		app.use("/api/*", bearerAuth({ token: bearerToken }));
	}

	// Pass worker to context for routes that need it
	app.use("*", async (c, next) => {
		c.env.worker = worker;
		await next();
	});

	// 🛣️ Setup route modules
	setupHealthRoutes(app);
	setupWebhookRoutes(app); // Webhook routes (no bearer auth, has own HMAC validation)
	setupTableRoutes(app);
	setupStatsRoutes(app);
	setupAttachmentRoutes(app);
	setupMappingsRoutes(app);
	setupTypesRoutes(app);

	// ❌ 404 handler with available routes
	app.notFound((c) => {
		return c.json(
			{
				error: "Route not found",
				availableRoutes: [
					"GET /health",
					"POST /webhooks/airtable/refresh",
					"GET /api/tables",
					"GET /api/tables/:tableName",
					"GET /api/tables/:tableName/:recordId",
					"GET /api/stats",
					"POST /api/refresh",
					"GET /api/attachments/:attachmentId (legacy)",
					"GET /api/attachments/:table",
					"GET /api/attachments/:table/:record",
					"GET /api/attachments/:table/:record/:field",
					"GET /api/attachments/:table/:record/:field/:filename",
					"GET /api/mappings",
					"GET /api/mappings/:identifier",
					"GET /api/types",
					"GET /api/types?format=json",
				],
			},
			404,
		);
	});

	// ❌ Error handler
	app.onError((err, c) => {
		log.error("API Error:", err);
		return c.json(
			{
				error: "Internal server error",
				message: err.message,
			},
			500,
		);
	});

	return app;
}

export type { AppContext };
