#!/usr/bin/env bun

/**
 * Benchmark de performances pour l'API Aircache
 */

const API_BASE = "http://localhost:3000";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "test-token";

interface PerformanceResult {
  endpoint: string;
  method: string;
  totalRequests: number;
  duration: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  successRate: number;
  errors: number;
}

class PerformanceBenchmark {
  private results: PerformanceResult[] = [];

  async makeRequest(endpoint: string, withAuth: boolean = true): Promise<{ success: boolean, responseTime: number }> {
    const start = performance.now();

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (withAuth) {
      headers["Authorization"] = `Bearer ${BEARER_TOKEN}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { headers });
      const end = performance.now();

      return {
        success: response.ok,
        responseTime: end - start
      };
    } catch (error) {
      const end = performance.now();
      return {
        success: false,
        responseTime: end - start
      };
    }
  }

  async benchmarkEndpoint(
    endpoint: string,
    options: {
      requests?: number,
      concurrent?: number,
      withAuth?: boolean,
      warmup?: number
    } = {}
  ): Promise<PerformanceResult> {
    const {
      requests = 100,
      concurrent = 10,
      withAuth = true,
      warmup = 5
    } = options;

    console.log(`\n🏃 Benchmark: ${endpoint}`);
    console.log(`   Requests: ${requests}, Concurrent: ${concurrent}, Auth: ${withAuth ? "Yes" : "No"}`);

    // Warmup
    console.log(`   🔥 Warmup (${warmup} requests)...`);
    for (let i = 0; i < warmup; i++) {
      await this.makeRequest(endpoint, withAuth);
    }

    // Benchmark principal
    console.log(`   ⚡ Running benchmark...`);
    const startTime = performance.now();
    const responseTimes: number[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Exécution par batches concurrents
    const batches = Math.ceil(requests / concurrent);

    for (let batch = 0; batch < batches; batch++) {
      const batchRequests = Math.min(concurrent, requests - (batch * concurrent));

      const promises = Array.from({ length: batchRequests }, () =>
        this.makeRequest(endpoint, withAuth)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        responseTimes.push(result.responseTime);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      // Progress indicator
      const progress = Math.round(((batch + 1) / batches) * 100);
      process.stdout.write(`\r   Progress: ${progress}%`);
    }

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    console.log(`\r   ✅ Completed!                    `);

    const result: PerformanceResult = {
      endpoint,
      method: "GET",
      totalRequests: requests,
      duration: totalDuration,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond: (requests / totalDuration) * 1000,
      successRate: (successCount / requests) * 100,
      errors: errorCount
    };

    this.results.push(result);
    this.printResult(result);

    return result;
  }

  private printResult(result: PerformanceResult): void {
    console.log(`   📊 Results:`);
    console.log(`      • Avg Response Time: ${result.avgResponseTime.toFixed(2)}ms`);
    console.log(`      • Min/Max: ${result.minResponseTime.toFixed(2)}ms / ${result.maxResponseTime.toFixed(2)}ms`);
    console.log(`      • Requests/sec: ${result.requestsPerSecond.toFixed(2)} req/s`);
    console.log(`      • Success Rate: ${result.successRate.toFixed(1)}%`);
    console.log(`      • Errors: ${result.errors}`);
  }

  generateReport(): string {
    let report = "# 🚀 Performance Benchmark Report\n\n";
    report += `Generated on: ${new Date().toISOString()}\n\n`;

    report += "## 📊 Summary\n\n";
    report += "| Endpoint | Requests | Avg Response (ms) | Requests/sec | Success Rate |\n";
    report += "|----------|----------|-------------------|--------------|---------------|\n";

    this.results.forEach(result => {
      report += `| ${result.endpoint} | ${result.totalRequests} | ${result.avgResponseTime.toFixed(2)} | ${result.requestsPerSecond.toFixed(2)} | ${result.successRate.toFixed(1)}% |\n`;
    });

    report += "\n## 📈 Detailed Results\n\n";

    this.results.forEach(result => {
      report += `### ${result.endpoint}\n\n`;
      report += `- **Total Requests**: ${result.totalRequests}\n`;
      report += `- **Test Duration**: ${result.duration.toFixed(2)}ms\n`;
      report += `- **Average Response Time**: ${result.avgResponseTime.toFixed(2)}ms\n`;
      report += `- **Min Response Time**: ${result.minResponseTime.toFixed(2)}ms\n`;
      report += `- **Max Response Time**: ${result.maxResponseTime.toFixed(2)}ms\n`;
      report += `- **Requests per Second**: ${result.requestsPerSecond.toFixed(2)} req/s\n`;
      report += `- **Success Rate**: ${result.successRate.toFixed(1)}%\n`;
      report += `- **Errors**: ${result.errors}\n\n`;
    });

