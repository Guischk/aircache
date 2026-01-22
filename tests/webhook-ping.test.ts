/**
 * Tests pour vérifier que l'endpoint webhook accepte les pings d'Airtable
 * et valide les signatures pour les vraies notifications
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Subprocess, spawn } from "bun";
import { config } from "../src/config";

const PORT = 3003;
const BASE_URL = `http://localhost:${PORT}`;

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
});

afterAll(() => {
	if (serverProcess) {
		serverProcess.kill();
	}
});

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
			refreshType: string;
		};
		expect(data.status).toBe("success");
		expect(data.refreshType).toBe("full"); // Empty payload = full refresh

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
		const payload = {
			timestamp: new Date().toISOString(),
			baseTransactionNumber: 123,
			webhookId: "test-webhook-id",
			changedTablesById: {
				tblXXX: {
					createdRecordsById: { recXXX: null },
				},
			},
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
		const payload = {
			timestamp: new Date().toISOString(),
			baseTransactionNumber: 123,
			webhookId: "test-webhook-valid-sig",
			changedTablesById: {
				tblXXX: {
					createdRecordsById: { recXXX: null },
				},
			},
		};

		const body = JSON.stringify(payload);

		// Calculate HMAC signature (same logic as middleware)
		let secretBase64: string;
		if (/^[0-9a-f]+$/i.test(config.webhookSecret || "")) {
			const buffer = Buffer.from(config.webhookSecret || "", "hex");
			secretBase64 = buffer.toString("base64");
		} else {
			secretBase64 = Buffer.from(config.webhookSecret || "", "utf-8").toString(
				"base64",
			);
		}

		const secretDecoded = new Uint8Array(Buffer.from(secretBase64, "base64"));
		const bodyData = new Uint8Array(Buffer.from(body, "utf8"));

		const hmac = new Bun.CryptoHasher("sha256", secretDecoded)
			.update(bodyData)
			.digest("hex");

		const response = await fetch(`${BASE_URL}/webhooks/airtable/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Airtable-Content-MAC": `hmac-sha256=${hmac}`,
			},
			body,
		});

		expect(response.status).toBe(200);
		const data = (await response.json()) as {
			status: string;
			refreshType: string;
		};
		expect(data.status).toBe("success");
		expect(data.refreshType).toBe("incremental");
	});
});
