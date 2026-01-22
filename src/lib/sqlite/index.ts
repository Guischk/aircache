/**
 * SQLite service to replace Redis
 * Uses bun:sqlite with dual-database architecture (like Redis dual-namespace)
 */

import { Database } from "bun:sqlite";
import { join } from "path";

type ActiveVersion = "v1" | "v2";

interface AirtableRecord {
	id: string;
	table_name: string;
	record_id: string;
	data: string; // JSON stringified
	updated_at: string;
}

interface Attachment {
	id: string;
	table_name: string;
	record_id: string;
	field_name: string;
	original_url: string;
	local_path?: string;
	filename: string;
	size?: number;
	type?: string;
	downloaded_at?: string;
}

class SQLiteService {
	private activeDb: Database | null = null;
	private inactiveDb: Database | null = null;
	private v1Path: string;
	private v2Path: string;
	private metadataPath: string;
	private currentActive: ActiveVersion = "v1";

	// Expose databases for mapping sync (read-only access to internals)
	public get v1Db(): Database | null {
		return this.currentActive === "v1" ? this.activeDb : this.inactiveDb;
	}

	public get v2Db(): Database | null {
		return this.currentActive === "v2" ? this.activeDb : this.inactiveDb;
	}

	constructor(
		v1Path: string = process.env.SQLITE_V1_PATH || "data/aircache-v1.sqlite",
		v2Path: string = process.env.SQLITE_V2_PATH || "data/aircache-v2.sqlite",
		metadataPath: string = process.env.SQLITE_METADATA_PATH ||
			"data/metadata.sqlite",
	) {
		this.v1Path = v1Path;
		this.v2Path = v2Path;
		this.metadataPath = metadataPath;
	}

	/**
	 * Initialize databases (v1, v2 and metadata)
	 */
	async connect(): Promise<void> {
		try {
			// Create data folder if it doesn't exist
			const dbDir = this.v1Path.split("/").slice(0, -1).join("/");
			if (dbDir) {
				await Bun.write(join(dbDir, ".gitkeep"), "");
			}

			// Initialize metadata database
			const metadataDb = new Database(this.metadataPath);
			this.setupPragmas(metadataDb);
			await this.initializeMetadataSchema(metadataDb);

			// Retrieve active version from metadata
			this.currentActive = await this.loadActiveVersionFromMetadata(metadataDb);
			metadataDb.close();

			// Initialize both databases
			const v1Db = new Database(this.v1Path);
			const v2Db = new Database(this.v2Path);

			this.setupPragmas(v1Db);
			this.setupPragmas(v2Db);

			await this.initializeDataSchema(v1Db);
			await this.initializeDataSchema(v2Db);

			// Define which database is active/inactive
			if (this.currentActive === "v1") {
				this.activeDb = v1Db;
				this.inactiveDb = v2Db;
			} else {
				this.activeDb = v2Db;
				this.inactiveDb = v1Db;
			}

			console.log(`✅ SQLite connected - Active: ${this.currentActive}`);
			console.log(`📊 Databases: ${this.v1Path}, ${this.v2Path}`);
		} catch (error) {
			console.error("❌ SQLite connection error:", error);
			throw error;
		}
	}

	/**
	 * Configure pragmas to optimize performance
	 */
	private setupPragmas(db: Database): void {
		db.run("PRAGMA journal_mode = WAL");
		db.run("PRAGMA synchronous = NORMAL");
		db.run("PRAGMA cache_size = 1000");
		db.run("PRAGMA temp_store = memory");
	}

