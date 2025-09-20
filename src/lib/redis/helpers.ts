import { redis } from "bun";

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

export async function flipActiveNS(target: ActiveNamespace) {
  // On change le pointeur actif
  redis.set("active_ns", target);
}

// Lock simple (SET NX PX)
export async function withLock<T>(
  name: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const token = crypto.randomUUID();
  const ok = await redis.set(`lock:${name}`, token, "NX");
  if (ok !== "OK") return null;
  await redis.expire(`lock:${name}`, ttl);
  try {
    return await fn();
  } finally {
    const v = await redis.get(`lock:${name}`);
    if (v === token) await redis.del(`lock:${name}`);
  }
}
