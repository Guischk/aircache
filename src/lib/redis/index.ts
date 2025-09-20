import { redis as bunRedis, RedisClient } from "bun";

/**
 * Configuration du client Redis centralisé pour le cache Airtable
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
      console.log(" Redis connecté:", process.env.REDIS_URL || "redis://localhost:6379");
    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;

      console.error(`L Erreur connexion Redis (tentative ${this.connectionRetries}/${this.maxRetries}):`, error);

      if (this.connectionRetries < this.maxRetries) {
        console.log(`= Retry connexion Redis dans 2s...`);
        await Bun.sleep(2000);
        return this.connect();
      } else {
        throw new Error(`Impossible de se connecter à Redis après ${this.maxRetries} tentatives`);
      }
    }
  }

  /**
   * Vérifie l'état de la connexion
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
   * Wrapper sécurisé pour les opérations Redis avec retry automatique
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
        console.error(`L Échec retry pour "${operationName}":`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * Accès au client Redis natif de Bun
   */
  get native() {
    return this.client;
  }

  /**
   * Méthodes Redis les plus utilisées avec gestion d'erreurs
   */
  async get(key: string): Promise<string | null> {
    return this.safeOperation(
      () => this.client.get(key),
      `GET ${key}`
    );
  }

  async set(key: string, value: string, options?: { ttl?: number }): Promise<void> {
    return this.safeOperation(async () => {
      await this.client.set(key, value);
      if (options?.ttl) {
        await this.client.expire(key, options.ttl);
      }
    }, `SET ${key}`);
  }

  async del(key: string): Promise<void> {
    return this.safeOperation(
      () => this.client.del(key),
      `DEL ${key}`
    );
  }

  async expire(key: string, seconds: number): Promise<void> {
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
}

// Instance singleton du service Redis
export const redisService = new RedisService();

// Export du client natif pour les cas avancés
export const redis = redisService.native;

// Export du service pour les opérations sécurisées
export { redisService as RedisService };

// Types pour TypeScript
export type { RedisClient };