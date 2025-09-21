/**
 * Helpers SQLite équivalents aux helpers Redis
 * Maintient la même interface pour faciliter la migration
 */

import { sqliteService, type ActiveVersion } from "./index";

/**
 * Equivalent de withLock pour SQLite
 * Utilise une table de locks dans la base active
 */
export async function withLock<T>(
  name: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    console.log(`🔒 Tentative d'acquisition du lock: ${name}`);

    const lockId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    // Tentative d'acquisition du lock sur la base active
    const acquired = await sqliteService.transaction(() => {
      if (!sqliteService['activeDb']) return false;

      // Nettoyer les locks expirés d'abord
      sqliteService['activeDb'].prepare(`
        DELETE FROM locks WHERE expires_at <= CURRENT_TIMESTAMP
      `).run();

      // Vérifier si le lock existe déjà
      const existingLock = sqliteService['activeDb'].prepare(`
        SELECT name FROM locks WHERE name = ? AND expires_at > CURRENT_TIMESTAMP
      `).get(name);

      if (existingLock) {
        return false; // Lock déjà pris
      }

      // Acquérir le lock
      sqliteService['activeDb'].prepare(`
        INSERT OR REPLACE INTO locks (name, lock_id, expires_at)
        VALUES (?, ?, ?)
      `).run(name, lockId, expiresAt);

      return true;
    });

    if (!acquired) {
      console.log(`⏸️ Lock ${name} déjà pris, skip`);
      return null;
    }

    console.log(`✅ Lock ${name} acquis pour ${ttl}s`);

    try {
      // Exécuter la fonction
      const result = await fn();
      console.log(`🏁 Lock ${name} - opération terminée avec succès`);
      return result;
    } finally {
      // Libérer le lock
      try {
        await sqliteService.transaction(() => {
          if (!sqliteService['activeDb']) return;
          sqliteService['activeDb'].prepare(`
            DELETE FROM locks WHERE name = ? AND lock_id = ?
          `).run(name, lockId);
        });
        console.log(`🔓 Lock ${name} libéré`);
      } catch (unlockError) {
        console.error(`⚠️ Erreur lors de la libération du lock ${name}:`, unlockError);
      }
    }

  } catch (error) {
    console.error(`❌ Erreur dans withLock "${name}":`, error);
    throw error;
  }
}

// Les fonctions ensureLocksTable et cleanExpiredLocks ne sont plus nécessaires
// car le schéma est créé automatiquement et le cleanup est fait inline

/**
 * Récupère la version active (équivalent getActiveNamespace)
 */
export async function getActiveVersion(): Promise<ActiveVersion> {
  return await sqliteService.getActiveVersion();
}

/**
 * Récupère la version inactive
 */
export async function getInactiveVersion(): Promise<ActiveVersion> {
  return await sqliteService.getInactiveVersion();
}

/**
 * Bascule vers la version inactive (équivalent flipActiveNS)
 */
export async function flipActiveVersion(): Promise<ActiveVersion> {
  return await sqliteService.flipActiveVersion();
}

/**
 * Équivalent keyRecord - génère un identifiant unique pour un record
 */
export function recordKey(tableNorm: string, recordId: string): string {
  return `${tableNorm}:${recordId}`;
}

/**
 * Stocke un record (équivalent Redis SET)
 * useInactive: true pour stocker dans la base inactive (refresh)
 */
export async function setRecord(
  tableNorm: string,
  recordId: string,
  data: any,
  useInactive: boolean = false
): Promise<void> {
  await sqliteService.setRecord(tableNorm, recordId, data, useInactive);
}

/**
 * Récupère un record (équivalent Redis GET)
 */
export async function getRecord(
  tableNorm: string,
  recordId: string,
  useInactive: boolean = false
): Promise<any | null> {
  return await sqliteService.getRecord(tableNorm, recordId, useInactive);
}

/**
 * Récupère tous les records d'une table (équivalent Redis SMEMBERS + MGET)
 */
export async function getTableRecords(
  tableNorm: string,
  useInactive: boolean = false,
  limit?: number,
  offset?: number
): Promise<any[]> {
  return await sqliteService.getTableRecords(tableNorm, useInactive, limit, offset);
}

/**
 * Compte les records d'une table (équivalent Redis SCARD)
 */
export async function countTableRecords(
  tableNorm: string,
  useInactive: boolean = false
): Promise<number> {
  return await sqliteService.countTableRecords(tableNorm, useInactive);
}

/**
 * Récupère la liste des tables (équivalent Redis SMEMBERS sur keyTables)
 */
export async function getTables(useInactive: boolean = false): Promise<string[]> {
  return await sqliteService.getTables(useInactive);
}

/**
 * Vide la base inactive (équivalent au nettoyage Redis)
 */
export async function clearVersion(): Promise<void> {
  await sqliteService.clearInactiveDatabase();
}

/**
 * Marque un attachment comme téléchargé avec son chemin local
 */
export async function setAttachmentLocalPath(id: string, localPath: string): Promise<void> {
  await sqliteService.setAttachmentLocalPath(id, localPath);
}

/**
 * Récupère un attachment
 */
export async function getAttachment(id: string) {
  return await sqliteService.getAttachment(id);
}

/**
 * Récupère tous les attachments d'un record
 */
export async function getRecordAttachments(tableName: string, recordId: string, useInactive: boolean = false) {
  return await sqliteService.getRecordAttachments(tableName, recordId, useInactive);
}

/**
 * Récupère tous les attachments en attente de téléchargement
 */
export async function getPendingAttachments(useInactive: boolean = false) {
  return await sqliteService.getPendingAttachments(useInactive);
}

/**
 * Marque un attachment comme téléchargé
 */
export async function markAttachmentDownloaded(id: string, localPath: string, size?: number): Promise<void> {
  await sqliteService.markAttachmentDownloaded(id, localPath, size);
}

/**
 * Statistiques globales du cache
 */
export async function getCacheStats() {
  const stats = await sqliteService.getStats();
  const tables = await getTables();

  // Statistiques détaillées par table
  const tableStats = [];
  for (const table of tables) {
    const count = await countTableRecords(table);
    tableStats.push({ name: table, recordCount: count });
  }

  return {
    activeVersion: await getActiveVersion(),
    totalTables: stats.totalTables,
    totalRecords: stats.totalRecords,
    dbSize: stats.dbSize,
    tables: tableStats
  };
}