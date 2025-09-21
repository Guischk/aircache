import { redis as bunRedis, RedisClient } from "bun";

/**
 * Configuration du client Redis centralis� pour le cache Airtable
 */
class RedisService {
  private client: typeof bunRedis;
  private isConnected = false;
  private connectionRetries = 0;
  private maxRetries = 3;

  constructor() {
    this.client = bunRedis;
  }

  /**
   * Initialise la connexion Redis avec gestion d'erreurs
   */
  async connect(): Promise<void> {
    try {
      // Test de connexion simple
      await this.client.ping();
      this.isConnected = true;
      this.connectionRetries = 0;
      console.log(" Redis connect�:", process.env.REDIS_URL || "redis://localhost:6379");
    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;

      console.error(`L Erreur connexion Redis (tentative ${this.connectionRetries}/${this.maxRetries}):`, error);

      if (this.connectionRetries < this.maxRetries) {
        console.log(`= Retry connexion Redis dans 2s...`);
        await Bun.sleep(2000);
        return this.connect();
      } else {
        throw new Error(`Impossible de se connecter � Redis apr�s ${this.maxRetries} tentatives`);
      }
    }
  }

  /**
   * V�rifie l'�tat de la connexion
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error("L Redis health check failed:", error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Wrapper s�curis� pour les op�rations Redis avec retry automatique
   */
  async safeOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      return await operation();
    } catch (error) {
      console.error(`L Erreur Redis operation "${operationName}":`, error);

      // Tentative de reconnexion en cas d'erreur
      try {
        await this.connect();
        return await operation();
      } catch (retryError) {
        console.error(`L �chec retry pour "${operationName}":`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * Acc�s au client Redis natif de Bun
   */
  get native() {
    return this.client;
  }

  /**
   * M�thodes Redis les plus utilis�es avec gestion d'erreurs
   */
  async get(key: string): Promise<string | null> {
    return this.safeOperation(
      () => this.client.get(key),
      `GET ${key}`
    );
  }

  async set(key: string, value: string, options?: { ttl?: number }): Promise<void> {
    return this.safeOperation(async () => {
      if (options?.ttl) {
        await this.client.set(key, value, "EX", options.ttl);
      } else {
        await this.client.set(key, value);
      }
    }, `SET ${key}`);
  }

  async del(key: string): Promise<number> {
    return this.safeOperation(
      () => this.client.del(key),
      `DEL ${key}`
    );
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.safeOperation(
      () => this.client.expire(key, seconds),
      `EXPIRE ${key}`
    );
  }

  async ping(): Promise<string> {
    return this.safeOperation(
      () => this.client.ping(),
      "PING"
    );
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return this.safeOperation(
      () => this.client.mget(...keys),
      `MGET ${keys.length}`
    );
  }

  async smembers(key: string): Promise<string[]> {
    return this.safeOperation(
      () => this.client.smembers(key),
      `SMEMBERS ${key}`
    );
  }

  async sadd(key: string, member: string): Promise<void> {
    return this.safeOperation(
      async () => {
        await this.client.sadd(key, member);
      },
      `SADD ${key}`
    );
  }

  async scard(key: string): Promise<number> {
    return this.safeOperation(
      () => this.client.scard(key),
      `SCARD ${key}`
    );
  }

  // Méthodes pour compatibilité avec les backends
  async getTables(): Promise<string[]> {
    const { getActiveNamespace, keyTables } = await import("./helpers");
    const activeNS = await getActiveNamespace();
    const tablesKey = keyTables(activeNS);
    return this.smembers(tablesKey);
  }

  async getTableRecords(tableName: string, page: number = 1, limit: number = 100): Promise<any[]> {
    const { getActiveNamespace, keyIndex, keyRecord } = await import("./helpers");
    const activeNS = await getActiveNamespace();
    const indexKey = keyIndex(activeNS, tableName);

    // Récupérer les IDs avec pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    const recordIds = await this.safeOperation(
      () => this.client.zrange(indexKey, start, end),
      `ZRANGE ${indexKey}`
    );

    if (recordIds.length === 0) return [];

    // Récupérer les records en lot
    const recordKeys = recordIds.map(id => keyRecord(activeNS, tableName, id));
    const records = await this.mget(recordKeys);

    return records
      .filter(record => record !== null)
      .map(record => JSON.parse(record!));
  }

  async getRecord(tableName: string, recordId: string): Promise<any | null> {
    const { getActiveNamespace, keyRecord } = await import("./helpers");
    const activeNS = await getActiveNamespace();
    const recordKey = keyRecord(activeNS, tableName, recordId);
    const record = await this.get(recordKey);
    return record ? JSON.parse(record) : null;
  }

  async setRecord(tableName: string, recordId: string, data: any): Promise<void> {
    const { getActiveNamespace, keyRecord, keyIndex } = await import("./helpers");
    const activeNS = await getActiveNamespace();
    const recordKey = keyRecord(activeNS, tableName, recordId);
    const indexKey = keyIndex(activeNS, tableName);

    await Promise.all([
      this.set(recordKey, JSON.stringify(data)),
      this.safeOperation(
        () => this.client.zadd(indexKey, Date.now(), recordId),
        `ZADD ${indexKey}`
      )
    ]);
  }

  async setTableIndex(tableName: string, recordIds: string[]): Promise<void> {
    const { getActiveNamespace, keyIndex } = await import("./helpers");
    const activeNS = await getActiveNamespace();
    const indexKey = keyIndex(activeNS, tableName);

    // Clear existing index
    await this.del(indexKey);

    // Add all record IDs
    if (recordIds.length > 0) {
      const args = [];
      for (let i = 0; i < recordIds.length; i++) {
        args.push(Date.now() + i, recordIds[i]);
      }
      await this.safeOperation(
        () => this.client.zadd(indexKey, ...args),
        `ZADD ${indexKey} bulk`
      );
    }
  }

  async setTables(tableNames: string[]): Promise<void> {
    const { getActiveNamespace, keyTables } = await import("./helpers");
    const activeNS = await getActiveNamespace();
    const tablesKey = keyTables(activeNS);

    // Clear existing tables set
    await this.del(tablesKey);

    // Add all table names
    for (const tableName of tableNames) {
      await this.sadd(tablesKey, tableName);
    }
  }

  async getActiveNamespace(): Promise<string> {
    const { getActiveNamespace } = await import("./helpers");
    return getActiveNamespace();
  }

  async getInactiveNamespace(): Promise<string> {
    const { getActiveNamespace, inactiveOf } = await import("./helpers");
    const active = await getActiveNamespace();
    return inactiveOf(active);
  }

  async flipActiveNamespace(): Promise<void> {
    const { flipActiveNS } = await import("./helpers");
    const inactive = await this.getInactiveNamespace();
    await flipActiveNS(inactive);
  }

  async getStats(): Promise<any> {
    const activeNS = await this.getActiveNamespace();
    const tables = await this.getTables();

    let totalRecords = 0;
    for (const table of tables) {
      const { keyIndex } = await import("./helpers");
      const indexKey = keyIndex(activeNS, table);
      const count = await this.scard(indexKey);
      totalRecords += count;
    }

    return {
      activeNamespace: activeNS,
      tables: tables.length,
      totalRecords,
      lastUpdate: new Date().toISOString()
    };
  }

  async close(): Promise<void> {
    this.isConnected = false;
    console.log("🔄 Connexion Redis fermée");
  }
}

// Instance singleton du service Redis
export const redisService = new RedisService();

// Export du client natif pour les cas avanc�s
export const redis = redisService.native;

// Export du service pour les op�rations s�curis�es
export { redisService as RedisService };

// Export des helpers pour compatibilit�
export { withLock, getActiveNamespace, flipActiveNS, inactiveOf } from "./helpers";

// Types pour TypeScript
export type { RedisClient };