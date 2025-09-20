// src/worker-refresh.ts
import { redisService } from "../lib/redis/index";
import { keyRecord, keyIndex, keyTables, withLock, getActiveNamespace } from "../lib/redis/helpers";
import { inactiveOf, flipActiveNS } from "../lib/redis/helpers";
import { updateSchemaWithRetry, validateSchema } from "../lib/airtable/schema-updater";
import { AIRTABLE_TABLE_NAMES } from "../lib/airtable/schema";
import { base } from "../lib/airtable";
import { normalizeForRedis } from "../lib/utils";
import { flattenRecord } from "airtable-types-gen";

declare var self: Worker;

const TTL = parseInt(process.env.CACHE_TTL || "5400");

self.onmessage = async (e) => {
  if (e.data?.type !== "refresh:start") return;

  // lock pour éviter 2 refresh concurrents (même si plusieurs workers/process)
  const out = await withLock("refresh", 30 * 60, async () => {
    console.log("🚀 Début du refresh des données Airtable");

    // 1) Mise à jour du schéma Airtable au début du refresh
    console.log("📋 Étape 1: Mise à jour du schéma Airtable");
    const schemaUpdated = await updateSchemaWithRetry(2);

    if (!schemaUpdated) {
      console.warn("⚠️ Échec mise à jour schéma, utilisation de l'ancien schéma");
      // On continue avec l'ancien schéma plutôt que d'échouer
    } else {
      // Validation du nouveau schéma
      const isValid = await validateSchema();
      if (!isValid) {
        console.warn("⚠️ Nouveau schéma invalide, utilisation de l'ancien");
      }
    }

    // 2) Connexion Redis et récupération des namespaces
    console.log("🔄 Étape 2: Initialisation Redis");
    await redisService.connect();

    const active = await getActiveNamespace();
    const inactive = inactiveOf(active);

    console.log(`📍 Namespace actif: ${active}, inactif: ${inactive}`);

    // 3) Extraction et cache des données Airtable
    console.log("📊 Étape 3: Extraction des données depuis Airtable");
    let totalRecords = 0;

    for (const table of AIRTABLE_TABLE_NAMES) {
      try {
        console.log(`🔄 Traitement de la table: ${table}`);
        const tableInstance = base(table);
        const redisTableName = normalizeForRedis(table);
        const results = await tableInstance.select().all();

        console.log(`📋 ${table}: ${results.length} enregistrements trouvés`);
        totalRecords += results.length;

        // Préparer les clés d'index
        const indexKey = keyIndex(inactive, redisTableName);

        // Ajouter la table à l'index des tables
        const tablesKey = keyTables(inactive);
        await redisService.sadd(tablesKey, redisTableName);

        // Ecrire par paquets pour limiter la pression mémoire et bénéficier de l'auto-pipelining
        const CHUNK_SIZE = 500;
        for (let i = 0; i < results.length; i += CHUNK_SIZE) {
          const chunk = results.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async (record) => {
              try {
                const flattened = flattenRecord(record);
                const recId = flattened.record_id;
                const key = keyRecord(inactive, redisTableName, recId);
                const value = JSON.stringify(flattened);

                await Promise.all([
                  redisService.set(key, value, { ttl: TTL }),
                  redisService.sadd(indexKey, recId),
                ]);

              } catch (recordError) {
                console.error(`❌ Erreur traitement record ${record.id}:`, recordError);
              }
            })
          );
        }

        // TTL sur l'index et l'index des tables pour rester cohérent avec les records
        await Promise.all([
          redisService.expire(indexKey, TTL),
          redisService.expire(tablesKey, TTL),
        ]);

        console.log(`✅ ${table}: ${results.length} enregistrements cachés`);

        // Laisser respirer le CPU
        await Bun.sleep(0);

      } catch (tableError) {
        console.error(`❌ Erreur traitement table ${table}:`, tableError);
        // Continue avec les autres tables
      }
    }

    console.log(`📊 Total: ${totalRecords} enregistrements traités`);

    // 4) Basculement atomique vers le nouveau namespace
    console.log("🔄 Étape 4: Basculement du namespace actif");
    await flipActiveNS(inactive);

    console.log("✅ Refresh terminé avec succès");
    return {
      flippedTo: inactive,
      totalRecords,
      schemaUpdated
    };
  });

  // informer le main (facultatif)
  postMessage({ type: "refresh:done", stats: out ?? { skipped: true } });
};
