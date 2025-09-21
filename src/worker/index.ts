/**
 * SQLite worker for data synchronization
 */

import { SQLiteBackend } from "./backends/sqlite-backend";

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

class SQLiteWorker {
  private backend: SQLiteBackend;
  private isRefreshing = false;

  constructor() {
    this.backend = new SQLiteBackend();
    console.log("🔧 [Worker] Initialized with SQLite backend");
  }

  async handleMessage(message: WorkerMessage): Promise<void> {
    console.log(`📨 [Worker] Message received:`, message);

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
        console.warn(`⚠️ [Worker] Unknown message:`, message);
    }
  }

  private async handleRefreshStart(manual = false): Promise<void> {
    if (this.isRefreshing) {
      console.log("⏭️ [Worker] Refresh already in progress, skipped");
      return;
    }

    this.isRefreshing = true;

    try {
      console.log(`🚀 [Worker] Starting ${manual ? 'manual' : 'automatic'} refresh`);

      const stats = await this.backend.refreshData();

      this.postMessage({
        type: 'refresh:done',
        stats,
        manual
      });

    } catch (error) {
      console.error("❌ [Worker] Error during refresh:", error);

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
      console.log("ℹ️ [Worker] No refresh in progress");
      return;
    }

    console.log("🛑 [Worker] Refresh stop requested");
    // Note: In a more advanced implementation, we could
    // implement cancellation logic
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
      console.error("❌ [Worker] Error retrieving stats:", error);

      this.postMessage({
        type: 'refresh:error',
        error: error instanceof Error ? error.message : 'Stats retrieval failed'
      });
    }
  }

  private postMessage(response: WorkerResponse): void {
    if (typeof self !== 'undefined' && self.postMessage) {
      // Web Worker context
      self.postMessage(response);
    } else {
      // Test or development context
      console.log("📤 [Worker] Response:", response);
    }
  }

  async close(): Promise<void> {
    console.log("🔄 [Worker] Closing...");

    if (this.isRefreshing) {
      console.log("⏳ [Worker] Waiting for refresh to complete...");
      // In a more advanced implementation, we would wait for refresh completion
    }

    await this.backend.close();
    console.log("✅ [Worker] Closed");
  }
}

// Worker execution context detection
let worker: SQLiteWorker;

// Worker initialization
function initializeWorker(): void {
  // Use SQLite as the only backend
  worker = new SQLiteWorker();
}

// Message handler for Web Worker
if (typeof self !== 'undefined' && self.onmessage !== undefined) {
  // Web Worker context
  initializeWorker();

  self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    if (worker) {
      await worker.handleMessage(event.data);
    }
  };

  self.onerror = (error) => {
    console.error("❌ [Worker] Global error:", error);
  };

  console.log("✅ [Worker] Ready to receive messages");
}

// Export for direct usage (tests, development)
export { SQLiteWorker };

// Auto-initialization if executed directly
if (import.meta.main) {
  console.log("🔧 [Worker] Direct execution for test");

  initializeWorker();

  // Basic test
  await worker.handleMessage({ type: 'refresh:start', manual: true });

  console.log("✅ [Worker] Test completed");
}