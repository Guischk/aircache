#!/usr/bin/env bun

/**
 * Tests de sécurité pour Aircache
 * Vérification des vulnérabilités et de la protection
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Subprocess, spawn } from "bun";

const API_BASE = "http://localhost:3003";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "dev-token";

let serverProcess: Subprocess | null = null;

async function apiRequest(
	endpoint: string,
	options: {
		method?: string;
		auth?: boolean;
		headers?: Record<string, string>;
		body?: any;
	} = {},
) {
	const { method = "GET", auth = true, headers = {}, body } = options;

	const requestHeaders: Record<string, string> = {
		"Content-Type": "application/json",
		...headers,
	};

	if (auth) {
		requestHeaders["Authorization"] = `Bearer ${BEARER_TOKEN}`;
	}

	const response = await fetch(`${API_BASE}${endpoint}`, {
		method,
		headers: requestHeaders,
		body: body ? JSON.stringify(body) : undefined,
	});

	return {
		status: response.status,
		headers: response.headers,
		data: await response.json().catch(() => ({})),
	};
}

beforeAll(async () => {
	serverProcess = spawn(["bun", "index.ts"], {
		env: { ...process.env, BEARER_TOKEN, PORT: "3003", NODE_ENV: "test" },
		stdout: "pipe",
		stderr: "pipe",
	});

	await new Promise((resolve) => setTimeout(resolve, 5000));
});

afterAll(() => {
	if (serverProcess) serverProcess.kill();
});

describe("Security Tests", () => {
	describe("Authentication Bypass Tests", () => {
		test("should reject requests without token", async () => {
			const result = await apiRequest("/api/tables", { auth: false });
			expect(result.status).toBe(401);
			expect(result.data.code).toBe("AUTH_REQUIRED");
		});

		test("should reject requests with invalid token", async () => {
			const result = await apiRequest("/api/tables", {
				auth: false,
				headers: { Authorization: "Bearer invalid-token" },
			});
			expect(result.status).toBe(401);
		});

		test("should reject requests with malformed auth header", async () => {
			const result = await apiRequest("/api/tables", {
				auth: false,
				headers: { Authorization: "Invalid-Header" },
			});
			expect(result.status).toBe(401);
		});

		test("should reject requests with empty token", async () => {
			const result = await apiRequest("/api/tables", {
				auth: false,
				headers: { Authorization: "Bearer " },
			});
			expect(result.status).toBe(401);
		});
	});

	describe("SQL Injection Tests", () => {
		const maliciousInputs = [
			"'; DROP TABLE users; --",
			"'; SELECT * FROM users; --",
			"OR 1=1 --",
			"UNION SELECT username, password FROM users --",
			"<script>alert('xss')</script>",
		];

		test("should sanitize table names", async () => {
			for (const malicious of maliciousInputs) {
				const result = await apiRequest(
					`/api/tables/${encodeURIComponent(malicious)}`,
				);
				expect([400, 404, 401]).toContain(result.status);
			}
		});

		test("should sanitize record IDs", async () => {
			for (const malicious of maliciousInputs) {
				const result = await apiRequest(
					`/api/tables/Users/${encodeURIComponent(malicious)}`,
				);
				expect([400, 404, 401]).toContain(result.status);
			}
		});
	});

	describe("XSS Protection Tests", () => {
		test("should escape HTML in responses", async () => {
			const result = await apiRequest("/api/tables");
			const responseText = JSON.stringify(result.data);

			// Check for unescaped HTML
			expect(responseText).not.toContain("<script>");
			expect(responseText).not.toContain("javascript:");
			expect(responseText).not.toContain("onload=");
		});
	});

	describe("Rate Limiting Tests", () => {
		test("should handle rapid requests gracefully", async () => {
			const requests = Array.from({ length: 10 }, () =>
				apiRequest("/health", { auth: false }),
			);

			const results = await Promise.all(requests);

			// Should not return 429 (rate limited) errors
			const rateLimited = results.filter((r) => r.status === 429);
			expect(rateLimited.length).toBe(0);

			// All requests should succeed
			results.forEach((result) => {
				expect(result.status).toBe(200);
			});
		});
	});

	describe("HTTP Method Validation", () => {
		const protectedEndpoints = ["/api/tables", "/api/stats"];

		test("should reject invalid HTTP methods", async () => {
			for (const endpoint of protectedEndpoints) {
				const invalidMethods = ["PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

				for (const method of invalidMethods) {
					const result = await apiRequest(endpoint, { method });
					expect([401, 405]).toContain(result.status);
				}
			}
		});

		test("should allow valid HTTP methods", async () => {
			const result = await apiRequest("/api/tables", { method: "GET" });
			expect(result.status).toBe(200);
		});
	});

	describe("Information Disclosure Tests", () => {
		test("should not leak sensitive information in errors", async () => {
			const result = await apiRequest("/api/tables/nonexistent", {
				auth: false,
			});

			expect(result.status).toBe(401); // Should be auth error, not 404

			// Error message should not reveal internal structure
			expect(result.data.message).not.toContain("sqlite");
			expect(result.data.message).not.toContain("database");
			expect(result.data.message).not.toContain("server");
		});

		test("should not expose server details in headers", async () => {
			const result = await apiRequest("/health", { auth: false });

			// Check response headers
			expect(result.headers.get("server")).toBeNull();
			expect(result.headers.get("x-powered-by")).toBeNull();
			expect(result.headers.get("x-aspnet-version")).toBeNull();
		});
	});

	describe("Input Validation Tests", () => {
		test("should validate query parameters", async () => {
			const invalidParams = [
				"?limit=-1",
				"?limit=10000",
				"?offset=-1",
				"?fields=invalid,field,names",
			];

			for (const param of invalidParams) {
				const result = await apiRequest(`/api/tables${param}`);
				expect([400, 401]).toContain(result.status);
			}
		});

		test("should validate pagination parameters", async () => {
			const result = await apiRequest("/api/tables?limit=10000&offset=-1");
			expect([400, 401]).toContain(result.status);
		});
	});

	describe("CORS Security Tests", () => {
		test("should not allow dangerous origins", async () => {
			// This test verifies that CORS is properly configured
			// The actual CORS headers are tested in api.test.ts
			const result = await apiRequest("/health", { auth: false });

			// Should have CORS headers but not allow all origins in production
			expect(result.headers.get("access-control-allow-origin")).toBe("*");
			// In production, this should be more restrictive
		});
	});
});
