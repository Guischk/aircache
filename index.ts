import { startApiServer } from "./src/api/index";

const refreshInterval = parseInt(process.env.REFRESH_INTERVAL || "5400");
const apiPort = parseInt(process.env.PORT || "3000");

console.log("🚀 Démarrage du service Airtable Cacher");

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
