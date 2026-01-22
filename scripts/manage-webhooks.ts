#!/usr/bin/env bun

/**
 * CLI utility to manage Airtable webhooks
 * Usage:
 *   bun scripts/manage-webhooks.ts list
 *   bun scripts/manage-webhooks.ts create <public-url>
 *   bun scripts/manage-webhooks.ts delete <webhook-id>
 *   bun scripts/manage-webhooks.ts enable <webhook-id>
 */

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
					console.log(
						`Last notification: ${webhook.lastSuccessfulNotificationTime || "Never"}`,
					);
					console.log("---");
				}
				break;
			}

			case "create": {
				if (!arg) {
					console.error("❌ Error: Public URL required");
					console.error(
						"Usage: bun scripts/manage-webhooks.ts create <public-url>",
					);
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
					console.error(
						"Usage: bun scripts/manage-webhooks.ts delete <webhook-id>",
					);
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
					console.error(
						"Usage: bun scripts/manage-webhooks.ts enable <webhook-id>",
					);
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
					console.error(
						"Usage: bun scripts/manage-webhooks.ts setup <public-url>",
					);
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

			default:
				console.log("Aircache Webhook Manager\n");
				console.log("Usage:");
				console.log("  bun scripts/manage-webhooks.ts list");
				console.log("  bun scripts/manage-webhooks.ts create <public-url>");
				console.log("  bun scripts/manage-webhooks.ts delete <webhook-id>");
				console.log("  bun scripts/manage-webhooks.ts enable <webhook-id>");
				console.log("  bun scripts/manage-webhooks.ts setup <public-url>");
				console.log("\nExamples:");
				console.log("  bun scripts/manage-webhooks.ts list");
				console.log(
					"  bun scripts/manage-webhooks.ts setup https://aircache.example.com",
				);
				console.log(
					"  bun scripts/manage-webhooks.ts delete achw8xKJN2m3PqRst",
				);
				process.exit(1);
		}
	} catch (error) {
		console.error(
			"\n❌ Error:",
			error instanceof Error ? error.message : error,
		);
		process.exit(1);
	}
}

main();