	/**
	 * Initialize metadata schema
	 */
	private async initializeMetadataSchema(db: Database): Promise<void> {
		// Table to store which version is active
		db.run(`
      CREATE TABLE IF NOT EXISTS active_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version TEXT NOT NULL DEFAULT 'v1',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Insert default version if it doesn't exist
		db.run(`
      INSERT OR IGNORE INTO active_version (id, version) VALUES (1, 'v1')
    `);
	}

	/**
	 * Initialize data schema (airtable_records + attachments)
	 */
	private async initializeDataSchema(db: Database): Promise<void> {
		// Centralized table for all Airtable records
		db.run(`
      CREATE TABLE IF NOT EXISTS airtable_records (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Index to optimize queries
		db.run(
			`CREATE INDEX IF NOT EXISTS idx_table_name ON airtable_records(table_name)`,
		);
		db.run(
			`CREATE INDEX IF NOT EXISTS idx_record_id ON airtable_records(record_id)`,
		);

		// Table for attachments
		db.run(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        original_url TEXT NOT NULL,
        local_path TEXT,
        filename TEXT NOT NULL,
        size INTEGER,
        type TEXT,
        downloaded_at DATETIME
      )
    `);

		// Index for attachments
		db.run(
			`CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(table_name, record_id)`,
		);
		db.run(
			`CREATE INDEX IF NOT EXISTS idx_attachments_pending ON attachments(local_path) WHERE local_path IS NULL`,
		);
		db.run(
			`CREATE INDEX IF NOT EXISTS idx_attachments_url ON attachments(original_url)`,
		);

		// Table for locks (in each database to avoid conflicts)
		db.run(`
      CREATE TABLE IF NOT EXISTS locks (
        name TEXT PRIMARY KEY,
        lock_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL
      )
    `);

		// Table for webhook tracking (idempotency)
		db.run(`
      CREATE TABLE IF NOT EXISTS processed_webhooks (
        webhook_id TEXT PRIMARY KEY,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        refresh_type TEXT NOT NULL,
        stats TEXT,
        expires_at DATETIME NOT NULL
      )
    `);

		db.run(`
      CREATE INDEX IF NOT EXISTS idx_processed_webhooks_expires 
      ON processed_webhooks(expires_at)
    `);

		// Table for metadata mappings (table ID to names)
		db.run(`
      CREATE TABLE IF NOT EXISTS metadata_mappings (
        table_id TEXT PRIMARY KEY,
        table_name_original TEXT NOT NULL,
        table_name_normalized TEXT NOT NULL,
        primary_field_id TEXT NOT NULL,
        fields_mapping TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(table_name_original),
        UNIQUE(table_name_normalized)
      )
    `);

		// Indexes for mapping lookups
		db.run(
			`CREATE INDEX IF NOT EXISTS idx_table_name_original ON metadata_mappings(table_name_original)`,
		);
		db.run(
			`CREATE INDEX IF NOT EXISTS idx_table_name_normalized ON metadata_mappings(table_name_normalized)`,
		);

		console.log("✅ Data schema initialized");
	}

	/**
	 * Load active version from metadata
	 */
	private async loadActiveVersionFromMetadata(
		metadataDb: Database,
	): Promise<ActiveVersion> {
		const result = metadataDb
			.prepare(`SELECT version FROM active_version WHERE id = 1`)
			.get() as { version: string } | undefined;

		return (result?.version as ActiveVersion) || "v1";
	}

	/**
	 * Check connection health
	 */
	async healthCheck(): Promise<boolean> {
		try {
			if (!this.activeDb || !this.inactiveDb) return false;
			this.activeDb.query("SELECT 1").get();
			this.inactiveDb.query("SELECT 1").get();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Store a record in the inactive database (during refresh)
	 */
	async setRecord(
		tableNorm: string,
		recordId: string,
		data: any,
		useInactive = false,
	): Promise<void> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const id = `${tableNorm}:${recordId}`;
		const dataStr = JSON.stringify(data);

		await this.transactionOn(db, async () => {
			if (!db) return;

			// Insert/update main record
			const recordStmt = db.prepare(`
        INSERT OR REPLACE INTO airtable_records (id, table_name, record_id, data, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
			recordStmt.run(id, tableNorm, recordId, dataStr);

			// Handle attachments if present
			const { extractAttachments } = await import("./schema-generator");
			const attachments = extractAttachments(recordId, data);

			if (attachments.length > 0) {
				// Delete old attachments for this record
				const deleteStmt = db.prepare(`
          DELETE FROM attachments WHERE table_name = ? AND record_id = ?
        `);
				deleteStmt.run(tableNorm, recordId);

				// Insert new attachments, preserving download info if attachment already exists
				const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO attachments
          (id, table_name, record_id, field_name, original_url, filename, size, type, local_path, downloaded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

				// Check for existing attachments with same URL to preserve download info
				const existingStmt = db.prepare(`
          SELECT local_path, downloaded_at FROM attachments
          WHERE original_url = ? AND local_path IS NOT NULL AND downloaded_at IS NOT NULL
          LIMIT 1
        `);

				for (const attachment of attachments) {
					// Check if this URL already exists with download info
					const existing = existingStmt.get(attachment.original_url) as
						| { local_path: string; downloaded_at: string }
						| undefined;

					// Verify the file still exists if we have download info
					let localPath = null;
					let downloadedAt = null;
					if (existing) {
						const localFile = Bun.file(existing.local_path);
						if (await localFile.exists()) {
							localPath = existing.local_path;
							downloadedAt = existing.downloaded_at;
						}
					}

					insertStmt.run(
						attachment.id,
						tableNorm,
						attachment.record_id,
						attachment.field_name,
						attachment.original_url,
						attachment.filename,
						attachment.size,
						attachment.type,
						localPath,
						downloadedAt,
					);
				}
			}
		});
	}

	/**
	 * Set multiple records in batch for better performance
	 */
	async setRecordsBatch(
		tableNorm: string,
		records: Array<{ id: string; fields: any }>,
		useInactive = false,
	): Promise<void> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		await this.transactionOn(db, async () => {
			if (!db) return;

			// Prepare statements once for the batch
			const recordStmt = db.prepare(`
        INSERT OR REPLACE INTO airtable_records (id, table_name, record_id, data, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

			const deleteAttachmentStmt = db.prepare(`
        DELETE FROM attachments WHERE table_name = ? AND record_id = ?
      `);

			const insertAttachmentStmt = db.prepare(`
        INSERT OR REPLACE INTO attachments
        (id, table_name, record_id, field_name, original_url, filename, size, type, local_path, downloaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

			const existingAttachmentStmt = db.prepare(`
        SELECT local_path, downloaded_at FROM attachments
        WHERE original_url = ? AND local_path IS NOT NULL AND downloaded_at IS NOT NULL
        LIMIT 1
      `);

			// Import extractAttachments once for the batch
			const { extractAttachments } = await import("./schema-generator");

			// Process each record in the batch
			for (const record of records) {
				const id = `${tableNorm}:${record.id}`;
				const dataStr = JSON.stringify(record.fields);

				// Insert/update main record
				recordStmt.run(id, tableNorm, record.id, dataStr);

				// Handle attachments if present
				const attachments = extractAttachments(record.id, record.fields);

				if (attachments.length > 0) {
					// Delete old attachments for this record
					deleteAttachmentStmt.run(tableNorm, record.id);

					// Insert new attachments
					for (const attachment of attachments) {
						// Check if this URL already exists with download info
						const existing = existingAttachmentStmt.get(
							attachment.original_url,
						) as { local_path: string; downloaded_at: string } | undefined;

						// Verify the file still exists if we have download info
						let localPath = null;
						let downloadedAt = null;
						if (existing) {
							const localFile = Bun.file(existing.local_path);
							if (await localFile.exists()) {
								localPath = existing.local_path;
								downloadedAt = existing.downloaded_at;
							}
						}

						insertAttachmentStmt.run(
							attachment.id,
							tableNorm,
							attachment.record_id,
							attachment.field_name,
							attachment.original_url,
							attachment.filename,
							attachment.size,
							attachment.type,
							localPath,
							downloadedAt,
						);
					}
				}
			}
		});
	}

	/**
	 * Retrieve a specific record from the active database
	 */
	async getRecord(
		tableNorm: string,
		recordId: string,
		useInactive = false,
	): Promise<any | null> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const id = `${tableNorm}:${recordId}`;

		const stmt = db.prepare(`
      SELECT data FROM airtable_records
      WHERE id = ?
    `);

		const result = stmt.get(id) as { data: string } | undefined;
		return result ? JSON.parse(result.data) : null;
	}

	/**
	 * Retrieve all records from a table from the active database
	 */
	async getTableRecords(
		tableNorm: string,
		useInactive = false,
		limit?: number,
		offset?: number,
	): Promise<any[]> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		let query = `
      SELECT data FROM airtable_records
      WHERE table_name = ?
      ORDER BY record_id
    `;

		const params: any[] = [tableNorm];

		if (limit) {
			query += ` LIMIT ?`;
			params.push(limit);

			if (offset) {
				query += ` OFFSET ?`;
				params.push(offset);
			}
		}

		const stmt = db.prepare(query);
		const results = stmt.all(...params) as { data: string }[];

		return results.map((row) => JSON.parse(row.data));
	}

	/**
	 * Count records in a table
	 */
	async countTableRecords(
		tableNorm: string,
		useInactive = false,
	): Promise<number> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM airtable_records
      WHERE table_name = ?
    `);

		const result = stmt.get(tableNorm) as { count: number };
		return result.count;
	}

	/**
	 * Retrieve list of available tables
	 */
	async getTables(useInactive = false): Promise<string[]> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const stmt = db.prepare(`
      SELECT DISTINCT table_name FROM airtable_records
      ORDER BY table_name
    `);

		const results = stmt.all() as { table_name: string }[];
		return results.map((row) => row.table_name);
	}

	/**
	 * Completely clear the inactive database (before refresh)
	 */
	async clearInactiveDatabase(): Promise<void> {
		if (!this.inactiveDb) throw new Error("Inactive database not connected");

		await this.transactionOn(this.inactiveDb, async () => {
			if (!this.inactiveDb) return;
			this.inactiveDb.run(`DELETE FROM airtable_records`);
			this.inactiveDb.run(`DELETE FROM attachments`);
			this.inactiveDb.run(`DELETE FROM locks`);
		});

		console.log("🧹 Inactive database cleared");
	}

	/**
	 * Get current active version
	 */
	async getActiveVersion(): Promise<ActiveVersion> {
		return this.currentActive;
	}

	/**
	 * Set active version in metadata
	 */
	private async setActiveVersionInMetadata(
		version: ActiveVersion,
	): Promise<void> {
		const metadataDb = new Database(this.metadataPath);
		try {
			const stmt = metadataDb.prepare(`
        UPDATE active_version SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1
      `);
			stmt.run(version);
			console.log(`🔄 Active version switched to: ${version}`);
		} finally {
			metadataDb.close();
		}
	}

	/**
	 * Get inactive version
	 */
	async getInactiveVersion(): Promise<ActiveVersion> {
		return this.currentActive === "v1" ? "v2" : "v1";
	}

	/**
	 * Atomically switch to inactive version (equivalent to flipActiveNS)
	 */
	async flipActiveVersion(): Promise<ActiveVersion> {
		const newActive = await this.getInactiveVersion();

		// Write to metadata
		await this.setActiveVersionInMetadata(newActive);

		// Switch memory pointers
		this.currentActive = newActive;
		const temp = this.activeDb;
		this.activeDb = this.inactiveDb;
		this.inactiveDb = temp;

		console.log(`🔄 Atomic switch completed to ${newActive}`);
		return newActive;
	}

	/**
	 * Store an attachment with local path
	 */
	async setAttachmentLocalPath(id: string, localPath: string): Promise<void> {
		if (!this.activeDb) throw new Error("Database not connected");

		const stmt = this.activeDb.prepare(`
      UPDATE attachments
      SET local_path = ?, downloaded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

		stmt.run(localPath, id);
	}

