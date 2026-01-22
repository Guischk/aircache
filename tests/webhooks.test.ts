/**
 * Tests for Airtable Webhooks
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Subprocess, spawn } from "bun";

describe("Airtable Webhooks", () => {
	let serverProcess: Subprocess | null = null;
	const PORT = 3003;
	const BASE_URL = `http://localhost:${PORT}`;
	const WEBHOOK_SECRET = "test-secret-for-hmac-validation-min-32-chars-long";
	const BEARER_TOKEN = process.env.BEARER_TOKEN || "dev-token";
	const RATE_LIMIT_MS = 2000; // Match WEBHOOK_RATE_LIMIT env var

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
		console.log("🚀 Starting webhook test server...");

		// Start server on different port for tests
		serverProcess = spawn(["bun", "index.ts"], {
			env: {
				...process.env,
				WEBHOOK_SECRET,
				WEBHOOK_RATE_LIMIT: "2", // 2s for tests
				BEARER_TOKEN,
				PORT: PORT.toString(),
				NODE_ENV: "test",
			},
			stdout: "inherit",
			stderr: "inherit",
		});

		const serverStarted = await waitForServer(15000);

		if (!serverStarted) {
			throw new Error("❌ Unable to start webhook test server");
		}

		// Wait for database initialization
		console.log("🔄 Waiting for database initialization...");
		await new Promise((resolve) => setTimeout(resolve, 3000));

		console.log(`✅ Webhook test server started on port ${PORT}`);
	});

	afterAll(async () => {
		if (serverProcess) {
			console.log("🛑 Stopping webhook test server...");
			serverProcess.kill();
			await new Promise((resolve) => setTimeout(resolve, 1000));
			console.log("✅ Webhook test server stopped");
		}
	});

	/**
	 * Helper: Generate HMAC signature
	 */
	async function generateHMAC(body: string): Promise<string> {
		const keyData = new TextEncoder().encode(WEBHOOK_SECRET);
		const bodyData = new TextEncoder().encode(body);

		const hmac = new Bun.CryptoHasher("sha256", keyData)
			.update(bodyData)
			.digest("hex");

		return `sha256=${hmac}`;
	}

	// ===== Tests de validation HMAC =====

	test("should reject webhook without signature header", async () => {
		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ timestamp: new Date().toISOString() }),
		});

		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toContain("signature");
	});

	test("should reject webhook with invalid signature", async () => {
		const body = JSON.stringify({ timestamp: new Date().toISOString() });

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": "sha256=invalid_signature",
			},
			body,
		});

		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toContain("signature");
	});

	test("should accept webhook with valid HMAC signature", async () => {
		const bodyObj = {
			timestamp: new Date().toISOString(),
			webhookId: `test-valid-${Date.now()}`,
			baseTransactionNumber: 123,
		};
		const body = JSON.stringify(bodyObj);
		const signature = await generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.status).toBe("success");
		expect(data.refreshType).toBe("full"); // Fallback car pas de changedTablesById
		expect(data.message).toContain("refresh triggered");
	});

	// ===== Tests de timestamp validation =====

	test("should reject webhook with expired timestamp", async () => {
		const bodyObj = {
			timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
			webhookId: `test-expired-${Date.now()}`,
		};
		const body = JSON.stringify(bodyObj);
		const signature = await generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.error).toContain("timestamp");
	});

	// ===== Tests de refresh incrémental vs complet =====

	test("should use full refresh when changedTablesById is missing", async () => {
		await waitForRateLimit(); // Wait for rate limit to reset

		const bodyObj = {
			timestamp: new Date().toISOString(),
			webhookId: `test-full-${Date.now()}`,
		};
		const body = JSON.stringify(bodyObj);
		const signature = await generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.status).toBe("success");
		expect(data.refreshType).toBe("full");
		expect(data.message).toBeDefined();
	});

	test("should use incremental refresh when changedTablesById is present", async () => {
		await waitForRateLimit(); // Wait for rate limit to reset

		const bodyObj = {
			timestamp: new Date().toISOString(),
			webhookId: `test-incremental-${Date.now()}`,
			baseTransactionNumber: 456,
			changedTablesById: {
				tblXXXTestTable: {
					createdRecordsById: { recAAA: null },
					changedRecordsById: { recBBB: null },
				},
			},
		};
		const body = JSON.stringify(bodyObj);
		const signature = await generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.status).toBe("success");
		expect(data.refreshType).toBe("incremental");
		expect(data.message).toBeDefined();
	});

	// ===== Tests d'idempotency =====

	test("should handle webhook idempotency (duplicate webhook)", async () => {
		await waitForRateLimit(); // Wait for rate limit to reset

		const webhookId = `test-idempotency-${Date.now()}`;
		const bodyObj = {
			timestamp: new Date().toISOString(),
			webhookId,
		};
		const body = JSON.stringify(bodyObj);
		const signature = await generateHMAC(body);

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
		const data1 = await response1.json();
		expect(data1.status).toBe("success");

		// Attendre un peu pour que le webhook soit marqué comme traité
		// Le webhook est marqué AVANT le refresh, donc devrait être rapide
		await Bun.sleep(500);

		// Deuxième appel avec le même webhookId (devrait être skipped)
		const response2 = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});
		expect(response2.status).toBe(200);
		const data2 = await response2.json();
		expect(data2.status).toBe("skipped");
		expect(data2.reason).toContain("Already processed");
	});

	// ===== Tests de rate limiting =====

	test("should enforce rate limiting on webhooks", async () => {
		await waitForRateLimit(); // Wait for rate limit to reset

		// Premier webhook
		const bodyObj1 = {
			timestamp: new Date().toISOString(),
			webhookId: `test-rate-1-${Date.now()}`,
		};
		const body1 = JSON.stringify(bodyObj1);
		const signature1 = await generateHMAC(body1);

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
			timestamp: new Date().toISOString(),
			webhookId: `test-rate-2-${Date.now()}`,
		};
		const body2 = JSON.stringify(bodyObj2);
		const signature2 = await generateHMAC(body2);

		const response2 = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature2,
			},
			body: body2,
		});

		expect(response2.status).toBe(429);
		const data2 = await response2.json();
		expect(data2.error).toContain("Rate limit");
		expect(data2.retryAfter).toBeGreaterThan(0);
	});

	// ===== Tests de gestion d'erreurs =====

	test("should handle malformed JSON gracefully", async () => {
		const body = "{ invalid json";
		const signature = await generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(401);
	});

	test("should return proper response structure on success", async () => {
		await waitForRateLimit(); // Wait for rate limit to reset

		const bodyObj = {
			timestamp: new Date().toISOString(),
			webhookId: `test-structure-${Date.now()}`,
		};
		const body = JSON.stringify(bodyObj);
		const signature = await generateHMAC(body);

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		const data = await response.json();

		// Vérifier la structure de la réponse
		expect(data).toHaveProperty("status");
		expect(data).toHaveProperty("refreshType");
		expect(data).toHaveProperty("message");
		expect(data).toHaveProperty("timestamp");

		expect(["success", "skipped", "error"]).toContain(data.status);
		if (data.status === "success") {
			expect(["incremental", "full"]).toContain(data.refreshType);
		}
	});
});
