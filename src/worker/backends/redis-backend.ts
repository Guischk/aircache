/**
 * Backend Redis pour le worker unifié
 */

import { redisService, withLock } from "../../lib/redis/index";
import { base } from "../../lib/airtable/index";
import { AIRTABLE_TABLE_NAMES } from "../../lib/airtable/schema";

export interface RefreshStats {
  tables: number;
  records: number;
  duration: number;
  errors: number;
}

export class RedisBackend {
  async refreshData(): Promise<RefreshStats> {
    const startTime = performance.now();

    console.log("🔄 [Redis] Début du refresh des données Airtable...");

    // Utiliser un lock distribué pour éviter les refreshs concurrents
    return await withLock("airtable:refresh", async () => {
      try {
        // S'assurer que Redis est connecté
        await redisService.connect();

        // Obtenir l'espace de noms inactif
        const inactiveNS = await redisService.getInactiveNamespace();
        console.log(`📦 [Redis] Utilisation du namespace: ${inactiveNS}`);

        let totalRecords = 0;
        let totalErrors = 0;

        // Refresh de chaque table
        const tableNames = Object.values(AIRTABLE_TABLE_NAMES);
        console.log(`📋 [Redis] Traitement de ${tableNames.length} tables...`);

        for (const tableName of tableNames) {
          try {
            console.log(`🔄 [Redis] Sync ${tableName}...`);

            // Récupérer tous les records de la table
            const records = await base(tableName).select().all();
            console.log(`   📊 ${records.length} records trouvés`);

            // Sauvegarder chaque record dans Redis
            for (const record of records) {
              try {
                await redisService.setRecord(tableName, record.id, record.fields);
                totalRecords++;
              } catch (error) {
                console.error(`   ❌ Erreur record ${record.id}:`, error);
                totalErrors++;
              }
            }

            // Mettre à jour l'index de la table
            const recordIds = records.map(r => r.id);
            await redisService.setTableIndex(tableName, recordIds);

            console.log(`   ✅ ${tableName}: ${records.length} records synchronisés`);

          } catch (error) {
            console.error(`❌ [Redis] Erreur table ${tableName}:`, error);
            totalErrors++;
          }
        }

        // Mettre à jour la liste des tables
        await redisService.setTables(tableNames);

        // Flip des namespaces après le refresh complet
        await redisService.flipActiveNamespace();
        console.log(`🔄 [Redis] Namespace actif: ${await redisService.getActiveNamespace()}`);

        const duration = performance.now() - startTime;

        console.log(`✅ [Redis] Refresh terminé en ${(duration / 1000).toFixed(2)}s`);
        console.log(`📊 [Redis] ${totalRecords} records synchronisés, ${totalErrors} erreurs`);

        return {
          tables: tableNames.length,
          records: totalRecords,
          duration,
          errors: totalErrors
        };

      } catch (error) {
        const duration = performance.now() - startTime;
        console.error("❌ [Redis] Erreur lors du refresh:", error);

        throw new Error(`Redis refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  async getStats(): Promise<any> {
    try {
      return await redisService.getStats();
    } catch (error) {
      console.error("❌ [Redis] Erreur lors de la récupération des stats:", error);
      return null;
    }
  }

  async close(): Promise<void> {
    try {
      await redisService.close();
      console.log("✅ [Redis] Connexion fermée");
    } catch (error) {
      console.error("❌ [Redis] Erreur lors de la fermeture:", error);
    }
  }
}