	/**
	 * Retrieve an attachment from the active database
	 */
	async getAttachment(id: string): Promise<Attachment | null> {
		if (!this.activeDb) throw new Error("Database not connected");

		const stmt = this.activeDb.prepare(
			`SELECT * FROM attachments WHERE id = ?`,
		);
		return stmt.get(id) as Attachment | null;
	}

	/**
	 * Retrieve all attachments for a table
	 */
	async getTableAttachments(
		tableName: string,
		useInactive = false,
	): Promise<Attachment[]> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const stmt = db.prepare(`
      SELECT * FROM attachments
      WHERE table_name = ?
      ORDER BY record_id, field_name, original_url
    `);

		return stmt.all(tableName) as Attachment[];
	}

	/**
	 * Retrieve all attachments for a record
	 */
	async getRecordAttachments(
		tableName: string,
		recordId: string,
		useInactive = false,
	): Promise<Attachment[]> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const stmt = db.prepare(`
      SELECT * FROM attachments
      WHERE table_name = ? AND record_id = ?
      ORDER BY field_name, original_url
    `);

		return stmt.all(tableName, recordId) as Attachment[];
	}

	/**
	 * Retrieve all attachments for a specific field
	 */
	async getFieldAttachments(
		tableName: string,
		recordId: string,
		fieldName: string,
		useInactive = false,
	): Promise<Attachment[]> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const stmt = db.prepare(`
      SELECT * FROM attachments
      WHERE table_name = ? AND record_id = ? AND field_name = ?
      ORDER BY original_url
    `);

		return stmt.all(tableName, recordId, fieldName) as Attachment[];
	}

	/**
	 * Retrieve all non-downloaded attachments
	 */
	async getPendingAttachments(useInactive = false): Promise<Attachment[]> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const stmt = db.prepare(`
      SELECT * FROM attachments
      WHERE (local_path IS NULL OR local_path = '')
      ORDER BY table_name, record_id
    `);

		return stmt.all() as Attachment[];
	}

	/**
	 * Mark an attachment as downloaded
	 */
	async markAttachmentDownloaded(
		id: string,
		localPath: string,
		size?: number,
	): Promise<void> {
		// Can be called on inactive (during refresh) or active
		const db = this.inactiveDb || this.activeDb;
		if (!db) throw new Error("Database not connected");

		const stmt = db.prepare(`
      UPDATE attachments
      SET local_path = ?, downloaded_at = CURRENT_TIMESTAMP, size = COALESCE(?, size)
      WHERE id = ?
    `);

		stmt.run(localPath, size ?? null, id);
	}

	/**
	 * Global statistics of the active database
	 */
	async getStats(): Promise<{
		totalRecords: number;
		totalTables: number;
		dbSize: string;
	}> {
		if (!this.activeDb) throw new Error("Database not connected");

		const recordsStmt = this.activeDb.prepare(`
      SELECT COUNT(*) as count FROM airtable_records
    `);
		const totalRecords = (recordsStmt.get() as { count: number }).count;

		const tablesStmt = this.activeDb.prepare(`
      SELECT COUNT(DISTINCT table_name) as count FROM airtable_records
    `);
		const totalTables = (tablesStmt.get() as { count: number }).count;

		// Size of both DB files
		const activeFile = Bun.file(
			this.currentActive === "v1" ? this.v1Path : this.v2Path,
		);
		const inactiveFile = Bun.file(
			this.currentActive === "v1" ? this.v2Path : this.v1Path,
		);
		const activeSize = await activeFile.size;
		const inactiveSize = await inactiveFile.size;
		const totalSize = activeSize + inactiveSize;
		const dbSize = `${(totalSize / 1024 / 1024).toFixed(2)} MB`;

		return { totalRecords, totalTables, dbSize };
	}

	/**
	 * Transaction on the active database
	 */
	async transaction<T>(fn: () => T): Promise<T> {
		if (!this.activeDb) throw new Error("Database not connected");
		const txn = this.activeDb.transaction(fn);
		return txn();
	}

	/**
	 * Transaction on a specific database
	 */
	async transactionOn<T>(db: Database, fn: () => T): Promise<T> {
		const txn = db.transaction(fn);
		return txn();
	}

	/**
	 * Supprimer un record (pour webhook incremental)
	 */
	async deleteRecord(
		tableNorm: string,
		recordId: string,
		useInactive = false,
	): Promise<void> {
		const db = useInactive ? this.inactiveDb : this.activeDb;
		if (!db) throw new Error("Database not connected");

		const id = `${tableNorm}:${recordId}`;

		await this.transactionOn(db, async () => {
			if (!db) return;

			// Supprimer le record principal
			const recordStmt = db.prepare(`
        DELETE FROM airtable_records WHERE id = ?
      `);
			recordStmt.run(id);

			// Supprimer les attachments associés
			const attachmentStmt = db.prepare(`
        DELETE FROM attachments WHERE table_name = ? AND record_id = ?
      `);
			attachmentStmt.run(tableNorm, recordId);
		});

		console.log(`🗑️ Record deleted: ${id}`);
	}

	/**
	 * Vérifier si un webhook a déjà été traité
	 */
	async isWebhookProcessed(webhookId: string): Promise<boolean> {
		if (!this.activeDb) throw new Error("Database not connected");

		const stmt = this.activeDb.prepare(`
      SELECT 1 FROM processed_webhooks 
      WHERE webhook_id = ? AND expires_at > datetime('now')
    `);

		const result = stmt.get(webhookId);
		return !!result;
	}

	/**
	 * Marquer un webhook comme traité
	 */
	async markWebhookProcessed(
		webhookId: string,
		refreshType: "incremental" | "full",
		stats: any,
	): Promise<void> {
		if (!this.activeDb) throw new Error("Database not connected");

		const { config } = await import("../../config");
		const expiresAt = new Date(
			Date.now() + config.webhookIdempotencyTTL * 1000,
		);

		const stmt = this.activeDb.prepare(`
      INSERT OR REPLACE INTO processed_webhooks 
      (webhook_id, refresh_type, stats, expires_at)
      VALUES (?, ?, ?, ?)
    `);

		stmt.run(
			webhookId,
			refreshType,
			JSON.stringify(stats),
			expiresAt.toISOString(),
		);
	}

	/**
	 * Cleanup des webhooks expirés (à appeler périodiquement)
	 */
	async cleanupExpiredWebhooks(): Promise<number> {
		if (!this.activeDb) throw new Error("Database not connected");

		const stmt = this.activeDb.prepare(`
      DELETE FROM processed_webhooks 
      WHERE expires_at < datetime('now')
    `);

		const result = stmt.run();
		const deleted = result.changes || 0;

		if (deleted > 0) {
			console.log(`🧹 Cleaned up ${deleted} expired webhooks`);
		}

		return deleted;
	}

	// ========================================
	// TABLE MAPPING METHODS
	// ========================================

	/**
	 * Upsert table mapping into database
	 */
	async upsertTableMapping(
		db: Database,
		mapping: {
			id: string;
			originalName: string;
			normalizedName: string;
			primaryFieldId: string;
			fields: Record<string, unknown>;
		},
	): Promise<void> {
		const stmt = db.prepare(`
      INSERT INTO metadata_mappings (
        table_id, table_name_original, table_name_normalized,
        primary_field_id, fields_mapping, updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(table_id) DO UPDATE SET
        table_name_original = excluded.table_name_original,
        table_name_normalized = excluded.table_name_normalized,
        primary_field_id = excluded.primary_field_id,
        fields_mapping = excluded.fields_mapping,
        updated_at = CURRENT_TIMESTAMP
    `);

		stmt.run(
			mapping.id,
			mapping.originalName,
			mapping.normalizedName,
			mapping.primaryFieldId,
			JSON.stringify(mapping.fields),
		);
	}

	/**
	 * Get original table name by table ID (for Airtable API calls)
	 */
	getOriginalTableNameById(tableId: string): string | null {
		if (!this.activeDb) return null;

		const result = this.activeDb
			.prepare(
				`
      SELECT table_name_original 
      FROM metadata_mappings 
      WHERE table_id = ?
    `,
			)
			.get(tableId) as { table_name_original: string } | undefined;

		return result?.table_name_original || null;
	}

	/**
	 * Get normalized table name by table ID (for SQLite storage)
	 */
	getNormalizedTableNameById(tableId: string): string | null {
		if (!this.activeDb) return null;

		const result = this.activeDb
			.prepare(
				`
      SELECT table_name_normalized 
      FROM metadata_mappings 
      WHERE table_id = ?
    `,
			)
			.get(tableId) as { table_name_normalized: string } | undefined;

		return result?.table_name_normalized || null;
	}

	/**
	 * Get original table name by normalized name (for write-back to Airtable)
	 */
	getOriginalTableNameByNormalized(normalizedName: string): string | null {
		if (!this.activeDb) return null;

		const result = this.activeDb
			.prepare(
				`
      SELECT table_name_original 
      FROM metadata_mappings 
      WHERE table_name_normalized = ?
    `,
			)
			.get(normalizedName) as { table_name_original: string } | undefined;

		return result?.table_name_original || null;
	}

	/**
	 * Get table ID by normalized name
	 */
	getTableIdByNormalizedName(normalizedName: string): string | null {
		if (!this.activeDb) return null;

		const result = this.activeDb
			.prepare(
				`
      SELECT table_id 
      FROM metadata_mappings 
      WHERE table_name_normalized = ?
    `,
			)
			.get(normalizedName) as { table_id: string } | undefined;

		return result?.table_id || null;
	}

	/**
	 * Get all table mappings (for API endpoint)
	 */
	getAllMappings(): Array<{
		id: string;
		originalName: string;
		normalizedName: string;
		primaryFieldId: string;
		fields: Record<string, unknown>;
	}> {
		if (!this.activeDb) return [];

		const rows = this.activeDb
			.prepare(
				`
      SELECT table_id, table_name_original, table_name_normalized,
             primary_field_id, fields_mapping
      FROM metadata_mappings
      ORDER BY table_name_original
    `,
			)
			.all() as Array<{
			table_id: string;
			table_name_original: string;
			table_name_normalized: string;
			primary_field_id: string;
			fields_mapping: string;
		}>;

		return rows.map((row) => ({
			id: row.table_id,
			originalName: row.table_name_original,
			normalizedName: row.table_name_normalized,
			primaryFieldId: row.primary_field_id,
			fields: JSON.parse(row.fields_mapping) as Record<string, unknown>,
		}));
	}

	/**
	 * Get field mapping for a specific field
	 */
	getFieldMapping(
		tableIdOrName: string,
		fieldId: string,
	): { id: string; name: string; type: string } | null {
		if (!this.activeDb) return null;

		// Try to find by table ID first
		let result = this.activeDb
			.prepare(
				`
      SELECT fields_mapping 
      FROM metadata_mappings 
      WHERE table_id = ?
    `,
			)
			.get(tableIdOrName) as { fields_mapping: string } | undefined;

		// If not found, try by normalized name
		if (!result) {
			result = this.activeDb
				.prepare(
					`
        SELECT fields_mapping 
        FROM metadata_mappings 
        WHERE table_name_normalized = ?
      `,
				)
				.get(tableIdOrName) as { fields_mapping: string } | undefined;
		}

		if (!result) return null;

		const fields = JSON.parse(result.fields_mapping) as Record<
			string,
			{ id: string; name: string; type: string }
		>;
		return fields[fieldId] || null;
	}

	/**
	 * Close all connections
	 */
	async close(): Promise<void> {
		if (this.activeDb) {
			this.activeDb.close();
			this.activeDb = null;
		}
		if (this.inactiveDb) {
			this.inactiveDb.close();
			this.inactiveDb = null;
		}
		console.log("✅ SQLite connections closed");
	}
}

// Instance singleton
export const sqliteService = new SQLiteService();
export { SQLiteService };
export type { AirtableRecord, Attachment, ActiveVersion };
