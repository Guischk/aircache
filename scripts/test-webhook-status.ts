#!/usr/bin/env bun

/**
 * Test complet du webhook Airtable
 * Vérifie tous les aspects de la configuration
 */

import { AirtableWebhookClient } from "../src/lib/airtable/webhook-client";

async function main() {
	console.log("🔍 Test complet du webhook Airtable\n");

	try {
		const client = new AirtableWebhookClient();

		// 1. Lister les webhooks
		console.log("📋 1. Webhooks existants:");
		const webhooks = await client.listWebhooks();

		if (webhooks.length === 0) {
			console.log("❌ Aucun webhook trouvé\n");
			return;
		}

		for (const webhook of webhooks) {
			console.log(`\n   ID: ${webhook.id}`);
			console.log(`   URL: ${webhook.notificationUrl}`);
			console.log(`   Enabled: ${webhook.isHookEnabled ? "✅" : "❌"}`);
			console.log(
				`   Notifications: ${webhook.areNotificationsEnabled ? "✅" : "❌"}`,
			);
			console.log(`   Expires: ${webhook.expirationTime}`);
			console.log(
				`   Last notification: ${webhook.lastSuccessfulNotificationTime || "❌ Never"}`,
			);

			// Vérifier la spécification
			if (webhook.specification) {
				console.log("\n   📝 Specification:");
				console.log(
					`      ${JSON.stringify(webhook.specification, null, 6).replace(/\n/g, "\n      ")}`,
				);
			}

			// Analyse
			console.log("\n   🔍 Analyse:");
			if (!webhook.isHookEnabled) {
				console.log("      ⚠️  Webhook désactivé");
			}
			if (!webhook.areNotificationsEnabled) {
				console.log("      ⚠️  Notifications désactivées");
			}
			if (!webhook.lastSuccessfulNotificationTime) {
				console.log("      ⚠️  Aucune notification reçue (jamais déclenché)");
			}

			// Analyse
			console.log("\n   🔍 Analyse:");

			// Analyse
			console.log("\n   🔍 Analyse:");
			if (!webhook.isHookEnabled) {
				console.log("      ⚠️  Webhook désactivé");
			}
			if (!webhook.areNotificationsEnabled) {
				console.log("      ⚠️  Notifications désactivées");
			}
			if (!webhook.lastSuccessfulNotificationTime) {
				console.log("      ⚠️  Aucune notification reçue (jamais déclenché)");
			}

			// Date d'expiration
			const expiresAt = new Date(webhook.expirationTime);
			const now = new Date();
			const daysUntilExpiry = Math.floor(
				(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
			);

			if (daysUntilExpiry < 0) {
				console.log("      ❌ Webhook expiré !");
			} else if (daysUntilExpiry < 7) {
				console.log(`      ⚠️  Expire dans ${daysUntilExpiry} jours`);
			} else {
				console.log(`      ✅ Expire dans ${daysUntilExpiry} jours`);
			}
		}

		// 2. Tester l'endpoint
		console.log("\n\n🌐 2. Test de l'endpoint Railway:");
		const webhookUrl = webhooks[0]?.notificationUrl;
		if (webhookUrl) {
			const baseUrl = webhookUrl.replace("/webhooks/airtable/refresh", "");
			console.log(`   Testing: ${baseUrl}/health`);

			try {
				const response = await fetch(`${baseUrl}/health`);
				if (response.ok) {
					const data = (await response.json()) as {
						status: string;
						backend: string;
						tables: number;
					};
					console.log("   ✅ Railway accessible");
					console.log(`   Status: ${data.status}`);
					console.log(`   Backend: ${data.backend}`);
					console.log(`   Tables: ${data.tables}`);
				} else {
					console.log(`   ❌ Railway répond avec erreur: ${response.status}`);
				}
			} catch (error) {
				console.log("   ❌ Impossible d'atteindre Railway:");
				console.log(`      ${error instanceof Error ? error.message : error}`);
			}
		}

		// 3. Instructions
		console.log("\n\n📝 3. Prochaines étapes:");
		console.log(
			"\n   Pour tester le webhook, modifiez une cellule dans Airtable:",
		);
		console.log("   1. Ouvrez votre base Airtable");
		console.log("   2. Modifiez n'importe quelle cellule");
		console.log("   3. Attendez 10-15 secondes");
		console.log("   4. Relancez: bun scripts/test-webhook-status.ts");
		console.log("   5. Vérifiez si 'Last notification' a changé\n");

		console.log("   Vérifier les logs Railway:");
		console.log("   - Cherchez des messages contenant 'webhook' ou 'refresh'");
		console.log("   - Erreurs possibles: 'Invalid signature', 'Rate limit'\n");
	} catch (error) {
		console.error(
			"\n❌ Erreur:",
			error instanceof Error ? error.message : error,
		);
		process.exit(1);
	}
}

main();
