/**
 * Tests pour vérifier que l'endpoint webhook accepte les pings d'Airtable
 * et valide les signatures pour les vraies notifications
 *
 * Note: Ces tests utilisent l'algorithme exact d'Airtable pour générer les signatures
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { type Subprocess, spawn } from "bun";

const PORT = 3003;
const BASE_URL = `http://localhost:${PORT}`;

// Secret de test en base64 (comme retourné par Airtable)
const TEST_SECRET_BASE64 = Buffer.from(
	"test-secret-for-hmac-validation-min-32-chars-long",
).toString("base64");

let serverProcess: Subprocess | null = null;

beforeAll(async () => {
	// Start test server on different port with low rate limit
	serverProcess = spawn({
		cmd: ["bun", "index.ts"],
		env: {
			...process.env,
			PORT: String(PORT),
			WEBHOOK_RATE_LIMIT: "1", // 1 second rate limit for tests
		},
		stdout: "ignore",
		stderr: "ignore",
	});

	// Wait for server to be ready
	await new Promise((resolve) => setTimeout(resolve, 3000));

	// Verify server is running
	const healthCheck = await fetch(`${BASE_URL}/health`);
	if (!healthCheck.ok) {
		throw new Error("Test server failed to start");
	}

	// Store test webhook config in database
	const { sqliteService } = await import("../src/lib/sqlite");
	await sqliteService.connect();
	await sqliteService.storeWebhookConfig(
		"test-webhook-id",
		TEST_SECRET_BASE64,
		`${BASE_URL}/webhooks/airtable/refresh`,
	);
});

afterAll(() => {
	if (serverProcess) {
		serverProcess.kill();
	}
});

/**
 * Helper: Generate HMAC signature EXACTLY like Airtable
 */
function generateHMAC(body: string): string {
	const secretDecoded = Buffer.from(TEST_SECRET_BASE64, "base64");
	const bodyBuffer = Buffer.from(body, "utf8");
	const hmac = createHmac("sha256", new Uint8Array(secretDecoded));
	hmac.update(bodyBuffer.toString("ascii"));
	return `hmac-sha256=${hmac.digest("hex")}`;
}

describe("Webhook Ping & Signature Validation", () => {
	test("should accept empty body ping from Airtable (no signature)", async () => {
		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({}),
		});

		expect(response.status).toBe(200);
		const data = (await response.json()) as {
			status: string;
		};
		expect(data.status).toBe("success");

		// Wait to avoid rate limiting (configured to 1 second in test env)
		await new Promise((resolve) => setTimeout(resolve, 1100));
	});

	test("should accept ping body from Airtable (no signature)", async () => {
		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ ping: true }),
		});

		expect(response.status).toBe(200);
		const data = (await response.json()) as { status: string };
		expect(data.status).toBe("success");

		// Wait to avoid rate limiting (configured to 1 second in test env)
		await new Promise((resolve) => setTimeout(resolve, 1100));
	});

	test("should reject real notification without signature", async () => {
		// Format notification Airtable (contient base, webhook, timestamp)
		const payload = {
			base: { id: "appTestBase" },
			webhook: { id: "test-webhook-id" },
			timestamp: new Date().toISOString(),
		};

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		expect(response.status).toBe(401);
		const data = (await response.json()) as { error: string };
		expect(data.error).toContain("signature");

		// Wait to avoid rate limiting (configured to 1 second in test env)
		await new Promise((resolve) => setTimeout(resolve, 1100));
	});

	test("should accept real notification with valid signature", async () => {
		// Format notification Airtable (ping, pas les données)
		const payload = {
			base: { id: "appTestBase" },
			webhook: { id: "test-webhook-valid-sig" },
			timestamp: new Date().toISOString(),
		};

		const body = JSON.stringify(payload);
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
		};
		expect(data.status).toBe("success");
	});
});
