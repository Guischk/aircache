#!/usr/bin/env bun

/**
 * Suite de tests complète pour l'API Aircache
 * Tests unitaires et d'intégration pour tous les endpoints
 */

import { test, expect, describe, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { spawn, type Subprocess } from "bun";

// Configuration pour les tests
const TEST_CONFIG = {
  port: 3001, // Port différent pour les tests
  timeout: 30000, // 30 secondes timeout
  maxRetries: 3
};

const API_BASE = `http://localhost:${TEST_CONFIG.port}`;
const BEARER_TOKEN = process.env.BEARER_TOKEN || "dev-token";

let serverProcess: Subprocess | null = null;
let serverStarted = false;

// Interfaces pour typer les réponses
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
  code?: string;
  meta?: {
    timestamp: string;
    version?: string;
    namespace?: string;
  };
}

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  services: {
    sqlite: boolean;
    worker: boolean;
  };
}

interface TablesResponse {
  tables: string[];
  namespace: string;
  total: number;
}

interface StatsResponse {
  activeVersion: string;
  totalTables: number;
  totalRecords: number;
  dbSize: string;
  tables: Array<{
    name: string;
    recordCount: number;
  }>;
}

interface RefreshResponse {
  message: string;
  timestamp: string;
  type: string;
}

// Helper pour les requêtes API
async function apiRequest<T = any>(endpoint: string, options: {
  method?: string,
  auth?: boolean,
  headers?: Record<string, string>,
  body?: any,
  retries?: number
} = {}): Promise<{
  status: number;
  headers: Headers;
  data: T;
  response: Response;
  ok: boolean;
}> {
  const { method = "GET", auth = true, headers = {}, body, retries = 0 } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers
  };

  if (auth) {
    requestHeaders["Authorization"] = `Bearer ${BEARER_TOKEN}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json().catch(() => ({})) as T;

    return {
      status: response.status,
      headers: response.headers,
      data,
      response,
      ok: response.ok
    };
  } catch (error) {
    if (retries < TEST_CONFIG.maxRetries && error instanceof TypeError) {
      // Retry en cas d'erreur de connexion
      await new Promise(resolve => setTimeout(resolve, 1000));
      return apiRequest<T>(endpoint, { ...options, retries: retries + 1 });
    }
    throw error;
  }
}

// Helper pour attendre que le serveur soit prêt
async function waitForServer(timeout = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await apiRequest("/health", { auth: false });
      if (result.status === 200) {
        return true;
      }
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

// Démarrage du serveur avant tous les tests
beforeAll(async () => {
  console.log("🚀 Démarrage du serveur de test...");

  // Démarrer le serveur sur un port différent pour les tests
  serverProcess = spawn(["bun", "index.ts"], {
    env: {
      ...process.env,
      BEARER_TOKEN,
      PORT: TEST_CONFIG.port.toString(),
      NODE_ENV: "test"
    },
    stdout: "inherit",
    stderr: "inherit"
  });

  serverStarted = await waitForServer(TEST_CONFIG.timeout);

      if (!serverStarted) {
        throw new Error("❌ Impossible de démarrer le serveur de test");
      }

      // Attendre que la base de données soit initialisée
      console.log("🔄 Attente de l'initialisation de la base de données...");
      await new Promise(resolve => setTimeout(resolve, 3000));

  console.log("✅ Serveur de test démarré");
});

// Arrêt du serveur après tous les tests
afterAll(async () => {
  if (serverProcess) {
    console.log("🛑 Arrêt du serveur de test...");
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
});

describe("Aircache API Tests", () => {

  describe("Health Check (No Auth)", () => {
    test("should return healthy status", async () => {
      const result = await apiRequest<ApiResponse<HealthResponse>>("/health", { auth: false });

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.status).toMatch(/healthy|degraded/);
      expect(result.data.data.services.sqlite).toBe(true);
      expect(result.data.data.services.worker).toBe(true);
    });

    test("should include system information", async () => {
      const result = await apiRequest<ApiResponse<HealthResponse>>("/health", { auth: false });

      expect(result.data.data.timestamp).toBeDefined();
      expect(result.data.data.uptime).toBeGreaterThan(0);
      expect(result.data.data.services).toBeDefined();
    });
  });

  describe("Refresh Endpoint", () => {
    test("should accept POST requests with valid auth", async () => {
      const result = await apiRequest<ApiResponse<RefreshResponse>>("/api/refresh", {
        method: "POST",
        auth: true
      });

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.message).toContain("Refresh started");
      expect(result.data.data.type).toBe("manual");
      expect(result.data.data.timestamp).toBeDefined();
    });

    test("should reject POST requests without auth", async () => {
      const result = await apiRequest<ApiResponse>("/api/refresh", {
        method: "POST",
        auth: false
      });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("AUTH_REQUIRED");
    });

    test("should reject GET requests", async () => {
      const result = await apiRequest<ApiResponse>("/api/refresh", {
        method: "GET",
        auth: true
      });

      expect(result.status).toBe(405);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("METHOD_NOT_ALLOWED");
    });

    test("should reject PUT requests", async () => {
      const result = await apiRequest<ApiResponse>("/api/refresh", {
        method: "PUT",
        auth: true
      });

      expect(result.status).toBe(405);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("METHOD_NOT_ALLOWED");
    });

    test("should reject DELETE requests", async () => {
      const result = await apiRequest<ApiResponse>("/api/refresh", {
        method: "DELETE",
        auth: true
      });

      expect(result.status).toBe(405);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("METHOD_NOT_ALLOWED");
    });

    test("should reject requests with invalid auth token", async () => {
      const result = await apiRequest<ApiResponse>("/api/refresh", {
        method: "POST",
        auth: false,
        headers: { "Authorization": "Bearer invalid-token" }
      });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("Authentication", () => {
    test("should reject requests without auth token", async () => {
      const result = await apiRequest<ApiResponse>("/api/tables", { auth: false });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("AUTH_REQUIRED");
    });

    test("should accept requests with valid auth token", async () => {
      const result = await apiRequest<ApiResponse<TablesResponse>>("/api/tables", { auth: true });

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
    });

    test("should reject requests with invalid auth token", async () => {
      const result = await apiRequest<ApiResponse>("/api/tables", {
        auth: false,
        headers: { "Authorization": "Bearer invalid-token" }
      });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
    });

    test("should reject requests with malformed auth header", async () => {
      const result = await apiRequest<ApiResponse>("/api/tables", {
        auth: false,
        headers: { "Authorization": "Invalid auth-format" }
      });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("AUTH_REQUIRED");
    });

    test("should reject requests with empty auth token", async () => {
      const result = await apiRequest<ApiResponse>("/api/tables", {
        auth: false,
        headers: { "Authorization": "Bearer " }
      });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
    });
  });

  describe("Tables Endpoint", () => {
    test("should return list of tables", async () => {
      const result = await apiRequest<ApiResponse<TablesResponse>>("/api/tables");

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(Array.isArray(result.data.data.tables)).toBe(true);
      expect(result.data.data.tables.length).toBeGreaterThan(0);
      expect(result.data.data.namespace).toMatch(/v\d+/);
      expect(result.data.data.total).toBeGreaterThan(0);
    });

    test("should include metadata", async () => {
      const result = await apiRequest<ApiResponse<TablesResponse>>("/api/tables");

      expect(result.data.meta?.timestamp).toBeDefined();
      expect(result.data.meta?.version).toBeDefined();
    });

    test("should reject requests without auth", async () => {
      const result = await apiRequest<ApiResponse>("/api/tables", { auth: false });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
      expect(result.data.code).toBe("AUTH_REQUIRED");
    });

    test("should reject requests with invalid auth", async () => {
      const result = await apiRequest<ApiResponse>("/api/tables", {
        auth: false,
        headers: { "Authorization": "Bearer invalid" }
      });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
    });

    test("should return valid table names", async () => {
      const result = await apiRequest<ApiResponse<TablesResponse>>("/api/tables");

      // Vérifier que toutes les tables ont des noms valides
      result.data.data.tables.forEach((tableName: string) => {
        expect(typeof tableName).toBe("string");
        expect(tableName.length).toBeGreaterThan(0);
        expect(tableName).not.toContain(" ");
        expect(tableName).toMatch(/^[a-zA-Z0-9_-]+$/);
      });
    });
  });

  describe("Stats Endpoint", () => {
    test("should return cache statistics", async () => {
      const result = await apiRequest<ApiResponse<StatsResponse>>("/api/stats");

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.data.activeVersion).toMatch(/v\d+/);
      expect(result.data.data.totalTables).toBeGreaterThan(0);
      expect(result.data.data.totalRecords).toBeGreaterThan(0);
      expect(Array.isArray(result.data.data.tables)).toBe(true);
    });

    test("should include table statistics", async () => {
      const result = await apiRequest<ApiResponse<StatsResponse>>("/api/stats");

      const tableStats = result.data.data.tables;
      expect(tableStats.length).toBeGreaterThan(0);

      // Vérifier qu'au moins une table a des données
      const hasData = tableStats.some((table: { name: string; recordCount: number }) => table.recordCount > 0);
      expect(hasData).toBe(true);
    });

    test("should include database size information", async () => {
      const result = await apiRequest<ApiResponse<StatsResponse>>("/api/stats");

      expect(result.data.data.dbSize).toBeDefined();
      expect(typeof result.data.data.dbSize).toBe("string");
      expect(result.data.data.dbSize).toContain("MB");
    });

    test("should reject requests without auth", async () => {
      const result = await apiRequest<ApiResponse>("/api/stats", { auth: false });

      expect(result.status).toBe(401);
      expect(result.data.success).toBe(false);
    });

    test("should include metadata in response", async () => {
      const result = await apiRequest<ApiResponse<StatsResponse>>("/api/stats");

      expect(result.data.meta?.timestamp).toBeDefined();
      expect(result.data.meta?.version).toBeDefined();
    });
  });

  describe("Table Records Endpoint", () => {
    test("should return records for valid table", async () => {
      // Get first available table from schema dynamically
      const tablesResult = await apiRequest("/api/tables");
      const firstTable = tablesResult.data.data.tables[0];

      if (!firstTable) {
        throw new Error("No tables available for testing");
      }

      const result = await apiRequest(`/api/tables/${encodeURIComponent(firstTable)}`);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(Array.isArray(result.data.data.records)).toBe(true);
      expect(result.data.data.table).toBe(firstTable);
    });

    test("should return 404 for invalid table", async () => {
      const result = await apiRequest<ApiResponse>("/api/tables/unknown-table");

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

      if (!firstTable) {
        throw new Error("No tables available for testing");
      }

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
      expect((result.data as any).availableRoutes).toBeDefined();
    });
  });

});