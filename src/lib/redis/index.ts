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
}

// Instance singleton du service Redis
export const redisService = new RedisService();

// Export du client natif pour les cas avanc�s
export const redis = redisService.native;

// Export du service pour les op�rations s�curis�es
export { redisService as RedisService };

// Types pour TypeScript
export type { RedisClient };