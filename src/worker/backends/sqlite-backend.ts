/**
 * Backend SQLite pour le worker unifié
 */

import { sqliteService } from "../../lib/sqlite/index";
import { base } from "../../lib/airtable/index";
import { AIRTABLE_TABLE_NAMES } from "../../lib/airtable/schema";

export interface RefreshStats {
  tables: number;
  records: number;
  duration: number;
  errors: number;
}

export class SQLiteBackend {
  async refreshData(): Promise<RefreshStats> {
    const startTime = performance.now();
    let totalRecords = 0;
    let totalErrors = 0;

    console.log("🔄 [SQLite] Début du refresh des données Airtable...");

    try {
      // S'assurer que SQLite est connecté
      await sqliteService.connect();

      // Nettoyer la version existante
      console.log("🧹 [SQLite] Nettoyage de la version précédente...");
      await sqliteService.clearInactiveDatabase();

      // Refresh de chaque table
      const tableNames = Object.values(AIRTABLE_TABLE_NAMES);
      console.log(`📋 [SQLite] Traitement de ${tableNames.length} tables...`);

      for (const tableName of tableNames) {
        try {
          console.log(`🔄 [SQLite] Sync ${tableName}...`);

          // Récupérer tous les records de la table
          const records = await base(tableName).select().all();
          console.log(`   📊 ${records.length} records trouvés`);

          // Sauvegarder chaque record dans SQLite
          for (const record of records) {
            try {
              await sqliteService.setRecord(tableName, record.id, record.fields, true);
              totalRecords++;
            } catch (error) {
              console.error(`   ❌ Erreur record ${record.id}:`, error);
              totalErrors++;
            }
          }

          console.log(`   ✅ ${tableName}: ${records.length} records synchronisés`);

        } catch (error) {
          console.error(`❌ [SQLite] Erreur table ${tableName}:`, error);
          totalErrors++;
        }
      }

      // Finaliser la synchronisation
      await sqliteService.flipActiveVersion();

      const duration = performance.now() - startTime;

      console.log(`✅ [SQLite] Refresh terminé en ${(duration / 1000).toFixed(2)}s`);
      console.log(`📊 [SQLite] ${totalRecords} records synchronisés, ${totalErrors} erreurs`);

      return {
        tables: tableNames.length,
        records: totalRecords,
        duration,
        errors: totalErrors
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      console.error("❌ [SQLite] Erreur lors du refresh:", error);

      throw new Error(`SQLite refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStats(): Promise<any> {
    try {
      return await sqliteService.getStats();
    } catch (error) {
      console.error("❌ [SQLite] Erreur lors de la récupération des stats:", error);
      return null;
    }
  }

  async close(): Promise<void> {
    try {
      await sqliteService.close();
      console.log("✅ [SQLite] Connexion fermée");
    } catch (error) {
      console.error("❌ [SQLite] Erreur lors de la fermeture:", error);
    }
  }
}