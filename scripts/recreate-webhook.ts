#!/usr/bin/env bun

/**
 * Recréer le webhook Airtable avec vérification complète
 */

import { config } from "../src/config";
import { AirtableWebhookClient } from "../src/lib/airtable/webhook-client";

async function main() {
	console.log("🔄 Recréation du webhook Airtable\n");

	if (!config.webhookSecret) {
		console.error("❌ WEBHOOK_SECRET non configuré");
		console.error("\nGénérez un secret avec:");
		console.error("  openssl rand -hex 32");
		console.error("\nPuis ajoutez-le à votre .env:");
		console.error("  WEBHOOK_SECRET=<votre_secret_hex>");
		process.exit(1);
	}

	if (!config.webhookPublicUrl) {
		console.error("❌ WEBHOOK_PUBLIC_URL non configuré");
		console.error("\nAjoutez à votre .env:");
		console.error(
			"  WEBHOOK_PUBLIC_URL=https://aircache-production.up.railway.app",
		);
		process.exit(1);
	}

	try {
		const client = new AirtableWebhookClient();
		const webhookUrl = `${config.webhookPublicUrl}/webhooks/airtable/refresh`;

		// 1. Lister les webhooks existants
		console.log("📋 1. Webhooks existants:");
		const webhooks = await client.listWebhooks();

		if (webhooks.length > 0) {
			console.log(`   Trouvé ${webhooks.length} webhook(s):\n`);
			for (const webhook of webhooks) {
				console.log(`   - ID: ${webhook.id}`);
				console.log(`     URL: ${webhook.notificationUrl}`);
				console.log(`     Enabled: ${webhook.isHookEnabled}`);
				console.log(`     Notifications: ${webhook.areNotificationsEnabled}`);
				console.log(
					`     Last notification: ${webhook.lastSuccessfulNotificationTime || "Never"}\n`,
				);
			}

			// Demander confirmation
			console.log("⚠️  Des webhooks existent déjà. Voulez-vous les supprimer ?");
			console.log("   Tapez 'oui' pour continuer, ou Ctrl+C pour annuler\n");

			// Attendre input utilisateur
			const input = await new Promise<string>((resolve) => {
				process.stdin.once("data", (data) => {
					resolve(data.toString().trim().toLowerCase());
				});
			});

			if (input !== "oui" && input !== "yes" && input !== "y") {
				console.log("❌ Annulé");
				process.exit(0);
			}

			// Supprimer tous les webhooks existants
			console.log("\n🗑️  2. Suppression des webhooks existants...");
			for (const webhook of webhooks) {
				console.log(`   Suppression de ${webhook.id}...`);
				await client.deleteWebhook(webhook.id);
			}
			console.log("   ✅ Webhooks supprimés\n");
		} else {
			console.log("   Aucun webhook existant\n");
		}

		// 2. Vérifier que l'endpoint est accessible
		console.log("🌐 2. Vérification de l'endpoint Railway...");
		console.log(`   URL: ${config.webhookPublicUrl}/health`);

		try {
			const response = await fetch(`${config.webhookPublicUrl}/health`);
			if (response.ok) {
				const data = (await response.json()) as { status: string };
				console.log(`   ✅ Railway accessible (status: ${data.status})\n`);
			} else {
				console.log(`   ⚠️  Railway répond avec code: ${response.status}`);
				console.log(
					"   Continuons quand même, mais vérifiez votre déploiement\n",
				);
			}
		} catch (error) {
			console.error("   ❌ Impossible d'atteindre Railway:");
			console.error(`      ${error instanceof Error ? error.message : error}`);
			console.error(
				"\n   Vérifiez que WEBHOOK_PUBLIC_URL est correct et que Railway est déployé",
			);
			process.exit(1);
		}

		// 3. Créer le nouveau webhook
		console.log("🔗 3. Création du nouveau webhook...");
		console.log(`   URL: ${webhookUrl}`);
		console.log(
			`   Secret: ${config.webhookSecret.substring(0, 10)}... (${config.webhookSecret.length} chars)\n`,
		);

		const result = await client.setupWebhook(webhookUrl);

		console.log("\n✅ Webhook créé avec succès!");
		console.log(`   Webhook ID: ${result.webhookId}`);
		console.log(
			`   Created: ${result.created ? "Nouveau webhook" : "Webhook existant"}`,
		);

		// 4. Vérifier le webhook
		console.log("\n📋 4. Vérification du webhook...");
		const newWebhooks = await client.listWebhooks();
		const newWebhook = newWebhooks.find((w) => w.id === result.webhookId);

		if (newWebhook) {
			console.log(`   Enabled: ${newWebhook.isHookEnabled ? "✅" : "❌"}`);
			console.log(
				`   Notifications: ${newWebhook.areNotificationsEnabled ? "✅" : "❌"}`,
			);
			console.log(`   Expires: ${newWebhook.expirationTime}`);

			if (!newWebhook.areNotificationsEnabled) {
				console.log("\n⚠️  Les notifications ne sont pas activées!");
				console.log(
					"   Cela signifie qu'Airtable n'a pas pu vérifier l'endpoint.",
				);
				console.log(
					"   Vérifiez les logs Railway pour des erreurs de signature HMAC.",
				);
			}
		}

		// 5. Instructions finales
		console.log("\n\n📝 Prochaines étapes:");
		console.log("\n1. Vérifiez que Railway a le même WEBHOOK_SECRET:");
		console.log(
			`   Dans Railway → Variables → WEBHOOK_SECRET=${config.webhookSecret}`,
		);
		console.log("\n2. Testez en modifiant une cellule dans Airtable");
		console.log("   Attendez 10-15 secondes");
		console.log(
			"\n3. Vérifiez les logs Railway pour voir les requêtes entrantes:",
		);
		console.log(
			'   Cherchez "Received Airtable webhook" ou "Invalid signature"',
		);
		console.log("\n4. Vérifiez le statut du webhook:");
		console.log("   bun scripts/manage-webhooks.ts list");
		console.log('   Regardez si "Last notification" a changé\n');
	} catch (error) {
		console.error(
			"\n❌ Erreur:",
			error instanceof Error ? error.message : error,
		);
		process.exit(1);
	}
}

main();
