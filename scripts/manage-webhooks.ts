#!/usr/bin/env bun

/**
 * CLI utility to manage Airtable webhooks
 * Usage:
 *   bun scripts/manage-webhooks.ts list
 *   bun scripts/manage-webhooks.ts create <public-url>
 *   bun scripts/manage-webhooks.ts delete <webhook-id>
 *   bun scripts/manage-webhooks.ts enable <webhook-id>
 *   bun scripts/manage-webhooks.ts test [url]
 */

import { config } from "../src/config";
import { AirtableWebhookClient } from "../src/lib/airtable/webhook-client";

const command = process.argv[2];
const arg = process.argv[3];

async function main() {
	try {
		const client = new AirtableWebhookClient();

		switch (command) {
			case "list": {
				console.log("📋 Listing webhooks...\n");
				const webhooks = await client.listWebhooks();

				if (webhooks.length === 0) {
					console.log("No webhooks found.");
					break;
				}

				for (const webhook of webhooks) {
					console.log(`ID: ${webhook.id}`);
					console.log(`URL: ${webhook.notificationUrl}`);
					console.log(`Enabled: ${webhook.isHookEnabled}`);
					console.log(`Notifications: ${webhook.areNotificationsEnabled}`);
					console.log(`Expires: ${webhook.expirationTime}`);
					console.log(`Last notification: ${webhook.lastSuccessfulNotificationTime || "Never"}`);
					console.log("---");
				}
				break;
			}

			case "create": {
				if (!arg) {
					console.error("❌ Error: Public URL required");
					console.error("Usage: bun scripts/manage-webhooks.ts create <public-url>");
					process.exit(1);
				}

				console.log(`🔗 Creating webhook for ${arg}...\n`);
				const result = await client.createWebhook(arg);

				console.log("\n✅ Webhook created successfully!");
				console.log(`ID: ${result.id}`);
				console.log(`Secret (base64): ${result.macSecretBase64}`);
				console.log(`Expires: ${result.expirationTime}`);
				console.log("\n⚠️  Save the secret - you won't see it again!");
				break;
			}

			case "delete": {
				if (!arg) {
					console.error("❌ Error: Webhook ID required");
					console.error("Usage: bun scripts/manage-webhooks.ts delete <webhook-id>");
					process.exit(1);
				}

				console.log(`🗑️  Deleting webhook ${arg}...\n`);
				await client.deleteWebhook(arg);
				console.log("✅ Webhook deleted successfully!");
				break;
			}

			case "enable": {
				if (!arg) {
					console.error("❌ Error: Webhook ID required");
					console.error("Usage: bun scripts/manage-webhooks.ts enable <webhook-id>");
					process.exit(1);
				}

				console.log(`🔔 Enabling notifications for webhook ${arg}...\n`);
				await client.enableNotifications(arg);
				console.log("✅ Notifications enabled successfully!");
				break;
			}

			case "setup": {
				if (!arg) {
					console.error("❌ Error: Public URL required");
					console.error("Usage: bun scripts/manage-webhooks.ts setup <public-url>");
					process.exit(1);
				}

				console.log(`🚀 Setting up webhook for ${arg}...\n`);
				const result = await client.setupWebhook(arg);

				if (result.created) {
					console.log("\n✅ New webhook created and configured!");
				} else {
					console.log("\n✅ Existing webhook found and verified!");
				}

				console.log(`Webhook ID: ${result.webhookId}`);
				break;
			}

			case "test": {
				const targetUrl = arg || "http://localhost:3000";
				const webhookEndpoint = `${targetUrl}/webhooks/airtable/refresh`;

				console.log("🧪 Testing webhook endpoint\n");
				console.log(`Target: ${webhookEndpoint}\n`);

				// Récupérer le secret stocké dans la base de données
				const { sqliteService } = await import("../src/lib/sqlite");
				await sqliteService.connect();
				const webhookConfig = await sqliteService.getWebhookConfig();

				if (!webhookConfig) {
					console.error("❌ No webhook configuration found in database");
					console.error("\nCreate a webhook first with:");
					console.error("  bun scripts/manage-webhooks.ts setup <public-url>");
					process.exit(1);
				}

				console.log(`Webhook ID: ${webhookConfig.webhookId}`);
				console.log(`Secret: ${webhookConfig.macSecretBase64.substring(0, 10)}...\n`);

				// Créer un payload de test (format notification Airtable)
				const timestamp = new Date().toISOString();
				const payload = {
					base: { id: config.airtableBaseId },
					webhook: { id: webhookConfig.webhookId },
					timestamp,
				};

				const payloadString = JSON.stringify(payload);

				// Calculer la signature HMAC exactement comme Airtable
				const { calculateWebhookHmac } = await import("../src/lib/airtable/webhook-hmac");
				const hash = calculateWebhookHmac(webhookConfig.macSecretBase64, payloadString);
				const signature = `hmac-sha256=${hash}`;

				console.log("📝 Sending test payload...");
				console.log(`Signature: ${signature.substring(0, 30)}...\n`);

				try {
					const response = await fetch(webhookEndpoint, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Airtable-Content-MAC": signature,
						},
						body: payloadString,
					});

					const responseText = await response.text();
					let responseJson: unknown = null;

					try {
						responseJson = JSON.parse(responseText);
					} catch {
						responseJson = null;
					}

					console.log(`📥 Response: ${response.status} ${response.statusText}\n`);

					if (responseJson) {
						console.log("📄 Response body:");
						console.log(JSON.stringify(responseJson, null, 2));
					} else {
						console.log("📄 Response body (raw):");
						console.log(responseText);
					}

					console.log("\n");

					// Interpréter la réponse
					if (response.status === 200) {
						console.log("✅ Webhook test successful!");
						console.log("\nThe endpoint is working correctly and the signature is valid.");
					} else if (response.status === 401) {
						console.log("❌ Authentication failed (401)");
						console.log("\nPossible causes:");
						console.log("  - Secret mismatch between local DB and server");
						console.log("  - Webhook was recreated with a different secret");
						console.log("\nRecreate the webhook with:");
						console.log("  bun scripts/manage-webhooks.ts setup <public-url>");
					} else if (response.status === 429) {
						console.log("⚠️  Rate limit exceeded (429)");
						console.log("\nToo many webhooks sent recently. Wait 30 seconds and try again.");
					} else if (response.status === 404) {
						console.log("❌ Endpoint not found (404)");
						console.log("\nPossible causes:");
						console.log("  - Server is not running");
						console.log("  - Incorrect URL");
						console.log("  - Webhook routes not configured");
					} else if (response.status === 500) {
						console.log("❌ Server error (500)");
						console.log("\nCheck the server logs for more details.");
					} else {
						console.log(`⚠️  Unexpected status code: ${response.status}`);
					}
				} catch (error) {
					console.error("\n❌ Request failed:");
					console.error(error instanceof Error ? error.message : String(error));
					console.error("\nPossible causes:");
					console.error("  - Server is not running");
					console.error("  - Network connection issue");
					console.error("  - Incorrect URL");
				}

				break;
			}

			default:
				console.log("Airboost Webhook Manager\n");
				console.log("Usage:");
				console.log("  bun scripts/manage-webhooks.ts list");
				console.log("  bun scripts/manage-webhooks.ts create <public-url>");
				console.log("  bun scripts/manage-webhooks.ts delete <webhook-id>");
				console.log("  bun scripts/manage-webhooks.ts enable <webhook-id>");
				console.log("  bun scripts/manage-webhooks.ts setup <public-url>");
				console.log("  bun scripts/manage-webhooks.ts test [url]");
				console.log("\nExamples:");
				console.log("  bun scripts/manage-webhooks.ts list");
				console.log("  bun scripts/manage-webhooks.ts setup https://airboost.example.com");
				console.log("  bun scripts/manage-webhooks.ts delete achw8xKJN2m3PqRst");
				console.log(
					"  bun scripts/manage-webhooks.ts test                              # Test localhost:3000",
				);
				console.log(
					"  bun scripts/manage-webhooks.ts test https://airboost.railway.app # Test Railway",
				);
				process.exit(1);
		}
	} catch (error) {
		console.error("\n❌ Error:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

main();
