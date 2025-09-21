/**
 * Point d'entrée unifié du serveur Aircache
 * Détecte automatiquement le backend (Redis/SQLite) à utiliser
 */

export type BackendType = 'redis' | 'sqlite';

export interface ServerConfig {
  backend: BackendType;
  port: number;
  refreshInterval: number;
}

export function detectBackend(): BackendType {
  // Si Redis URL est défini, utiliser Redis, sinon SQLite
  if (process.env.REDIS_URL && process.env.REDIS_URL !== '') {
    return 'redis';
  }
  return 'sqlite';
}

export function getServerConfig(): ServerConfig {
  const backend = detectBackend();

  return {
    backend,
    port: parseInt(process.env.PORT || "3000"),
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL || (backend === 'sqlite' ? "86400" : "5400"))
  };
}

export async function startServer(config?: Partial<ServerConfig>): Promise<void> {
  const fullConfig = { ...getServerConfig(), ...config };

  console.log(`🚀 Démarrage du service Aircache (${fullConfig.backend.toUpperCase()})`);
  console.log(`📊 Port: ${fullConfig.port}`);
  console.log(`⏰ Refresh: ${fullConfig.refreshInterval}s`);

  if (fullConfig.backend === 'sqlite') {
    await startSQLiteServer(fullConfig);
  } else {
    await startRedisServer(fullConfig);
  }
}

async function startSQLiteServer(config: ServerConfig): Promise<void> {
  const { startSQLiteApiServer } = await import("../api/sqlite-server");

  console.log("🔄 Démarrage du worker SQLite...");

  const worker = new Worker("src/worker/index.ts", {
    workerData: { backend: 'sqlite' }
  });

  worker.onmessage = (e) => {
    if (e.data?.type === "refresh:done") {
      console.log("✅ Refresh terminé:", e.data.stats);
    } else if (e.data?.type === "refresh:error") {
      console.error("❌ Erreur refresh:", e.data.error);
    } else {
      console.log("📨 Worker SQLite:", e.data);
    }
  };

  worker.onerror = (error) => {
    console.error("❌ Erreur Worker SQLite:", error);
  };

  // Démarrage du serveur API
  await startSQLiteApiServer(config.port, worker);

  // Premier refresh au démarrage
  console.log("🔄 Premier refresh au démarrage...");
  worker.postMessage({ type: "refresh:start" });

  // Refresh périodique
  setInterval(() => {
    console.log("⏰ Refresh périodique déclenché");
    worker.postMessage({ type: "refresh:start" });
  }, config.refreshInterval * 1000);

  console.log(`⏰ Refresh programmé toutes les ${config.refreshInterval/3600} heures`);
  console.log(`✅ Service SQLite complet démarré !`);
  console.log(`📊 Base de données: data/aircache.db`);
  console.log(`📎 Attachments: ${process.env.STORAGE_PATH || './data/attachments'}`);

  setupGracefulShutdown(worker, 'sqlite');
}

async function startRedisServer(config: ServerConfig): Promise<void> {
  const { startApiServer } = await import("../api/index");

  // Démarrage du serveur API
  await startApiServer(config.port);

  // Démarrage du worker de cache
  console.log("🔄 Démarrage du worker Redis...");

  const worker = new Worker("src/worker/index.ts", {
    workerData: { backend: 'redis' }
  });

  worker.onmessage = (e) => {
    console.log("📨 Worker Redis:", e.data);
  };

  worker.onerror = (error) => {
    console.error("❌ Erreur Worker Redis:", error);
  };

  // Premier refresh au démarrage
  worker.postMessage({ type: "refresh:start" });

  // Refresh périodique
  setInterval(() => {
    worker.postMessage({ type: "refresh:start" });
  }, config.refreshInterval * 1000);

  console.log(`⏰ Refresh programmé toutes les ${config.refreshInterval} secondes`);
  console.log(`✅ Service Redis complet démarré !`);

  setupGracefulShutdown(worker, 'redis');
}

function setupGracefulShutdown(worker: Worker, backend: BackendType): void {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Arrêt ${signal}...`);

    try {
      worker.terminate();

      if (backend === 'sqlite') {
        const { sqliteService } = await import("../lib/sqlite/index");
        await sqliteService.close();
      } else {
        const { redisService } = await import("../lib/redis/index");
        await redisService.close();
      }

      console.log('✅ Service arrêté proprement');
      process.exit(0);
    } catch (error) {
      console.error('❌ Erreur lors de l\'arrêt:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('gracieux'));
  process.on('SIGTERM', () => shutdown('demandé'));
}