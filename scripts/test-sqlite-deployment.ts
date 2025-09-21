#!/usr/bin/env bun

/**
 * Script de test pour valider le déploiement SQLite
 * Vérifie que tous les éléments sont fonctionnels
 */

const API_BASE = "http://localhost:3000";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "test-token";

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  data?: any;
}

class SQLiteDeploymentTest {
  private results: TestResult[] = [];

  async runTests(): Promise<void> {
    console.log("🧪 Test du déploiement SQLite");
    console.log("============================");

    // Tests séquentiels
    await this.testHealthEndpoint();
    await this.testEnvironmentVariables();
    await this.testDirectoriesCreation();
    await this.testSQLiteConnection();
    await this.testAPIEndpoints();
    await this.testWorkerFunctionality();

    // Résultats
    this.printResults();
  }

  private async testHealthEndpoint(): Promise<void> {
    console.log("🔍 Test health endpoint...");

    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();

      if (response.ok && data.success) {
        this.results.push({
          name: "Health Endpoint",
          success: true,
          data: data.data
        });
      } else {
        throw new Error(`Health check failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      this.results.push({
        name: "Health Endpoint",
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testEnvironmentVariables(): Promise<void> {
    console.log("🔍 Test variables d'environnement...");

    try {
      const requiredVars = [
        'AIRTABLE_PERSONAL_TOKEN',
        'AIRTABLE_BASE_ID',
        'BEARER_TOKEN'
      ];

      const missing = requiredVars.filter(varName => !process.env[varName]);

      if (missing.length > 0) {
        throw new Error(`Variables manquantes: ${missing.join(', ')}`);
      }

      // Variables SQLite (avec defaults)
      const sqlitePath = process.env.SQLITE_PATH || 'data/aircache.db';
      const storagePath = process.env.STORAGE_PATH || './storage/attachments';

      this.results.push({
        name: "Environment Variables",
        success: true,
        data: {
          sqlitePath,
          storagePath,
          refreshInterval: process.env.REFRESH_INTERVAL || '86400'
        }
      });

    } catch (error) {
      this.results.push({
        name: "Environment Variables",
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testDirectoriesCreation(): Promise<void> {
    console.log("🔍 Test création des dossiers...");

    try {
      const storagePath = process.env.STORAGE_PATH || './storage/attachments';
      const dataPath = process.env.SQLITE_PATH?.split('/').slice(0, -1).join('/') || 'data';

      // Créer les dossiers s'ils n'existent pas
      await Bun.write(`${dataPath}/.gitkeep`, '');
      await Bun.write(`${storagePath}/.gitkeep`, '');

      this.results.push({
        name: "Directory Creation",
        success: true,
        data: { dataPath, storagePath }
      });

    } catch (error) {
      this.results.push({
        name: "Directory Creation",
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testSQLiteConnection(): Promise<void> {
    console.log("🔍 Test connexion SQLite...");

    try {
      const { sqliteService } = await import("./src/lib/sqlite/index");

      await sqliteService.connect();
      const isHealthy = await sqliteService.healthCheck();

      if (!isHealthy) {
        throw new Error("SQLite health check failed");
      }

      // Test d'écriture/lecture basique
      await sqliteService.setRecord("test_table", "test_record", {
        record_id: "test_record",
        test_data: "Hello SQLite"
      }, 1);

      const record = await sqliteService.getRecord("test_table", "test_record", 1);

      if (!record || record.test_data !== "Hello SQLite") {
        throw new Error("SQLite read/write test failed");
      }

      this.results.push({
        name: "SQLite Connection",
        success: true,
        data: { record }
      });

    } catch (error) {
      this.results.push({
        name: "SQLite Connection",
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testAPIEndpoints(): Promise<void> {
    console.log("🔍 Test endpoints API...");

    const endpoints = [
      { path: "/api/tables", method: "GET", needsAuth: true },
      { path: "/api/stats", method: "GET", needsAuth: true }
    ];

    for (const endpoint of endpoints) {
      try {
        const headers: Record<string, string> = {};
        if (endpoint.needsAuth) {
          headers["Authorization"] = `Bearer ${BEARER_TOKEN}`;
        }

        const response = await fetch(`${API_BASE}${endpoint.path}`, {
          method: endpoint.method,
          headers
        });

        const data = await response.json();

        if (response.ok && data.success) {
          this.results.push({
            name: `API ${endpoint.method} ${endpoint.path}`,
            success: true,
            data: { status: response.status }
          });
        } else {
          throw new Error(`API call failed: ${data.message || 'Unknown error'}`);
        }

      } catch (error) {
        this.results.push({
          name: `API ${endpoint.method} ${endpoint.path}`,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async testWorkerFunctionality(): Promise<void> {
    console.log("🔍 Test fonctionnalité worker...");

    try {
      // Test du refresh manuel via API
      const response = await fetch(`${API_BASE}/api/refresh`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BEARER_TOKEN}`
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.results.push({
          name: "Worker Manual Refresh",
          success: true,
          data: data.data
        });
      } else {
        throw new Error(`Manual refresh failed: ${data.message || 'Unknown error'}`);
      }

    } catch (error) {
      this.results.push({
        name: "Worker Manual Refresh",
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private printResults(): void {
    console.log("\n📊 Résultats des tests");
    console.log("======================");

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;

    console.log(`\n✅ Tests réussis: ${passed}/${total}`);

    for (const result of this.results) {
      const icon = result.success ? "✅" : "❌";
      console.log(`${icon} ${result.name}`);

      if (!result.success && result.error) {
        console.log(`   Erreur: ${result.error}`);
      }
    }

    if (passed === total) {
      console.log("\n🎉 Tous les tests sont passés ! Le déploiement SQLite est prêt.");
      console.log("\n📋 Étapes suivantes pour Railway:");
      console.log("   1. git add .");
      console.log("   2. git commit -m 'Migration vers SQLite - réduction des coûts'");
      console.log("   3. git push origin main");
      console.log("   4. Supprimer le service Redis dans Railway dashboard");
      console.log("   5. Configurer les variables d'environnement Railway");
    } else {
      console.log(`\n⚠️ ${total - passed} test(s) échoué(s). Vérifier la configuration.`);
      process.exit(1);
    }
  }
}

// Exécution si appelé directement
if (import.meta.main) {
  console.log("⏳ Démarrage des tests dans 2 secondes...");
  await Bun.sleep(2000);

  const tester = new SQLiteDeploymentTest();
  await tester.runTests();
}

export { SQLiteDeploymentTest };