/**
 * 🔗 Webhook Routes
 * Routes pour recevoir les webhooks Airtable
 */

import type { Hono } from "hono";
import type { AppContext } from "../app";
import { handleAirtableWebhook } from "../handlers/webhooks";
import {
	validateWebhookSignature,
	webhookRateLimit,
} from "../middleware/webhook-auth";
import { convertResponseToHono } from "../utils";

export function setupWebhookRoutes(app: Hono<AppContext>) {
	// 🔗 Webhook Airtable - Refresh on trigger
	app.post(
		"/webhooks/airtable/refresh",
		validateWebhookSignature, // 1. Valider HMAC
		webhookRateLimit, // 2. Rate limiting
		async (c) => {
			const payload = c.get("webhookBody"); // Récupéré par le middleware
			const response = await handleAirtableWebhook(payload);
			return convertResponseToHono(response, c);
		},
	);
}
