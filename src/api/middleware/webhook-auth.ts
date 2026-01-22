/**
 * Middleware de validation des webhooks Airtable
 * Sécurité: HMAC SHA-256 + Timestamp + Idempotency
 */

import type { Context, Next } from "hono";
import { config } from "../../config";
import { loggers } from "../../lib/logger";

const logger = loggers.webhook;

/**
 * Valide la signature HMAC du webhook Airtable
 */
export async function validateWebhookSignature(
	c: Context,
	next: Next,
): Promise<Response | undefined> {
	try {
		// 1. Vérifier que le secret est configuré
		if (!config.webhookSecret) {
			logger.error("WEBHOOK_SECRET not configured");
			return c.json({ error: "Webhook authentication not configured" }, 500);
		}

		// 2. Récupérer signature du header
		const signature = c.req.header("X-Airtable-Content-MAC");
		if (!signature || !signature.startsWith("sha256=")) {
			return c.json({ error: "Missing or invalid signature header" }, 401);
		}

		// 3. Lire le body (nécessaire pour HMAC)
		const body = await c.req.text();

		// 4. Calculer HMAC attendu avec Bun's crypto API
		const encoder = new TextEncoder();
		const keyData = encoder.encode(config.webhookSecret);
		const bodyData = encoder.encode(body);

		// Utiliser l'API crypto standard (compatible Bun)
		const hmac = new Bun.CryptoHasher("sha256", keyData)
			.update(bodyData)
			.digest("hex");

		const computedSignature = `sha256=${hmac}`;

		// 5. Timing-safe comparison
		const providedBuffer = new Uint8Array(
			Buffer.from(signature.replace("sha256=", ""), "hex"),
		);
		const computedBuffer = new Uint8Array(Buffer.from(hmac, "hex"));

		if (providedBuffer.length !== computedBuffer.length) {
			logger.warn("Invalid webhook signature (length mismatch)");
			return c.json({ error: "Invalid signature" }, 401);
		}

		// Use crypto.timingSafeEqual with Uint8Array
		const providedView = new DataView(providedBuffer.buffer);
		const computedView = new DataView(computedBuffer.buffer);

		let isEqual = true;
		for (let i = 0; i < providedBuffer.length; i++) {
			if (providedView.getUint8(i) !== computedView.getUint8(i)) {
				isEqual = false;
			}
		}

		if (!isEqual) {
			logger.warn("Invalid webhook signature");
			return c.json({ error: "Invalid signature" }, 401);
		}

		if (!crypto.timingSafeEqual(providedBuffer, computedBuffer)) {
			logger.warn("Invalid webhook signature");
			return c.json({ error: "Invalid signature" }, 401);
		}

		// 6. Valider timestamp (protection replay attack)
		const payload = JSON.parse(body);
		if (payload.timestamp) {
			const webhookTime = new Date(payload.timestamp).getTime();
			const now = Date.now();
			const diff = Math.abs(now - webhookTime);

			if (diff > config.webhookTimestampWindow * 1000) {
				logger.warn("Webhook timestamp too old", { diffMs: diff });
				return c.json({ error: "Webhook timestamp expired" }, 401);
			}
		}

		// 7. Stocker le body parsé pour le handler
		c.set("webhookBody", payload);

		logger.debug("Webhook signature validated");
		await next();
	} catch (error) {
		logger.error("Webhook validation error:", error);
		return c.json({ error: "Webhook validation failed" }, 401);
	}
}

/**
 * Rate limiting simple (in-memory)
 * TODO: Migrer vers Redis en production si plusieurs instances
 */
const lastWebhookTime = new Map<string, number>();

export async function webhookRateLimit(
	c: Context,
	next: Next,
): Promise<Response | undefined> {
	const key = "airtable-webhook"; // Une seule clé pour toutes les webhooks Airtable
	const now = Date.now();
	const lastTime = lastWebhookTime.get(key) || 0;
	const timeSinceLastWebhook = (now - lastTime) / 1000;

	if (timeSinceLastWebhook < config.webhookRateLimit) {
		const waitTime = config.webhookRateLimit - timeSinceLastWebhook;
		logger.warn("Rate limit: webhook too soon", {
			waitSeconds: waitTime.toFixed(1),
		});
		return c.json(
			{
				error: "Rate limit exceeded",
				retryAfter: Math.ceil(waitTime),
			},
			429,
		);
	}

	lastWebhookTime.set(key, now);
	await next();
}
