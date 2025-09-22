/**
 * SQLite helper functions for database operations
 * Provides high-level interface for cache management
 */

import { type ActiveVersion, sqliteService } from "./index";

/**
 * Implements distributed locking using SQLite
 * Uses a locks table in the active database
 */
export async function withLock<T>(
	name: string,
	ttl: number,
	fn: () => Promise<T>,
): Promise<T | null> {
	try {
		console.log(`🔒 Attempting to acquire lock: ${name}`);

		const lockId = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

		// Attempt to acquire lock on active database
		const acquired = await sqliteService.transaction(() => {
			if (!sqliteService["activeDb"]) return false;

			// Clean up expired locks first
			sqliteService["activeDb"]
				.prepare(`
        DELETE FROM locks WHERE expires_at <= CURRENT_TIMESTAMP
      `)
				.run();

			// Check if lock already exists
			const existingLock = sqliteService["activeDb"]
				.prepare(`
        SELECT name FROM locks WHERE name = ? AND expires_at > CURRENT_TIMESTAMP
      `)
				.get(name);

			if (existingLock) {
				return false; // Lock already taken
			}

			// Acquire the lock
			sqliteService["activeDb"]
				.prepare(`
        INSERT OR REPLACE INTO locks (name, lock_id, expires_at)
        VALUES (?, ?, ?)
      `)
				.run(name, lockId, expiresAt);

			return true;
		});

		if (!acquired) {
			console.log(`⏸️ Lock ${name} already taken, skipping`);
			return null;
		}

		console.log(`✅ Lock ${name} acquired for ${ttl}s`);

		try {
			// Execute the function
			const result = await fn();
			console.log(`🏁 Lock ${name} - operation completed successfully`);
			return result;
		} finally {
			// Release the lock
			try {
				await sqliteService.transaction(() => {
					if (!sqliteService["activeDb"]) return;
					sqliteService["activeDb"]
						.prepare(`
            DELETE FROM locks WHERE name = ? AND lock_id = ?
          `)
						.run(name, lockId);
				});
				console.log(`🔓 Lock ${name} released`);
			} catch (unlockError) {
				console.error(`⚠️ Error releasing lock ${name}:`, unlockError);
			}
		}
	} catch (error) {
		console.error(`❌ Error in withLock "${name}":`, error);
		throw error;
	}
}

// Functions ensureLocksTable and cleanExpiredLocks are no longer needed
// as schema is created automatically and cleanup is done inline

/**
 * Gets the active version (equivalent to getActiveNamespace)
 */
export async function getActiveVersion(): Promise<ActiveVersion> {
	return await sqliteService.getActiveVersion();
}

/**
 * Gets the inactive version
 */
export async function getInactiveVersion(): Promise<ActiveVersion> {
	return await sqliteService.getInactiveVersion();
}

/**
 * Switches to the inactive version (equivalent to flipActiveNS)
 */
export async function flipActiveVersion(): Promise<ActiveVersion> {
	return await sqliteService.flipActiveVersion();
}

/**
 * Equivalent to keyRecord - generates a unique identifier for a record
 */
export function recordKey(tableNorm: string, recordId: string): string {
	return `${tableNorm}:${recordId}`;
}

/**
 * Stores a record (equivalent to Redis SET)
 * useInactive: true to store in inactive database (refresh)
 */
export async function setRecord(
	tableNorm: string,
	recordId: string,
	data: any,
	useInactive = false,
): Promise<void> {
	await sqliteService.setRecord(tableNorm, recordId, data, useInactive);
}

/**
 * Retrieves a record (equivalent to Redis GET)
 */
export async function getRecord(
	tableNorm: string,
	recordId: string,
	useInactive = false,
): Promise<any | null> {
	return await sqliteService.getRecord(tableNorm, recordId, useInactive);
}

/**
 * Retrieves all records from a table (equivalent to Redis SMEMBERS + MGET)
 */
export async function getTableRecords(
	tableNorm: string,
	useInactive = false,
	limit?: number,
	offset?: number,
): Promise<any[]> {
	return await sqliteService.getTableRecords(
		tableNorm,
		useInactive,
		limit,
		offset,
	);
}

/**
 * Counts records in a table (equivalent to Redis SCARD)
 */
export async function countTableRecords(
	tableNorm: string,
	useInactive = false,
): Promise<number> {
	return await sqliteService.countTableRecords(tableNorm, useInactive);
}

/**
 * Retrieves the list of tables (equivalent to Redis SMEMBERS on keyTables)
 */
export async function getTables(useInactive = false): Promise<string[]> {
	return await sqliteService.getTables(useInactive);
}

/**
 * Clears the inactive database (equivalent to Redis cleanup)
 */
export async function clearVersion(): Promise<void> {
	await sqliteService.clearInactiveDatabase();
}

/**
 * Marks an attachment as downloaded with its local path
 */
export async function setAttachmentLocalPath(
	id: string,
	localPath: string,
): Promise<void> {
	await sqliteService.setAttachmentLocalPath(id, localPath);
}

/**
 * Retrieves an attachment
 */
export async function getAttachment(id: string) {
	return await sqliteService.getAttachment(id);
}

/**
 * Retrieves all attachments for a record
 */
export async function getRecordAttachments(
	tableName: string,
	recordId: string,
	useInactive = false,
) {
	return await sqliteService.getRecordAttachments(
		tableName,
		recordId,
		useInactive,
	);
}

/**
 * Retrieves all attachments pending download
 */
export async function getPendingAttachments(useInactive = false) {
	return await sqliteService.getPendingAttachments(useInactive);
}

/**
 * Marks an attachment as downloaded
 */
export async function markAttachmentDownloaded(
	id: string,
	localPath: string,
	size?: number,
): Promise<void> {
	await sqliteService.markAttachmentDownloaded(id, localPath, size);
}

/**
 * Global cache statistics
 */
export async function getCacheStats() {
	const stats = await sqliteService.getStats();
	const tables = await getTables();

	// Detailed statistics by table
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
		tables: tableStats,
	};
}
