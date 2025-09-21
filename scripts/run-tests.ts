#!/usr/bin/env bun

/**
 * Script principal pour lancer tous les tests du projet
 */

import { spawn } from "bun";
import { runIntegrationTests } from "./tests/integration.test";

console.log("🚀 Aircache - Test Suite");
console.log("===============================");

// Vérifier les variables d'environnement
const requiredEnv = ["BEARER_TOKEN", "REDIS_URL", "AIRTABLE_PERSONAL_TOKEN", "AIRTABLE_BASE_ID"];
const missing = requiredEnv.filter(env => !process.env[env]);

if (missing.length > 0) {
  console.log("❌ Variables d'environnement manquantes:");
  missing.forEach(env => console.log(`   - ${env}`));
  console.log("\nVeuillez configurer votre .env avant de lancer les tests.");
  process.exit(1);
}

console.log("✅ Variables d'environnement configurées");

// Démarrer le serveur en arrière-plan
console.log("\n🔄 Démarrage du serveur...");
const serverProcess = spawn({
  cmd: ["bun", "index.ts"],
  stdout: "pipe",
  stderr: "pipe"
});

// Attendre que le serveur soit prêt
console.log("⏳ Attente du démarrage du serveur (10s)...");
await Bun.sleep(10000);

try {
  // Test de connectivité du serveur
  console.log("🧪 Test de connectivité du serveur...");
  const response = await fetch("http://localhost:3000/health");

  if (!response.ok) {
    throw new Error(`Serveur non accessible: ${response.status}`);
  }

  console.log("✅ Serveur accessible");

  // Lancer les tests d'intégration
  console.log("\n🧪 Lancement des tests d'intégration...");
  await runIntegrationTests();

  // Lancer les tests API (Bun test)
  console.log("\n🧪 Lancement des tests unitaires API...");
  const apiTestProcess = spawn({
    cmd: ["bun", "test", "tests/api.test.ts"],
    stdout: "inherit",
    stderr: "inherit"
  });

  const apiTestResult = await apiTestProcess.exited;

  if (apiTestResult !== 0) {
    console.log("❌ Tests API échoués");
  } else {
    console.log("✅ Tests API réussis");
  }

  // Lancer le benchmark de performances
  console.log("\n🏁 Lancement du benchmark de performances...");
  const perfProcess = spawn({
    cmd: ["bun", "tests/performance.test.ts"],
    stdout: "inherit",
    stderr: "inherit"
  });

  await perfProcess.exited;

  console.log("\n" + "=".repeat(50));
  console.log("🎯 TOUS LES TESTS TERMINÉS");
  console.log("=".repeat(50));

  console.log("📝 Rapports générés:");
  console.log("   - integration-report.md - Tests d'intégration");
  console.log("   - performance-report.md - Benchmark de performances");

  console.log("\n🎉 Suite de tests complétée!");

} catch (error) {
  console.error("\n❌ Erreur lors des tests:", error);
  process.exit(1);

} finally {
  // Arrêter le serveur
  console.log("\n🔄 Arrêt du serveur...");
  serverProcess.kill();
  await Bun.sleep(2000);
}

export {};