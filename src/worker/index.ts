// src/worker-refresh.ts
import { redis } from "bun";
import { keyRecord, withLock } from "../lib/redis/helpers";
import { inactiveOf, flipActiveNS } from "../lib/redis/helpers";
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
    // On récupère l'espace actif et inactif
    const active = (await redis.get("active_ns")) === "v2" ? "v2" : "v1";
    const inactive = inactiveOf(active);

    // 1) construire l’espace inactif en **petits batches** + pipeline Redis
    // (extraction + transformation à ta sauce)
    for (const table of AIRTABLE_TABLE_NAMES) {
      const tableInstance = base(table);
      const redisTableName = normalizeForRedis(table);
      const results = await tableInstance.select().all();
      console.log(`Found ${results.length} records`);
      for (const record of results) {
        //On flattens le record
        const flattened = flattenRecord(record);
        console.log(`Processing record: ${flattened.record_id}`);
        //On génère la clé Redis
        const key = keyRecord(inactive, redisTableName, flattened.record_id);
        console.log(`Key: ${key}`);
        const value = JSON.stringify(flattened);
        console.log(`Value: ${value.slice(0, 100)}...`);
        await redis.set(key, value);
        await redis.expire(key, TTL);
        console.log(`Record ${flattened.record_id} processed`);
      }
      // **laisser respirer le main** (yield) même si on est en worker :
      await Bun.sleep(0); // évite une boucle serrée CPU
    }

    // 2) flip atomique + pub
    await flipActiveNS(inactive);

    return { flippedTo: inactive };
  });

  // informer le main (facultatif)
  postMessage({ type: "refresh:done", stats: out ?? { skipped: true } });
};
