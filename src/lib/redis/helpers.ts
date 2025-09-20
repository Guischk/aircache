import { redisService } from "./index";

type ActiveNamespace = "v1" | "v2";

/**
 * Generates a Redis key for table index storage
 *
 * This key is used to store a ZSET (sorted set) containing all record IDs for a table.
 * The score in the ZSET represents the creation or update timestamp of each record,
 * allowing for efficient time-based queries and ordering.
 *
 * @param table - The name of the database table
 * @returns A normalized Redis key string for the table's index
 * @example
 * keyIndex("v1", "users") // Returns: "v1:tbl:users:idx" (normalized)
 */
export const keyIndex = (active: ActiveNamespace, table: string) =>
  `${active}:tbl:${table}:idx`; // ZSET des IDs (score = createdAt/updatedAt éventuels)

/**
 * Generates a Redis key for individual record storage
 *
 * This key is used to store the complete JSON representation of a single record
 * from a database table. Each record is stored as a JSON string under its unique key.
 *
 * @param table - The name of the database table
 * @param id - The unique identifier of the record
 * @returns A normalized Redis key string for the specific record
 * @example
 * keyRecord("v1", "users", "123") // Returns: "v1:tbl:users:rec:123" (normalized)
 */
export const keyRecord = (active: ActiveNamespace, table: string, id: string) =>
  `${active}:${table}:rec:${id}`; // JSON string

/**
 * Redis key for storing the list of available tables
 *
 * This key points to a SET containing the names of all database tables
 * that are currently being cached in Redis. Used for table discovery
 * and management operations.
 *
 * @type {string} A normalized Redis key string for the tables index
 * @example
 * // Used to store: SET { "v1:users", "v1:products", "v1:orders", ... }
 */
export const keyTables = (active: ActiveNamespace) => `${active}:tables:idx`; // SET des tables disponibles

/**
 * Generates a Redis key for table version/cache timestamp storage
 *
 * This key is used to store version information or cache timestamps for a table.
 * It helps determine when cached data should be invalidated or refreshed,
 * enabling efficient cache management strategies.
 *
 * @param table - The name of the database table
 * @returns A normalized Redis key string for the table's version info
 * @example
 * keyVersion("v1", "users") // Returns: "v1:tbl:users:ver" (normalized)
 */
export const keyVersion = (active: ActiveNamespace, table: string) =>
  `${active}:tbl:${table}:ver`; // version/cache stamp

export const inactiveOf = (active: ActiveNamespace) =>
  active === "v2" ? "v1" : "v2";

export async function flipActiveNS(target: ActiveNamespace): Promise<void> {
  try {
    // On change le pointeur actif
    await redisService.set("active_ns", target);
    console.log(`🔄 Namespace actif basculé vers: ${target}`);
  } catch (error) {
    console.error("❌ Erreur lors du basculement de namespace:", error);
    throw new Error(`Impossible de basculer vers ${target}: ${error}`);
  }
}

// Lock simple (SET NX PX) avec gestion d'erreurs améliorée
export async function withLock<T>(
  name: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const lockKey = `lock:${name}`;
  const token = crypto.randomUUID();

  try {
    console.log(`🔒 Tentative d'acquisition du lock: ${name}`);

    // Tentative d'acquisition du lock
    const lockResult = await redisService.native.set(lockKey, token, "NX");
    if (lockResult !== "OK") {
      console.log(`⏸️ Lock ${name} déjà pris, skip`);
      return null;
    }

    // Définir le TTL pour éviter les locks orphelins
    await redisService.expire(lockKey, ttl);
    console.log(`✅ Lock ${name} acquis pour ${ttl}s`);

    // Exécuter la fonction
    const result = await fn();
    console.log(`🏁 Lock ${name} - opération terminée avec succès`);
    return result;

  } catch (error) {
    console.error(`❌ Erreur dans withLock "${name}":`, error);
    throw error;
  } finally {
    // Libération du lock uniquement si c'est notre token
    try {
      const currentLockValue = await redisService.get(lockKey);
      if (currentLockValue === token) {
        await redisService.del(lockKey);
        console.log(`🔓 Lock ${name} libéré`);
      }
    } catch (unlockError) {
      console.error(`⚠️ Erreur lors de la libération du lock ${name}:`, unlockError);
      // On ne throw pas ici pour ne pas masquer l'erreur principale
    }
  }
}

/**
 * Fonction utilitaire pour obtenir le namespace actif
 */
export async function getActiveNamespace(): Promise<ActiveNamespace> {
  try {
    const active = await redisService.get("active_ns");
    const namespace = active === "v2" ? "v2" : "v1";
    console.log(`📍 Namespace actif: ${namespace}`);
    return namespace;
  } catch (error) {
    console.error("❌ Erreur lors de la récupération du namespace actif:", error);
    // Fallback sur v1 en cas d'erreur
    console.log("🔄 Fallback sur namespace v1");
    return "v1";
  }
}
