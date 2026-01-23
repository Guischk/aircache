/**
 * Middleware de validation des webhooks Airtable
 * Sécurité: HMAC SHA-256 + Timestamp
 *
 * Référence: https://airtable.com/developers/web/api/webhooks-overview
 */

import type { Context, Next } from "hono";
import { calculateWebhookHmac } from "../../lib/airtable/webhook-hmac";
import { loggers } from "../../lib/logger";

const logger = loggers.webhook;

/**
 * Valide la signature HMAC du webhook Airtable
 *
 * Le secret utilisé pour la validation est le `macSecretBase64` retourné
 * par Airtable lors de la création du webhook et stocké en SQLite.
 */
export async function validateWebhookSignature(
	c: Context,
	next: Next,
): Promise<Response | undefined> {
	try {
		// 1. Récupérer la configuration du webhook stockée en SQLite
		const { sqliteService } = await import("../../lib/sqlite");
		const webhookConfig = await sqliteService.getWebhookConfig();

		if (!webhookConfig) {
			logger.error("No webhook configuration found in database");
			return c.json(
				{
					error: "Webhook not configured. Please create a webhook first.",
				},
				500,
			);
		}

		// 2. Lire le body de la requête
		const body = await c.req.text();

		// 3. Parser le JSON
		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(body || "{}");
		} catch {
			logger.warn("Invalid JSON body received");
			return c.json({ error: "Invalid JSON" }, 400);
		}

		// 4. Détecter les requêtes de ping/verification d'Airtable
		// Lors de l'activation des notifications, Airtable envoie un ping sans signature
		const isEmptyOrPing =
			!payload ||
			Object.keys(payload).length === 0 ||
			("ping" in payload && Object.keys(payload).length === 1);

		if (isEmptyOrPing) {
			logger.info("Received Airtable verification ping - responding 200 OK");
			c.set("webhookBody", payload);
			await next();
			return;
		}

		// 5. Pour les vraies notifications, valider la signature
		const signature = c.req.header("X-Airtable-Content-MAC");
		if (!signature) {
			logger.error("Missing X-Airtable-Content-MAC header");
			return c.json({ error: "Missing signature header" }, 401);
		}

		// 6. Vérifier le format de la signature (Airtable utilise hmac-sha256=)
		if (!signature.startsWith("hmac-sha256=")) {
			logger.error("Invalid signature format", {
				received: signature.substring(0, 20),
				expected: "hmac-sha256=...",
			});
			return c.json({ error: "Invalid signature format" }, 401);
		}

		// 7. Extraire le hash et calculer le HMAC attendu
		const providedHash = signature.replace("hmac-sha256=", "");
		const computedHash = calculateWebhookHmac(webhookConfig.macSecretBase64, body);

		// 8. Comparaison timing-safe
		const providedBuffer = new Uint8Array(Buffer.from(providedHash, "hex"));
		const computedBuffer = new Uint8Array(Buffer.from(computedHash, "hex"));

		if (providedBuffer.length !== computedBuffer.length) {
			logger.warn("Signature length mismatch", {
				providedLength: providedBuffer.length,
				computedLength: computedBuffer.length,
			});
			return c.json({ error: "Invalid signature" }, 401);
		}

		if (!crypto.timingSafeEqual(providedBuffer, computedBuffer)) {
			logger.warn("Signature mismatch", {
				provided: `${providedHash.substring(0, 16)}...`,
				computed: `${computedHash.substring(0, 16)}...`,
			});
			return c.json({ error: "Invalid signature" }, 401);
		}

		// 9. Valider timestamp (protection replay attack)
		if (payload.timestamp) {
			const { config } = await import("../../config");
			const webhookTime = new Date(payload.timestamp as string).getTime();
			const now = Date.now();
			const diff = Math.abs(now - webhookTime);

			if (diff > config.webhookTimestampWindow * 1000) {
				logger.warn("Webhook timestamp expired", {
					age: `${Math.round(diff / 1000)}s`,
					max: `${config.webhookTimestampWindow}s`,
				});
				return c.json({ error: "Webhook timestamp expired" }, 401);
			}
		}

		// 10. Stocker le body parsé pour le handler
		c.set("webhookBody", payload);

		logger.info("Webhook signature validated successfully");
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

export async function webhookRateLimit(c: Context, next: Next): Promise<Response | undefined> {
	const { config } = await import("../../config");
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
