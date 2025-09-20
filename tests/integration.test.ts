#!/usr/bin/env bun

/**
 * Tests d'intégration pour le système complet Airtable Cacher
 */

import { redisService } from "../src/lib/redis/index";
import { getActiveNamespace, withLock } from "../src/lib/redis/helpers";
import { updateSchemaWithRetry } from "../src/lib/airtable/schema-updater";

const API_BASE = "http://localhost:3000";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "test-token";

interface TestResult {
  test: string;
  status: "✅ PASS" | "❌ FAIL" | "⚠️ WARN";
  duration: number;
  details?: string;
  error?: string;
}

class IntegrationTester {
  private results: TestResult[] = [];

  async runTest(testName: string, testFn: () => Promise<void>): Promise<TestResult> {
    const start = performance.now();

    try {
      await testFn();
      const duration = performance.now() - start;

      const result: TestResult = {
        test: testName,
        status: "✅ PASS",
        duration
      };

      this.results.push(result);
      console.log(`${result.status} ${testName} (${duration.toFixed(2)}ms)`);
      return result;

    } catch (error) {
      const duration = performance.now() - start;

      const result: TestResult = {
        test: testName,
        status: "❌ FAIL",
        duration,
        error: error instanceof Error ? error.message : String(error)
      };

      this.results.push(result);
      console.log(`${result.status} ${testName} (${duration.toFixed(2)}ms): ${result.error}`);
      return result;
    }
  }

  async runWarningTest(testName: string, testFn: () => Promise<string>): Promise<TestResult> {
    const start = performance.now();

    try {
      const warning = await testFn();
      const duration = performance.now() - start;

      const result: TestResult = {
        test: testName,
        status: "⚠️ WARN",
        duration,
        details: warning
      };

      this.results.push(result);
      console.log(`${result.status} ${testName} (${duration.toFixed(2)}ms): ${warning}`);
      return result;

    } catch (error) {
      const duration = performance.now() - start;

      const result: TestResult = {
        test: testName,
        status: "❌ FAIL",
        duration,
        error: error instanceof Error ? error.message : String(error)
      };

      this.results.push(result);
      console.log(`${result.status} ${testName} (${duration.toFixed(2)}ms): ${result.error}`);
      return result;
    }
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.status === "✅ PASS").length;
    const failed = this.results.filter(r => r.status === "❌ FAIL").length;
    const warnings = this.results.filter(r => r.status === "⚠️ WARN").length;
    const total = this.results.length;

    let report = "# 🧪 Integration Tests Report\n\n";
    report += `Generated on: ${new Date().toISOString()}\n\n`;

    report += "## 📊 Summary\n\n";
    report += `- **Total Tests**: ${total}\n`;
    report += `- **Passed**: ${passed} ✅\n`;
    report += `- **Failed**: ${failed} ❌\n`;
    report += `- **Warnings**: ${warnings} ⚠️\n`;
    report += `- **Success Rate**: ${((passed / total) * 100).toFixed(1)}%\n\n`;

    report += "## 📋 Test Results\n\n";
    report += "| Test | Status | Duration (ms) | Details |\n";
    report += "|------|--------|---------------|----------|\n";

    this.results.forEach(result => {
      const details = result.error || result.details || "-";
      report += `| ${result.test} | ${result.status} | ${result.duration.toFixed(2)} | ${details} |\n`;
    });

    return report;
  }

  getResults() {
    return this.results;
  }
}

