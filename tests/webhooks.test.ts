/**
 * Tests for Airtable Webhooks
 *
 * Ces tests simulent le comportement exact d'Airtable :
 * - Secret stocké en base64 (comme retourné par Airtable)
 * - Signature HMAC avec préfixe hmac-sha256=
 * - Algorithme exact : base64 → decode → HMAC
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { type Subprocess, spawn } from "bun";

describe("Airtable Webhooks", () => {
	let serverProcess: Subprocess | null = null;
	const PORT = 3003;
	const BASE_URL = `http://localhost:${PORT}`;
	const BEARER_TOKEN = process.env.BEARER_TOKEN || "dev-token";
	const RATE_LIMIT_MS = 2000; // Match WEBHOOK_RATE_LIMIT env var

	// Secret de test en base64 (comme retourné par Airtable)
	const TEST_SECRET_BASE64 = Buffer.from(
		"test-secret-for-hmac-validation-min-32-chars-long",
	).toString("base64");

	// Helper to wait for rate limit window to pass
	async function waitForRateLimit() {
		await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS + 100));
	}

	// Helper to wait for server to be ready
	async function waitForServer(timeout = 10000): Promise<boolean> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			try {
				const response = await fetch(`${BASE_URL}/health`);
				if (response.status === 200) {
					return true;
				}
			} catch {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}
		return false;
	}

	beforeAll(async () => {
		console.log("Starting webhook test server...");

		// IMPORTANT: Store webhook config BEFORE starting the server
		// The server runs in a separate process but uses the same SQLite files
		console.log("Pre-storing test webhook configuration in database...");
		const { sqliteService } = await import("../src/lib/sqlite");
		await sqliteService.connect();
		await sqliteService.storeWebhookConfig(
			"test-webhook-id",
			TEST_SECRET_BASE64,
			`${BASE_URL}/webhooks/airtable/refresh`,
		);
		console.log(`Webhook config stored with secret: ${TEST_SECRET_BASE64.substring(0, 20)}...`);

		// CRITICAL: Close the database connection before starting the server
		// to avoid "database is locked" errors when the server process tries to connect
		sqliteService.close();
		console.log("Database connection closed, ready to start server...");

		// Start server on different port for tests
		serverProcess = spawn(["bun", "index.ts"], {
			env: {
				...process.env,
				WEBHOOK_RATE_LIMIT: "2", // 2s for tests
				BEARER_TOKEN,
				PORT: PORT.toString(),
				SYNC_MODE: "manual", // Use manual mode to avoid automatic refreshes during tests
				NODE_ENV: "test",
			},
			stdout: "inherit",
			stderr: "inherit",
		});

		const serverStarted = await waitForServer(15000);

		if (!serverStarted) {
			throw new Error("Unable to start webhook test server");
		}

		// Wait for database initialization
		console.log("Waiting for server initialization...");
		await new Promise((resolve) => setTimeout(resolve, 2000));

		console.log(`Webhook test server started on port ${PORT}`);
	});

	afterAll(async () => {
		if (serverProcess) {
			console.log("Stopping webhook test server...");
			serverProcess.kill();
			await new Promise((resolve) => setTimeout(resolve, 1000));
			console.log("Webhook test server stopped");
		}
	});

	/**
	 * Helper: Generate HMAC signature EXACTLY like Airtable
	 * Algorithme de la doc Airtable :
	 * 1. Décoder le secret depuis base64
	 * 2. Créer buffer UTF-8 du body
	 * 3. HMAC avec body.toString('ascii')
	 * 4. Préfixe hmac-sha256=
	 */
	function generateHMAC(body: string): string {
		const secretDecoded = Buffer.from(TEST_SECRET_BASE64, "base64");
		const bodyBuffer = Buffer.from(body, "utf8");
		const hmac = createHmac("sha256", new Uint8Array(secretDecoded));
		hmac.update(bodyBuffer.toString("ascii"));
		return `hmac-sha256=${hmac.digest("hex")}`;
	}

	// ===== Tests de validation HMAC =====

	test("should reject webhook without signature header", async () => {
		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ timestamp: new Date().toISOString() }),
		});

		expect(response.status).toBe(401);
		const data = (await response.json()) as { error: string };
		expect(data.error).toContain("signature");
	});

	test("should reject webhook with invalid signature", async () => {
		const body = JSON.stringify({ timestamp: new Date().toISOString() });

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": "hmac-sha256=invalid_signature",
			},
			body,
		});

		expect(response.status).toBe(401);
		const data = (await response.json()) as { error: string };
		expect(data.error).toContain("signature");
	});

	test("should accept webhook with valid HMAC signature", async () => {
		const bodyObj = {
			base: { id: "appTestBase" },
			webhook: { id: "test-webhook-id" },
			timestamp: new Date().toISOString(),
		};
		const body = JSON.stringify(bodyObj);
		const signature = generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		const data = (await response.json()) as {
			status: string;
			refreshType?: string;
			message?: string;
		};
		expect(data.status).toBe("success");
	});

	// ===== Tests de timestamp validation =====

	test("should reject webhook with expired timestamp", async () => {
		const bodyObj = {
			base: { id: "appTestBase" },
			webhook: { id: "test-webhook-id" },
			timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
		};
		const body = JSON.stringify(bodyObj);
		const signature = generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(401);
		const data = (await response.json()) as { error: string };
		expect(data.error).toContain("timestamp");
	});

	// ===== Tests de format Airtable =====

	test("should handle Airtable notification format correctly", async () => {
		await waitForRateLimit();

		// Format exact d'une notification Airtable (ping)
		const bodyObj = {
			base: { id: "appTestBase123" },
			webhook: { id: `test-format-${Date.now()}` },
			timestamp: new Date().toISOString(),
		};
		const body = JSON.stringify(bodyObj);
		const signature = generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		const data = (await response.json()) as {
			status: string;
			refreshType?: string;
		};
		expect(data.status).toBe("success");
	});

	// ===== Tests d'idempotency =====

	test(
		"should handle webhook idempotency (duplicate webhook)",
		async () => {
			await waitForRateLimit();

			// Use the actual webhook ID that was stored in beforeAll
			// This ensures the webhook handler can find the config
			const webhookId = "test-webhook-id";
			const timestamp = new Date().toISOString();
			const bodyObj = {
				base: { id: "appTestBase" },
				webhook: { id: webhookId },
				timestamp,
			};
			const body = JSON.stringify(bodyObj);
			const signature = generateHMAC(body);

			// Premier appel
			const response1 = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Airtable-Content-MAC": signature,
				},
				body,
			});
			expect(response1.status).toBe(200);
			const data1 = (await response1.json()) as { status: string };
			expect(data1.status).toBe("success");

			// Attendre le rate limit pour que le deuxième appel puisse passer
			await waitForRateLimit();

			// Deuxième appel avec le même webhookId + timestamp (devrait être skipped)
			const response2 = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Airtable-Content-MAC": signature,
				},
				body,
			});
			expect(response2.status).toBe(200);
			const data2 = (await response2.json()) as {
				status: string;
				reason: string;
			};
			expect(data2.status).toBe("skipped");
			expect(data2.reason).toContain("Already processed");
		},
		{ timeout: 10000 },
	);

	// ===== Tests de rate limiting =====

	test("should enforce rate limiting on webhooks", async () => {
		await waitForRateLimit();

		// Premier webhook
		const bodyObj1 = {
			base: { id: "appTestBase" },
			webhook: { id: `test-rate-1-${Date.now()}` },
			timestamp: new Date().toISOString(),
		};
		const body1 = JSON.stringify(bodyObj1);
		const signature1 = generateHMAC(body1);

		const response1 = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature1,
			},
			body: body1,
		});
		expect(response1.status).toBe(200);

		// Deuxième webhook immédiatement (devrait être rate limited)
		const bodyObj2 = {
			base: { id: "appTestBase" },
			webhook: { id: `test-rate-2-${Date.now()}` },
			timestamp: new Date().toISOString(),
		};
		const body2 = JSON.stringify(bodyObj2);
		const signature2 = generateHMAC(body2);

		const response2 = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature2,
			},
			body: body2,
		});

		expect(response2.status).toBe(429);
		const data2 = (await response2.json()) as {
			error: string;
			retryAfter: number;
		};
		expect(data2.error).toContain("Rate limit");
		expect(data2.retryAfter).toBeGreaterThan(0);
	});

	// ===== Tests de gestion d'erreurs =====

	test("should handle malformed JSON gracefully", async () => {
		const body = "{ invalid json";
		const signature = generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(400);
	});

	test("should accept Airtable ping (empty payload)", async () => {
		// Wait for rate limit to pass before sending ping
		await waitForRateLimit();

		// Airtable envoie parfois un ping vide pour vérifier l'endpoint
		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: "{}",
		});

		// Ping vide accepté sans signature
		expect(response.status).toBe(200);
	});

	test("should return proper response structure on success", async () => {
		await waitForRateLimit();

		const bodyObj = {
			base: { id: "appTestBase" },
			webhook: { id: `test-structure-${Date.now()}` },
			timestamp: new Date().toISOString(),
		};
		const body = JSON.stringify(bodyObj);
		const signature = generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		const data = (await response.json()) as {
			status: string;
			refreshType?: string;
			message?: string;
			timestamp?: string;
		};

		// Vérifier la structure de la réponse
		expect(data).toHaveProperty("status");
		expect(["success", "skipped", "error"]).toContain(data.status);
	});
});
