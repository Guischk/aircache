/**
 * Worker unifié pour la synchronisation Redis et SQLite
 */

import { SQLiteBackend } from "./backends/sqlite-backend";
import { RedisBackend } from "./backends/redis-backend";

export type WorkerBackend = 'redis' | 'sqlite';

export interface WorkerMessage {
  type: 'refresh:start' | 'refresh:stop' | 'stats:get';
  manual?: boolean;
}

export interface WorkerResponse {
  type: 'refresh:done' | 'refresh:error' | 'stats:response';
  stats?: any;
  error?: string;
  manual?: boolean;
}

class UnifiedWorker {
  private backend: SQLiteBackend | RedisBackend;
  private backendType: WorkerBackend;
  private isRefreshing = false;

  constructor(backendType: WorkerBackend) {
    this.backendType = backendType;

    if (backendType === 'sqlite') {
      this.backend = new SQLiteBackend();
    } else {
      this.backend = new RedisBackend();
    }

    console.log(`🔧 [Worker] Initialisé avec backend: ${backendType.toUpperCase()}`);
  }

  async handleMessage(message: WorkerMessage): Promise<void> {
    console.log(`📨 [Worker] Message reçu:`, message);

    switch (message.type) {
      case 'refresh:start':
        await this.handleRefreshStart(message.manual);
        break;

      case 'refresh:stop':
        await this.handleRefreshStop();
        break;

      case 'stats:get':
        await this.handleStatsGet();
        break;

      default:
        console.warn(`⚠️ [Worker] Message non reconnu:`, message);
    }
  }

  private async handleRefreshStart(manual = false): Promise<void> {
    if (this.isRefreshing) {
      console.log("⏭️ [Worker] Refresh déjà en cours, ignoré");
      return;
    }

    this.isRefreshing = true;

    try {
      console.log(`🚀 [Worker] Début du refresh ${manual ? 'manuel' : 'automatique'} (${this.backendType})`);

      const stats = await this.backend.refreshData();

      this.postMessage({
        type: 'refresh:done',
        stats,
        manual
      });

    } catch (error) {
      console.error("❌ [Worker] Erreur lors du refresh:", error);

      this.postMessage({
        type: 'refresh:error',
        error: error instanceof Error ? error.message : 'Unknown error',
        manual
      });

    } finally {
      this.isRefreshing = false;
    }
  }

  private async handleRefreshStop(): Promise<void> {
    if (!this.isRefreshing) {
      console.log("ℹ️ [Worker] Aucun refresh en cours");
      return;
    }

    console.log("🛑 [Worker] Arrêt du refresh demandé");
    // Note: Dans une implémentation plus avancée, on pourrait
    // implémenter une logique d'annulation
    this.isRefreshing = false;
  }

  private async handleStatsGet(): Promise<void> {
    try {
      const stats = await this.backend.getStats();

      this.postMessage({
        type: 'stats:response',
        stats
      });

    } catch (error) {
      console.error("❌ [Worker] Erreur lors de la récupération des stats:", error);

      this.postMessage({
        type: 'refresh:error',
        error: error instanceof Error ? error.message : 'Stats retrieval failed'
      });
    }
  }

  private postMessage(response: WorkerResponse): void {
    if (typeof self !== 'undefined' && self.postMessage) {
      // Context de Web Worker
      self.postMessage(response);
    } else {
      // Context de test ou développement
      console.log("📤 [Worker] Response:", response);
    }
  }

  async close(): Promise<void> {
    console.log("🔄 [Worker] Fermeture...");

    if (this.isRefreshing) {
      console.log("⏳ [Worker] Attente de la fin du refresh...");
      // Dans une implémentation plus avancée, on attendrait la fin du refresh
    }

    await this.backend.close();
    console.log("✅ [Worker] Fermé");
  }
}

// Détection du contexte d'exécution
let worker: UnifiedWorker;

// Initialisation du worker
function initializeWorker(): void {
  // Déterminer le backend depuis les données du worker ou l'environnement
  let backendType: WorkerBackend = 'sqlite'; // Par défaut

  if (typeof self !== 'undefined' && 'workerData' in self) {
    // Bun Worker context
    backendType = (self as any).workerData?.backend || 'sqlite';
  } else if (process.env.REDIS_URL && process.env.REDIS_URL !== '') {
    // Variable d'environnement Redis définie
    backendType = 'redis';
  }

  worker = new UnifiedWorker(backendType);
}

// Gestionnaire de messages pour Web Worker
if (typeof self !== 'undefined' && self.onmessage !== undefined) {
  // Context de Web Worker
  initializeWorker();

  self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    if (worker) {
      await worker.handleMessage(event.data);
    }
  };

  self.onerror = (error) => {
    console.error("❌ [Worker] Erreur globale:", error);
  };

  console.log("✅ [Worker] Prêt à recevoir des messages");
}

// Export pour usage direct (tests, développement)
export { UnifiedWorker };

// Auto-initialisation si exécuté directement
if (import.meta.main) {
  console.log("🔧 [Worker] Exécution directe pour test");

  initializeWorker();

  // Test basique
  await worker.handleMessage({ type: 'refresh:start', manual: true });

  console.log("✅ [Worker] Test terminé");
}