async function apiRequest(endpoint: string, withAuth: boolean = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (withAuth) {
    headers["Authorization"] = `Bearer ${BEARER_TOKEN}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, { headers });
  const data = await response.json();

  return { status: response.status, data };
}

async function runIntegrationTests(): Promise<void> {
  console.log("🧪 Starting Integration Tests");
  console.log("=============================");

  const tester = new IntegrationTester();

  // Test 1: Redis Connection
  await tester.runTest("Redis Connection", async () => {
    await redisService.connect();
    const isHealthy = await redisService.healthCheck();
    if (!isHealthy) throw new Error("Redis health check failed");
  });

  // Test 2: Redis Operations
  await tester.runTest("Redis Basic Operations", async () => {
    await redisService.set("integration:test", "test-value", { ttl: 60 });
    const value = await redisService.get("integration:test");
    if (value !== "test-value") throw new Error("Redis get/set failed");
    await redisService.del("integration:test");
  });

  // Test 3: Namespace Management
  await tester.runTest("Namespace Management", async () => {
    const namespace = await getActiveNamespace();
    if (!["v1", "v2"].includes(namespace)) {
      throw new Error(`Invalid namespace: ${namespace}`);
    }
  });

  // Test 4: Lock System
  await tester.runTest("Distributed Lock System", async () => {
    const result = await withLock("integration-test", 10, async () => {
      await Bun.sleep(100);
      return "lock-acquired";
    });

    if (result !== "lock-acquired") {
      throw new Error("Lock system not working");
    }
  });

  // Test 5: Schema Update
  await tester.runTest("Schema Update", async () => {
    const updated = await updateSchemaWithRetry(1);
    if (!updated) throw new Error("Schema update failed");
  });

  // Test 6: API Server Response
  await tester.runTest("API Server Health", async () => {
    const result = await apiRequest("/health", false);
    if (result.status !== 200) throw new Error(`Health check failed: ${result.status}`);
    if (!result.data.success) throw new Error("Health check returned unsuccessful");
  });

  // Test 7: API Authentication
  await tester.runTest("API Authentication", async () => {
    // Test with valid auth
    const validResult = await apiRequest("/api/tables", true);
    if (validResult.status !== 200) throw new Error("Valid auth failed");

    // Test without auth
    const invalidResult = await apiRequest("/api/tables", false);
    if (invalidResult.status !== 401) throw new Error("Invalid auth not rejected");
  });

  // Test 8: Data Retrieval
  await tester.runTest("Data Retrieval", async () => {
    const result = await apiRequest("/api/tables", true);
    if (result.status !== 200) throw new Error("Tables endpoint failed");
    if (!Array.isArray(result.data.data.tables)) throw new Error("Tables not returned as array");
    if (result.data.data.tables.length === 0) throw new Error("No tables found");
  });

  // Test 9: Cache Stats
  await tester.runTest("Cache Statistics", async () => {
    const result = await apiRequest("/api/stats", true);
    if (result.status !== 200) throw new Error("Stats endpoint failed");
    if (typeof result.data.data.totalRecords !== "number") {
      throw new Error("Invalid stats format");
    }
  });

  // Test 10: Error Handling
  await tester.runTest("Error Handling", async () => {
    const result = await apiRequest("/api/nonexistent", true);
    if (result.status !== 404) throw new Error("404 not returned for invalid endpoint");
    if (result.data.code !== "ROUTE_NOT_FOUND") {
      throw new Error("Invalid error code");
    }
  });

  // Warning Tests (pour des checks qui peuvent échouer en dev)
  await tester.runWarningTest("Large Table Performance", async () => {
    // Get the largest available table dynamically
    const tablesResult = await apiRequest("/api/tables", true);
    const tables = tablesResult.data.data.tables;
    const testTable = tables[Math.min(2, tables.length - 1)]; // Try to get 3rd table (likely largest)

    const start = performance.now();
    const result = await apiRequest(`/api/tables/${encodeURIComponent(testTable)}`, true);
    const duration = performance.now() - start;

    if (result.status !== 200) {
      return `Table ${testTable} not accessible`;
    }

    if (duration > 2000) {
      return `Slow response: ${duration.toFixed(2)}ms (>2s)`;
    }

    if (result.data.data.records.length < 10) {
      return `Low record count: ${result.data.data.records.length} records`;
    }

    return `OK: ${result.data.data.records.length} records in ${duration.toFixed(2)}ms`;
  });

  await tester.runWarningTest("Memory Usage", async () => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    if (heapUsedMB > 500) {
      return `High memory usage: ${heapUsedMB}MB`;
    }

    return `Memory usage OK: ${heapUsedMB}MB`;
  });

  console.log("\n" + "=".repeat(40));
  console.log("🎯 INTEGRATION TESTS COMPLETED");
  console.log("=".repeat(40));

  // Générer le rapport
  const report = tester.generateReport();
  await Bun.write("integration-report.md", report);
  console.log("📝 Integration report saved to: integration-report.md");

  // Résumé
  const results = tester.getResults();
  const passed = results.filter(r => r.status === "✅ PASS").length;
  const total = results.length;

  console.log(`\n📊 Results: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);

  if (passed === total) {
    console.log("🎉 All integration tests passed!");
  } else {
    console.log(`⚠️ ${total - passed} tests need attention`);
  }
}

// Export pour permettre l'import
export { runIntegrationTests };

// Si exécuté directement
if (import.meta.main) {
  console.log("⏳ Waiting for system to be ready...");
  await Bun.sleep(5000);
  await runIntegrationTests();
}