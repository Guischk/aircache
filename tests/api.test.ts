#!/usr/bin/env bun

/**
 * Suite de tests complète pour l'API Aircache
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";

const API_BASE = "http://localhost:3000";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "test-token";

// Helper pour les requêtes API
async function apiRequest(endpoint: string, options: {
  method?: string,
  auth?: boolean,
  headers?: Record<string, string>
} = {}) {
  const { method = "GET", auth = true, headers = {} } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers
  };

  if (auth) {
    requestHeaders["Authorization"] = `Bearer ${BEARER_TOKEN}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: requestHeaders
  });

  const data = await response.json();

  return {
    status: response.status,
    headers: response.headers,
    data,
    response
  };
}

describe("Aircache API Tests", () => {

  describe("Health Check (No Auth)", () => {
    test("should return healthy status", async () => {
      const result = await apiRequest("/health", { auth: false });

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.status).toMatch(/healthy|degraded/);
      expect(result.data.data.services.redis).toBe(true);
    });

    test("should include system information", async () => {
      const result = await apiRequest("/health", { auth: false });

      expect(result.data.data.timestamp).toBeDefined();
      expect(result.data.data.uptime).toBeGreaterThan(0);
      expect(result.data.data.services).toBeDefined();
    });
  });

  describe("Authentication", () => {
    test("should reject requests without auth token", async () => {
      const result = await apiRequest("/api/tables", { auth: false });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("AUTH_REQUIRED");
    });

    test("should accept requests with valid auth token", async () => {
      const result = await apiRequest("/api/tables", { auth: true });

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
    });

    test("should reject requests with invalid auth token", async () => {
      const result = await apiRequest("/api/tables", {
        auth: false,
        headers: { "Authorization": "Bearer invalid-token" }
      });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
    });
  });

  describe("Tables Endpoint", () => {
    test("should return list of tables", async () => {
      const result = await apiRequest("/api/tables");

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(Array.isArray(result.data.data.tables)).toBe(true);
      expect(result.data.data.tables.length).toBeGreaterThan(0);
      expect(result.data.data.namespace).toMatch(/v1|v2/);
    });

    test("should include metadata", async () => {
      const result = await apiRequest("/api/tables");

      expect(result.data.meta.timestamp).toBeDefined();
      expect(result.data.meta.namespace).toMatch(/v1|v2/);
    });
  });

  describe("Stats Endpoint", () => {
    test("should return cache statistics", async () => {
      const result = await apiRequest("/api/stats");

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.activeNamespace).toMatch(/v1|v2/);
      expect(result.data.data.totalTables).toBeGreaterThan(0);
      expect(Array.isArray(result.data.data.tables)).toBe(true);
    });

    test("should include table statistics", async () => {
      const result = await apiRequest("/api/stats");

      const tableStats = result.data.data.tables;
      expect(tableStats.length).toBeGreaterThan(0);

      // Vérifier qu'au moins une table a des données
      const hasData = tableStats.some((table: any) => table.recordCount > 0);
      expect(hasData).toBe(true);
    });
  });

  describe("Table Records Endpoint", () => {
    test("should return records for valid table", async () => {
      // Get first available table from schema dynamically
      const tablesResult = await apiRequest("/api/tables");
      const firstTable = tablesResult.data.data.tables[0];

      const result = await apiRequest(`/api/tables/${encodeURIComponent(firstTable)}`);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(Array.isArray(result.data.data.records)).toBe(true);
      expect(result.data.data.table).toBe(firstTable);
    });

    test("should return 404 for invalid table", async () => {
      const result = await apiRequest("/api/tables/unknown-table");

      expect(result.status).toBe(404);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("NOT_FOUND");
    });
  });

  describe("Single Record Endpoint", () => {
    test("should return 404 for non-existent record", async () => {
      // Get first available table from schema dynamically
      const tablesResult = await apiRequest("/api/tables");
      const firstTable = tablesResult.data.data.tables[0];

      const result = await apiRequest(`/api/tables/${encodeURIComponent(firstTable)}/nonexistent-id`);

      expect(result.status).toBe(404);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("NOT_FOUND");
    });

    test("should return 404 for invalid table", async () => {
      const result = await apiRequest("/api/tables/unknown-table/some-id");

      expect(result.status).toBe(404);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("NOT_FOUND");
    });
  });

  describe("CORS Headers", () => {
    test("should include CORS headers", async () => {
      const result = await apiRequest("/health", { auth: false });

      expect(result.headers.get("access-control-allow-origin")).toBe("*");
    });

    test("should handle OPTIONS requests", async () => {
      const result = await apiRequest("/api/tables", { method: "OPTIONS", auth: false });

      expect(result.status).toBe(204);
      expect(result.headers.get("access-control-allow-methods")).toContain("GET");
    });
  });

  describe("Error Handling", () => {
    test("should return 404 for unknown routes", async () => {
      const result = await apiRequest("/unknown-route");

      expect(result.status).toBe(404);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("ROUTE_NOT_FOUND");
      expect(result.data.availableRoutes).toBeDefined();
    });
  });

});