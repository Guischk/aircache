#!/usr/bin/env bun

/**
 * Démonstration rapide du système Aircache
 */

const API_BASE = "http://localhost:3000";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "demo-token";

console.log("🎯 Démonstration Aircache");
console.log("================================");

// Test de connectivité
try {
  console.log("🩺 Health check...");
  const healthResponse = await fetch(`${API_BASE}/health`);
  const health = await healthResponse.json();

  if (health.success) {
    console.log(`✅ Système ${health.data.status}`);
    console.log(`   • Redis: ${health.data.services.redis ? "✅" : "❌"}`);
    console.log(`   • Uptime: ${Math.round(health.data.uptime)}s`);
  } else {
    console.log("❌ Health check failed");
  }

  // Test API avec auth
  console.log("\n📋 Tables disponibles...");
  const tablesResponse = await fetch(`${API_BASE}/api/tables`, {
    headers: { "Authorization": `Bearer ${BEARER_TOKEN}` }
  });

  if (tablesResponse.ok) {
    const tables = await tablesResponse.json();
    console.log(`✅ ${tables.data.tables.length} tables trouvées`);
    console.log(`   • Namespace: ${tables.meta.namespace}`);
    tables.data.tables.slice(0, 3).forEach((table: string) => {
      console.log(`   • ${table}`);
    });
    if (tables.data.tables.length > 3) {
      console.log(`   • ... et ${tables.data.tables.length - 3} autres`);
    }
  } else {
    console.log("❌ Accès API échoué (vérifiez BEARER_TOKEN)");
  }

  // Test stats
  console.log("\n📊 Statistiques du cache...");
  const statsResponse = await fetch(`${API_BASE}/api/stats`, {
    headers: { "Authorization": `Bearer ${BEARER_TOKEN}` }
  });

  if (statsResponse.ok) {
    const stats = await statsResponse.json();
    console.log(`✅ Cache actif: ${stats.data.activeNamespace}`);
    console.log(`   • Total records: ${stats.data.totalRecords}`);
    console.log(`   • Tables: ${stats.data.totalTables}`);
  }

  console.log("\n🎉 Démonstration terminée !");
  console.log("📖 Voir README.md pour plus d'informations");

} catch (error) {
  console.log("❌ Erreur:", error);
  console.log("\n💡 Assurez-vous que:");
  console.log("   • Le serveur est démarré (bun index.ts)");
  console.log("   • Les variables d'environnement sont configurées");
  console.log("   • Redis est accessible");
}

export {};