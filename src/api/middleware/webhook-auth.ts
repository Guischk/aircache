/**
 * Middleware de validation des webhooks Airtable
 * Sécurité: HMAC SHA-256 + Timestamp + Idempotency
 */

import type { Context, Next } from "hono";
import { calculateWebhookHmac } from "../../lib/airtable/webhook-hmac";
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
		// Log ALL headers for debugging
		const allHeaders: Record<string, string> = {};
		c.req.raw.headers.forEach((value, key) => {
			allHeaders[key] = value;
		});
		logger.info("Webhook request received", {
			headers: allHeaders,
			method: c.req.method,
			url: c.req.url,
		});

		// 1. Récupérer la configuration du webhook stockée
		const { sqliteService } = await import("../../lib/sqlite");
		const webhookConfig = await sqliteService.getWebhookConfig();

		if (!webhookConfig) {
			logger.error(
				"No webhook configuration found. Please create a webhook first.",
			);
			return c.json(
				{
					error:
						"Webhook not configured. Please create a webhook using the setup script.",
				},
				500,
			);
		}

		logger.info("Webhook config loaded", {
			webhookId: webhookConfig.webhookId,
			secretPreview: `${webhookConfig.macSecretBase64.substring(0, 10)}...`,
		});

		// 2. Lire le body d'abord pour détecter les requêtes de ping
		const body = await c.req.text();

		logger.info("Body received", {
			bodyLength: body.length,
			bodyPreview: body.substring(0, 100),
		});

		// 2a. Détecter les requêtes de ping/verification d'Airtable
		// Lors de l'activation des notifications, Airtable envoie une requête de test
		// sans signature pour vérifier que l'endpoint est accessible
		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(body || "{}");
		} catch {
			logger.warn("Invalid JSON body");
			return c.json({ error: "Invalid JSON" }, 400);
		}

		// Si le payload est vide ou contient seulement un ping, c'est une vérification
		const isEmptyOrPing =
			!payload ||
			Object.keys(payload).length === 0 ||
			("ping" in payload && Object.keys(payload).length === 1);

		if (isEmptyOrPing) {
			logger.info(
				"Detected Airtable verification ping - responding with 200 OK",
			);
			c.set("webhookBody", payload);
			await next();
			return;
		}

		// 3. Pour les vraies notifications, récupérer et valider la signature
		const signature = c.req.header("X-Airtable-Content-MAC");
		if (!signature) {
			logger.error("Missing signature header for non-ping request");
			return c.json({ error: "Missing signature header" }, 401);
		}

		// Airtable peut envoyer soit "sha256=" soit "hmac-sha256="
		const validPrefixes = ["sha256=", "hmac-sha256="];
		const hasValidPrefix = validPrefixes.some((prefix) =>
			signature.startsWith(prefix),
		);

		if (!hasValidPrefix) {
			logger.error("Invalid signature format", {
				signature,
				expectedPrefixes: validPrefixes,
			});
			return c.json({ error: "Invalid signature format" }, 401);
		}

		logger.info("Signature header found", {
			signaturePreview: `${signature.substring(0, 30)}...`,
		});

		// 4. Calculer le HMAC attendu avec le secret stocké
		// Extraire le hash de la signature (enlever le préfixe)
		const providedHash = signature.replace(/^(sha256=|hmac-sha256=)/, "");

		// Le secret est déjà en base64 dans la DB (comme retourné par Airtable)
		const computedHash = calculateWebhookHmac(
			webhookConfig.macSecretBase64,
			body,
		);

		logger.info("Signature comparison", {
			providedHash,
			computedHash,
			match: providedHash === computedHash,
		});

		// 5. Timing-safe comparison
		const providedBuffer = new Uint8Array(Buffer.from(providedHash, "hex"));
		const computedBuffer = new Uint8Array(Buffer.from(computedHash, "hex"));

		if (providedBuffer.length !== computedBuffer.length) {
			logger.warn("Invalid webhook signature (length mismatch)", {
				providedLength: providedBuffer.length,
				computedLength: computedBuffer.length,
			});
			return c.json({ error: "Invalid signature" }, 401);
		}

		if (!crypto.timingSafeEqual(providedBuffer, computedBuffer)) {
			logger.warn("Invalid webhook signature (mismatch)");
			return c.json({ error: "Invalid signature" }, 401);
		}

		// 6. Valider timestamp (protection replay attack)
		if (payload.timestamp) {
			const { config } = await import("../../config");
			const webhookTime = new Date(payload.timestamp as string).getTime();
			const now = Date.now();
			const diff = Math.abs(now - webhookTime);

			logger.info("Timestamp validation", {
				webhookTime: payload.timestamp,
				now: new Date().toISOString(),
				diffMs: diff,
				maxAllowedMs: config.webhookTimestampWindow * 1000,
			});

			if (diff > config.webhookTimestampWindow * 1000) {
				logger.warn("Webhook timestamp too old", {
					diffMs: diff,
					maxAllowedMs: config.webhookTimestampWindow * 1000,
				});
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
