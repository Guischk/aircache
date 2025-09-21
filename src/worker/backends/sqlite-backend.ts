/**
 * SQLite backend for the worker
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

    console.log("🔄 [SQLite] Starting Airtable data refresh...");

    try {
      // Ensure SQLite is connected
      await sqliteService.connect();

      // Clean up previous version
      console.log("🧹 [SQLite] Cleaning previous version...");
      await sqliteService.clearInactiveDatabase();

      // Refresh each table
      const tableNames = Object.values(AIRTABLE_TABLE_NAMES);
      console.log(`📋 [SQLite] Processing ${tableNames.length} tables...`);

      for (const tableName of tableNames) {
        try {
          console.log(`🔄 [SQLite] Syncing ${tableName}...`);

          // Retrieve all records from the table
          const records = await base(tableName).select().all();
          console.log(`   📊 ${records.length} records found`);

          // Save each record to SQLite
          for (const record of records) {
            try {
              await sqliteService.setRecord(tableName, record.id, record.fields, true);
              totalRecords++;
            } catch (error) {
              console.error(`   ❌ Error with record ${record.id}:`, error);
              totalErrors++;
            }
          }

          console.log(`   ✅ ${tableName}: ${records.length} records synchronized`);

        } catch (error) {
          console.error(`❌ [SQLite] Error with table ${tableName}:`, error);
          totalErrors++;
        }
      }

      // Finalize synchronization
      await sqliteService.flipActiveVersion();

      const duration = performance.now() - startTime;

      console.log(`✅ [SQLite] Refresh completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(`📊 [SQLite] ${totalRecords} records synchronized, ${totalErrors} errors`);

      return {
        tables: tableNames.length,
        records: totalRecords,
        duration,
        errors: totalErrors
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      console.error("❌ [SQLite] Error during refresh:", error);

      throw new Error(`SQLite refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStats(): Promise<any> {
    try {
      return await sqliteService.getStats();
    } catch (error) {
      console.error("❌ [SQLite] Error retrieving stats:", error);
      return null;
    }
  }

  async close(): Promise<void> {
    try {
      await sqliteService.close();
      console.log("✅ [SQLite] Connection closed");
    } catch (error) {
      console.error("❌ [SQLite] Error during close:", error);
    }
  }
}