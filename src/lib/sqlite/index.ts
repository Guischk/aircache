/**
 * SQLite service pour remplacer Redis
 * Utilise bun:sqlite avec architecture dual-database (comme Redis dual-namespace)
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
    v1Path: string = process.env.SQLITE_V1_PATH || "data/aircache-v1.db",
    v2Path: string = process.env.SQLITE_V2_PATH || "data/aircache-v2.db",
    metadataPath: string = process.env.SQLITE_METADATA_PATH || "data/metadata.db"
  ) {
    this.v1Path = v1Path;
    this.v2Path = v2Path;
    this.metadataPath = metadataPath;
  }

  /**
   * Initialise les bases de données (v1, v2 et metadata)
   */
  async connect(): Promise<void> {
    try {
      // Créer le dossier data s'il n'existe pas
      const dbDir = this.v1Path.split('/').slice(0, -1).join('/');
      if (dbDir) {
        await Bun.write(join(dbDir, '.gitkeep'), '');
      }

      // Initialiser la base de métadonnées
      const metadataDb = new Database(this.metadataPath);
      this.setupPragmas(metadataDb);
      await this.initializeMetadataSchema(metadataDb);

      // Récupérer la version active depuis les métadonnées
      this.currentActive = await this.loadActiveVersionFromMetadata(metadataDb);
      metadataDb.close();

      // Initialiser les deux bases de données
      const v1Db = new Database(this.v1Path);
      const v2Db = new Database(this.v2Path);

      this.setupPragmas(v1Db);
      this.setupPragmas(v2Db);

      await this.initializeDataSchema(v1Db);
      await this.initializeDataSchema(v2Db);

      // Définir quelle base est active/inactive
      if (this.currentActive === "v1") {
        this.activeDb = v1Db;
        this.inactiveDb = v2Db;
      } else {
        this.activeDb = v2Db;
        this.inactiveDb = v1Db;
      }

      console.log(`✅ SQLite connecté - Active: ${this.currentActive}`);
      console.log(`📊 Bases: ${this.v1Path}, ${this.v2Path}`);
    } catch (error) {
      console.error("❌ Erreur connexion SQLite:", error);
      throw error;
    }
  }

  /**
   * Configure les pragmas pour optimiser les performances
   */
  private setupPragmas(db: Database): void {
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL");
    db.run("PRAGMA cache_size = 1000");
    db.run("PRAGMA temp_store = memory");
  }

  /**
   * Initialise le schéma de métadonnées
   */
  private async initializeMetadataSchema(db: Database): Promise<void> {
    // Table pour stocker quelle version est active
    db.run(`
      CREATE TABLE IF NOT EXISTS active_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version TEXT NOT NULL DEFAULT 'v1',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insérer la version par défaut si elle n'existe pas
    db.run(`
      INSERT OR IGNORE INTO active_version (id, version) VALUES (1, 'v1')
    `);
  }

  /**
   * Initialise le schéma des données (airtable_records + attachments)
   */
  private async initializeDataSchema(db: Database): Promise<void> {
    // Table centralisée pour tous les records Airtable
    db.run(`
      CREATE TABLE IF NOT EXISTS airtable_records (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Index pour optimiser les requêtes
    db.run(`CREATE INDEX IF NOT EXISTS idx_table_name ON airtable_records(table_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_record_id ON airtable_records(record_id)`);

    // Table pour les attachments
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

    // Index pour les attachments
    db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(table_name, record_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_pending ON attachments(local_path) WHERE local_path IS NULL`);

    // Table pour les locks (dans chaque base pour éviter les conflits)
    db.run(`
      CREATE TABLE IF NOT EXISTS locks (
        name TEXT PRIMARY KEY,
        lock_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL
      )
    `);

    console.log("✅ Schéma de données initialisé");
  }

  /**
   * Charge la version active depuis les métadonnées
   */
  private async loadActiveVersionFromMetadata(metadataDb: Database): Promise<ActiveVersion> {
    const result = metadataDb.prepare(
      `SELECT version FROM active_version WHERE id = 1`
    ).get() as { version: string } | undefined;

    return (result?.version as ActiveVersion) || "v1";
  }

  /**
   * Vérifie la santé des connexions
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
   * Stocke un record dans la base inactive (pendant le refresh)
   */
  async setRecord(tableNorm: string, recordId: string, data: any, useInactive: boolean = false): Promise<void> {
    const db = useInactive ? this.inactiveDb : this.activeDb;
    if (!db) throw new Error("Database not connected");

    const id = `${tableNorm}:${recordId}`;
    const dataStr = JSON.stringify(data);

    await this.transactionOn(db, async () => {
      if (!db) return;

      // Insérer/mettre à jour le record principal
      const recordStmt = db.prepare(`
        INSERT OR REPLACE INTO airtable_records (id, table_name, record_id, data, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      recordStmt.run(id, tableNorm, recordId, dataStr);

      // Gérer les attachments si présents
      const { extractAttachments } = await import("./schema-generator");
      const attachments = extractAttachments(recordId, data);

      if (attachments.length > 0) {
        // Supprimer les anciens attachments pour ce record
        const deleteStmt = db.prepare(`
          DELETE FROM attachments WHERE table_name = ? AND record_id = ?
        `);
        deleteStmt.run(tableNorm, recordId);

        // Insérer les nouveaux attachments
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
   * Récupère un record spécifique depuis la base active
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
   * Récupère tous les records d'une table depuis la base active
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
   * Compte les records d'une table
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
   * Récupère la liste des tables disponibles
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
   * Vide complètement la base inactive (avant refresh)
   */
  async clearInactiveDatabase(): Promise<void> {
    if (!this.inactiveDb) throw new Error("Inactive database not connected");

    await this.transactionOn(this.inactiveDb, async () => {
      if (!this.inactiveDb) return;
      this.inactiveDb.run(`DELETE FROM airtable_records`);
      this.inactiveDb.run(`DELETE FROM attachments`);
      this.inactiveDb.run(`DELETE FROM locks`);
    });

    console.log("🧹 Base inactive vidée");
  }

  /**
   * Récupère la version active courante
   */
  async getActiveVersion(): Promise<ActiveVersion> {
    return this.currentActive;
  }

  /**
   * Définit la version active dans les métadonnées
   */
  private async setActiveVersionInMetadata(version: ActiveVersion): Promise<void> {
    const metadataDb = new Database(this.metadataPath);
    try {
      const stmt = metadataDb.prepare(`
        UPDATE active_version SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1
      `);
      stmt.run(version);
      console.log(`🔄 Version active basculée vers: ${version}`);
    } finally {
      metadataDb.close();
    }
  }

  /**
   * Récupère la version inactive
   */
  async getInactiveVersion(): Promise<ActiveVersion> {
    return this.currentActive === "v1" ? "v2" : "v1";
  }

  /**
   * Bascule atomiquement vers la version inactive (équivalent flipActiveNS)
   */
  async flipActiveVersion(): Promise<ActiveVersion> {
    const newActive = await this.getInactiveVersion();

    // Écrire dans les métadonnées
    await this.setActiveVersionInMetadata(newActive);

    // Basculer les pointeurs en mémoire
    this.currentActive = newActive;
    const temp = this.activeDb;
    this.activeDb = this.inactiveDb;
    this.inactiveDb = temp;

    console.log(`🔄 Basculement atomique terminé vers ${newActive}`);
    return newActive;
  }

  /**
   * Stocke un attachment avec chemin local
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
   * Récupère un attachment depuis la base active
   */
  async getAttachment(id: string): Promise<Attachment | null> {
    if (!this.activeDb) throw new Error("Database not connected");

    const stmt = this.activeDb.prepare(`SELECT * FROM attachments WHERE id = ?`);
    return stmt.get(id) as Attachment | null;
  }

  /**
   * Récupère tous les attachments d'un record
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
   * Récupère tous les attachments non téléchargés
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
   * Marque un attachment comme téléchargé
   */
  async markAttachmentDownloaded(id: string, localPath: string, size?: number): Promise<void> {
    // Peut être appelé sur inactive (pendant refresh) ou active
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
   * Statistiques globales de la base active
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

    // Taille des deux fichiers DB
    const activeFile = Bun.file(this.currentActive === "v1" ? this.v1Path : this.v2Path);
    const inactiveFile = Bun.file(this.currentActive === "v1" ? this.v2Path : this.v1Path);
    const activeSize = await activeFile.size;
    const inactiveSize = await inactiveFile.size;
    const totalSize = activeSize + inactiveSize;
    const dbSize = `${(totalSize / 1024 / 1024).toFixed(2)} MB`;

    return { totalRecords, totalTables, dbSize };
  }

  /**
   * Transaction sur la base active
   */
  async transaction<T>(fn: () => T): Promise<T> {
    if (!this.activeDb) throw new Error("Database not connected");
    const txn = this.activeDb.transaction(fn);
    return txn();
  }

  /**
   * Transaction sur une base spécifique
   */
  async transactionOn<T>(db: Database, fn: () => T): Promise<T> {
    const txn = db.transaction(fn);
    return txn();
  }

  /**
   * Ferme toutes les connexions
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
    console.log("✅ SQLite connexions fermées");
  }
}

// Instance singleton
export const sqliteService = new SQLiteService();
export { SQLiteService };
export type { AirtableRecord, Attachment, ActiveVersion };