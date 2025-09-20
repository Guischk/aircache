import { startApiServer } from "./src/api/index";
import { updateSchemaWithRetry, validateSchema } from "./src/lib/airtable/schema-updater";

const refreshInterval = parseInt(process.env.REFRESH_INTERVAL || "5400");
const apiPort = parseInt(process.env.PORT || "3000");

console.log("🚀 Démarrage du service Aircache");

// 0. Génération du schéma Airtable au démarrage
console.log("📋 Génération du schéma Airtable au démarrage...");
const schemaGenerated = await updateSchemaWithRetry(2);
if (!schemaGenerated) {
  console.warn("⚠️ Échec génération schéma, vérification du schéma existant...");
  const schemaExists = await validateSchema();
  if (!schemaExists) {
    console.error("❌ Aucun schéma Airtable valide trouvé. Vérifiez vos variables d'environnement AIRTABLE_API_KEY et AIRTABLE_BASE_ID");
    process.exit(1);
  }
} else {
  console.log("✅ Schéma Airtable généré avec succès au démarrage");
}

// 1. Démarrage du serveur API
await startApiServer(apiPort);

// 2. Démarrage du worker de cache
console.log("🔄 Démarrage du worker de cache...");

const worker = new Worker("src/worker/index.ts");

worker.onmessage = (e) => {
  console.log("📨 Worker:", e.data);
};

// Premier refresh au démarrage
worker.postMessage({ type: "refresh:start" });

// Refresh périodique
setInterval(() => {
  worker.postMessage({ type: "refresh:start" });
}, refreshInterval * 1000);

console.log(`⏰ Refresh programmé toutes les ${refreshInterval} secondes`);
console.log(`✅ Service complet démarré !`);