    // Performance grade
    const avgRps = this.results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / this.results.length;
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.avgResponseTime, 0) / this.results.length;

    report += "## 🎯 Performance Grade\n\n";

    if (avgRps > 1000 && avgResponseTime < 50) {
      report += "**Grade: A+** - Excellent performance! 🏆\n";
    } else if (avgRps > 500 && avgResponseTime < 100) {
      report += "**Grade: A** - Very good performance! ⭐\n";
    } else if (avgRps > 200 && avgResponseTime < 200) {
      report += "**Grade: B** - Good performance ✅\n";
    } else if (avgRps > 100 && avgResponseTime < 500) {
      report += "**Grade: C** - Acceptable performance ⚠️\n";
    } else {
      report += "**Grade: D** - Performance needs improvement ❌\n";
    }

    report += `\n- **Average Requests/sec**: ${avgRps.toFixed(2)} req/s\n`;
    report += `- **Average Response Time**: ${avgResponseTime.toFixed(2)}ms\n`;

    return report;
  }
}

async function runPerformanceTests(): Promise<void> {
  console.log("🏁 Starting Performance Benchmark");
  console.log("==================================");

  const benchmark = new PerformanceBenchmark();

  // Tests différents endpoints avec paramètres variés
  await benchmark.benchmarkEndpoint("/health", {
    requests: 200,
    concurrent: 20,
    withAuth: false
  });

  await benchmark.benchmarkEndpoint("/api/tables", {
    requests: 100,
    concurrent: 10
  });

  await benchmark.benchmarkEndpoint("/api/stats", {
    requests: 50,
    concurrent: 5
  });

  // Test with dynamically selected table
  const healthResponse = await fetch(`${API_BASE}/health`);
  if (healthResponse.ok) {
    try {
      const tablesResponse = await fetch(`${API_BASE}/api/tables`, {
        headers: { "Authorization": `Bearer ${BEARER_TOKEN}` }
      });
      const tablesData = await tablesResponse.json() as any;
      const firstTable = tablesData.data?.tables?.[0];

      if (firstTable) {
        await benchmark.benchmarkEndpoint(`/api/tables/${encodeURIComponent(firstTable)}`, {
          requests: 50,
          concurrent: 5
        });
      }
    } catch (error) {
      console.log("⚠️ Skipping table-specific test - API not available");
    }
  }

  // Stress test
  await benchmark.benchmarkEndpoint("/health", {
    requests: 1000,
    concurrent: 50,
    withAuth: false
  });

  console.log("\n" + "=".repeat(50));
  console.log("🎯 BENCHMARK COMPLETED");
  console.log("=".repeat(50));

  // Générer et sauvegarder le rapport
  const report = benchmark.generateReport();

  await Bun.write("performance-report.md", report);
  console.log("📝 Performance report saved to: performance-report.md");

  // Afficher un résumé dans la console
  console.log("\n📊 Quick Summary:");
  const results = (benchmark as any).results;
  const avgRps = results.reduce((sum: number, r: any) => sum + r.requestsPerSecond, 0) / results.length;
  const avgResponseTime = results.reduce((sum: number, r: any) => sum + r.avgResponseTime, 0) / results.length;

  console.log(`   • Average: ${avgRps.toFixed(2)} req/s`);
  console.log(`   • Response: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`   • Tests: ${results.length} endpoints tested`);
}

// Attendre que le serveur soit prêt
console.log("⏳ Waiting for server to be ready...");
await Bun.sleep(3000);

runPerformanceTests().catch(console.error);

export {};