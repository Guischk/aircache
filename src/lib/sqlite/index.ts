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

  constructor(
    v1Path: string = process.env.SQLITE_V1_PATH || "data/aircache-v1.sqlite",
    v2Path: string = process.env.SQLITE_V2_PATH || "data/aircache-v2.sqlite",
    metadataPath: string = process.env.SQLITE_METADATA_PATH || "data/metadata.sqlite"
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
      const dbDir = this.v1Path.split('/').slice(0, -1).join('/');
      if (dbDir) {
        await Bun.write(join(dbDir, '.gitkeep'), '');
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
    db.run(`CREATE INDEX IF NOT EXISTS idx_table_name ON airtable_records(table_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_record_id ON airtable_records(record_id)`);

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
    db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(table_name, record_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_pending ON attachments(local_path) WHERE local_path IS NULL`);

    // Table for locks (in each database to avoid conflicts)
    db.run(`
      CREATE TABLE IF NOT EXISTS locks (
        name TEXT PRIMARY KEY,
        lock_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL
      )
    `);

    console.log("✅ Data schema initialized");
  }

  /**
   * Load active version from metadata
   */
  private async loadActiveVersionFromMetadata(metadataDb: Database): Promise<ActiveVersion> {
    const result = metadataDb.prepare(
      `SELECT version FROM active_version WHERE id = 1`
    ).get() as { version: string } | undefined;

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
  async setRecord(tableNorm: string, recordId: string, data: any, useInactive: boolean = false): Promise<void> {
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

        // Insert new attachments
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO attachments
          (id, table_name, record_id, field_name, original_url, filename, size, type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const attachment of attachments) {
          insertStmt.run(
            attachment.id,
            tableNorm,
            attachment.record_id,
            attachment.field_name,
            attachment.original_url,
            attachment.filename,
            attachment.size,
            attachment.type
          );
        }
      }
    });
  }

  /**
   * Retrieve a specific record from the active database
   */
  async getRecord(tableNorm: string, recordId: string, useInactive: boolean = false): Promise<any | null> {
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
  async getTableRecords(tableNorm: string, useInactive: boolean = false, limit?: number, offset?: number): Promise<any[]> {
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

    return results.map(row => JSON.parse(row.data));
  }

  /**
   * Count records in a table
   */
  async countTableRecords(tableNorm: string, useInactive: boolean = false): Promise<number> {
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
  async getTables(useInactive: boolean = false): Promise<string[]> {
    const db = useInactive ? this.inactiveDb : this.activeDb;
    if (!db) throw new Error("Database not connected");

    const stmt = db.prepare(`
      SELECT DISTINCT table_name FROM airtable_records
      ORDER BY table_name
    `);

    const results = stmt.all() as { table_name: string }[];
    return results.map(row => row.table_name);
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
  private async setActiveVersionInMetadata(version: ActiveVersion): Promise<void> {
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

    const stmt = this.activeDb.prepare(`SELECT * FROM attachments WHERE id = ?`);
    return stmt.get(id) as Attachment | null;
  }

  /**
   * Retrieve all attachments for a record
   */
  async getRecordAttachments(tableName: string, recordId: string, useInactive: boolean = false): Promise<Attachment[]> {
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
   * Retrieve all non-downloaded attachments
   */
  async getPendingAttachments(useInactive: boolean = false): Promise<Attachment[]> {
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
  async markAttachmentDownloaded(id: string, localPath: string, size?: number): Promise<void> {
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
  async getStats(): Promise<{ totalRecords: number; totalTables: number; dbSize: string }> {
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
    const activeFile = Bun.file(this.currentActive === "v1" ? this.v1Path : this.v2Path);
    const inactiveFile = Bun.file(this.currentActive === "v1" ? this.v2Path : this.v1Path);
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