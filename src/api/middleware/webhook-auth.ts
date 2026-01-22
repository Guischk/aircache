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

		// 1. Vérifier que le secret est configuré
		if (!config.webhookSecret) {
			logger.error("WEBHOOK_SECRET not configured");
			return c.json({ error: "Webhook authentication not configured" }, 500);
		}

		logger.info("WEBHOOK_SECRET is configured", {
			secretLength: config.webhookSecret.length,
		});

		// 2. Récupérer signature du header
		const signature = c.req.header("X-Airtable-Content-MAC");
		if (!signature) {
			logger.error("Missing signature header");
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

		// 3. Lire le body (nécessaire pour HMAC)
		const body = await c.req.text();

		logger.info("Body received", {
			bodyLength: body.length,
			bodyPreview: body.substring(0, 100),
		});

		// 4. Calculer HMAC attendu avec Bun's crypto API
		// Airtable utilise le secret en base64, donc nous devons :
		// 1. Convertir notre secret hex en base64 (comme on fait lors de la création)
		// 2. Décoder depuis base64 pour obtenir le buffer binaire
		// 3. Utiliser ce buffer pour calculer le HMAC

		// Convertir le secret hex en base64 (même logique que webhook-client)
		let secretBase64: string;
		if (/^[0-9a-f]+$/i.test(config.webhookSecret)) {
			// Secret en format hex
			const buffer = Buffer.from(config.webhookSecret, "hex");
			secretBase64 = buffer.toString("base64");
		} else {
			// Secret en format string
			secretBase64 = Buffer.from(config.webhookSecret, "utf-8").toString(
				"base64",
			);
		}

		// Décoder le secret depuis base64 pour obtenir le buffer binaire
		const secretDecoded = new Uint8Array(Buffer.from(secretBase64, "base64"));

		// Calculer HMAC avec le secret décodé
		const bodyData = new Uint8Array(Buffer.from(body, "utf8"));

		const hmac = new Bun.CryptoHasher("sha256", secretDecoded)
			.update(bodyData)
			.digest("hex");

		// Extraire juste le hash de la signature (enlever le préfixe)
		const providedHash = signature.replace(/^(sha256=|hmac-sha256=)/, "");

		logger.info("Signature comparison", {
			providedSignature: signature,
			providedHash,
			computedHash: hmac,
			match: providedHash === hmac,
		});

		// 5. Timing-safe comparison
		const providedBuffer = new Uint8Array(Buffer.from(providedHash, "hex"));
		const computedBuffer = new Uint8Array(Buffer.from(hmac, "hex"));

		if (providedBuffer.length !== computedBuffer.length) {
			logger.warn("Invalid webhook signature (length mismatch)", {
				providedLength: providedBuffer.length,
				computedLength: computedBuffer.length,
			});
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
			logger.warn("Invalid webhook signature (mismatch)", {
				providedHash,
				computedHash: hmac,
			});
			return c.json({ error: "Invalid signature" }, 401);
		}

		if (!crypto.timingSafeEqual(providedBuffer, computedBuffer)) {
			logger.warn("Invalid webhook signature (crypto.timingSafeEqual failed)", {
				providedHash,
				computedHash: hmac,
			});
			return c.json({ error: "Invalid signature" }, 401);
		}

		// 6. Valider timestamp (protection replay attack)
		const payload = JSON.parse(body);
		if (payload.timestamp) {
			const webhookTime = new Date(payload.timestamp).getTime();
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
