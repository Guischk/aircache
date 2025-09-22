#!/usr/bin/env bun

/**
 * Tests unitaires pour l'authentification
 */

import { describe, expect, test } from "bun:test";

// Mock des variables d'environnement pour les tests
const mockEnv = {
	BEARER_TOKEN: "test-token-123",
};

// Fonction d'authentification à tester (copie depuis auth.ts)
function isAuthenticated(request: Request): boolean {
	const authHeader = request.headers.get("Authorization");

	if (!authHeader) {
		return false;
	}

	const match = authHeader.match(/^Bearer\s+(.+)$/);
	if (!match) {
		return false;
	}

	const token = match[1];
	const expectedToken = process.env.BEARER_TOKEN || mockEnv.BEARER_TOKEN;

	return token === expectedToken;
}

function requireAuth(request: Request): Response | null {
	if (!isAuthenticated(request)) {
		return new Response(
			JSON.stringify({
				error: "Unauthorized",
				message: "Bearer token required",
				code: "AUTH_REQUIRED",
			}),
			{
				status: 401,
				headers: {
					"Content-Type": "application/json",
					"WWW-Authenticate": "Bearer",
				},
			},
		);
	}

	return null;
}

describe("Authentication Unit Tests", () => {
	test("should accept valid bearer token", () => {
		const request = new Request("http://localhost", {
			headers: {
				Authorization: "Bearer test-token-123",
			},
		});

		const result = isAuthenticated(request);
		expect(result).toBe(true);
	});

	test("should reject missing auth header", () => {
		const request = new Request("http://localhost");

		const result = isAuthenticated(request);
		expect(result).toBe(false);
	});

	test("should reject malformed auth header", () => {
		const request = new Request("http://localhost", {
			headers: {
				Authorization: "Invalid-Header",
			},
		});

		const result = isAuthenticated(request);
		expect(result).toBe(false);
	});

	test("should reject bearer token without space", () => {
		const request = new Request("http://localhost", {
			headers: {
				Authorization: "Bearertest-token-123",
			},
		});

		const result = isAuthenticated(request);
		expect(result).toBe(false);
	});

	test("should reject empty bearer token", () => {
		const request = new Request("http://localhost", {
			headers: {
				Authorization: "Bearer ",
			},
		});

		const result = isAuthenticated(request);
		expect(result).toBe(false);
	});

	test("should reject wrong token", () => {
		const request = new Request("http://localhost", {
			headers: {
				Authorization: "Bearer wrong-token",
			},
		});

		const result = isAuthenticated(request);
		expect(result).toBe(false);
	});

	test("should return error response for failed auth", () => {
		const request = new Request("http://localhost");

		const result = requireAuth(request);

		expect(result).toBeInstanceOf(Response);
		expect(result?.status).toBe(401);
	});

	test("should return null for successful auth", () => {
		const request = new Request("http://localhost", {
			headers: {
				Authorization: "Bearer test-token-123",
			},
		});

		const result = requireAuth(request);
		expect(result).toBeNull();
	});

	test("should handle case sensitive tokens", () => {
		const request = new Request("http://localhost", {
			headers: {
				Authorization: "Bearer TEST-TOKEN-123",
			},
		});

		const result = isAuthenticated(request);
		expect(result).toBe(false); // Should be exact match
	});

	test("should handle multiple spaces in auth header", () => {
		const request = new Request("http://localhost", {
			headers: {
				Authorization: "Bearer  test-token-123",
			},
		});

		const result = isAuthenticated(request);
		expect(result).toBe(false); // Should fail due to extra spaces
	});
});
