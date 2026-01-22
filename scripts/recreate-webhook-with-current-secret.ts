#!/usr/bin/env bun
/**
 * Script pour recréer le webhook Airtable avec le secret actuel
 * Cela résout les problèmes de désynchronisation entre le secret Railway et le webhook
 */

import { config } from "../src/config";
import { AirtableWebhookClient } from "../src/lib/airtable/webhook-client";

console.log("🔄 Recréation du webhook Airtable\n");
console.log("=".repeat(60));

if (!config.webhookPublicUrl) {
	console.error("\n❌ WEBHOOK_PUBLIC_URL n'est pas configuré !");
	console.error("Ajoutez cette variable dans Railway :");
	console.error(
		"  WEBHOOK_PUBLIC_URL=https://aircache-production.up.railway.app",
	);
	process.exit(1);
}

const webhookUrl = `${config.webhookPublicUrl}/webhooks/airtable/refresh`;

async function recreateWebhook() {
	const client = new AirtableWebhookClient();

	try {
		// 1. Lister les webhooks existants
		console.log("\n📋 Étape 1/3 : Liste des webhooks existants\n");
		const webhooks = await client.listWebhooks();

		if (webhooks.length === 0) {
			console.log("Aucun webhook trouvé.");
		} else {
			for (const webhook of webhooks) {
				console.log(`  ID: ${webhook.id}`);
				console.log(`  URL: ${webhook.notificationUrl}`);
				console.log(`  Enabled: ${webhook.isHookEnabled}`);
				console.log("  ---");
			}
		}

		// 2. Supprimer les webhooks existants pour cette URL
		console.log("\n🗑️  Étape 2/3 : Suppression des webhooks obsolètes\n");
		let deletedCount = 0;

		for (const webhook of webhooks) {
			if (webhook.notificationUrl === webhookUrl) {
				console.log(`  Suppression du webhook ${webhook.id}...`);
				await client.deleteWebhook(webhook.id);
				deletedCount++;
			}
		}

		if (deletedCount === 0) {
			console.log("  Aucun webhook à supprimer.");
		} else {
			console.log(`  ✅ ${deletedCount} webhook(s) supprimé(s)`);
		}

		// 3. Créer un nouveau webhook
		console.log("\n🆕 Étape 3/3 : Création du nouveau webhook\n");
		console.log(`  URL: ${webhookUrl}`);
		console.log(
			`  Secret: ${config.webhookSecret.substring(0, 10)}... (${config.webhookSecret.length} chars)`,
		);

		const result = await client.setupWebhook(webhookUrl);

		console.log(`\n${"=".repeat(60)}`);
		console.log("\n✅ Webhook recrée avec succès !");
		console.log(`\n  Webhook ID: ${result.webhookId}`);
		console.log(`  Créé: ${result.created ? "Oui" : "Non (existait déjà)"}`);

		console.log("\n📝 Prochaines étapes :");
		console.log(
			"\n  1. Vérifiez que WEBHOOK_SECRET est bien configuré dans Railway :",
		);
		console.log(`     WEBHOOK_SECRET=${config.webhookSecret}`);
		console.log("\n  2. Testez le webhook :");
		console.log(
			`     bun run scripts/test-hmac-sha256-format.ts ${config.webhookPublicUrl}`,
		);
		console.log("\n  3. Déclenchez un changement dans Airtable pour tester");
	} catch (error) {
		console.error("\n❌ Erreur :");
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

recreateWebhook();
