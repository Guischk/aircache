/**
 * Auto-setup webhooks on server startup
 * Automatically creates/configures Airtable webhooks if enabled
 */

import { config } from "../../config";
import { AirtableWebhookClient } from "../airtable/webhook-client";

/**
 * Setup webhooks automatically on server startup
 * - Skips if WEBHOOK_AUTO_SETUP=false
 * - Skips if WEBHOOK_PUBLIC_URL not configured
 * - Skips if WEBHOOK_SECRET not configured
 * - Creates webhook if not exists
 * - Enables notifications
 */
export async function autoSetupWebhooks(): Promise<void> {
	// Check if auto-setup is enabled
	if (!config.webhookAutoSetup) {
		console.log("ℹ️  Webhook auto-setup disabled (WEBHOOK_AUTO_SETUP=false)");
		return;
	}

	// Check if public URL is configured
	if (!config.webhookPublicUrl) {
		console.log(
			"⚠️  Webhook auto-setup skipped: WEBHOOK_PUBLIC_URL not configured",
		);
		console.log(
			"   Set WEBHOOK_PUBLIC_URL to enable automatic webhook creation",
		);
		return;
	}

	// Check if webhook secret is configured
	if (!config.webhookSecret) {
		console.log("⚠️  Webhook auto-setup skipped: WEBHOOK_SECRET not configured");
		console.log("   Generate a secret with: openssl rand -hex 32");
		return;
	}

	try {
		console.log("🔗 Starting webhook auto-setup...");

		const client = new AirtableWebhookClient();
		const webhookUrl = `${config.webhookPublicUrl}/webhooks/airtable/refresh`;

		const result = await client.setupWebhook(webhookUrl);

		if (result.created) {
			console.log("✅ Webhook auto-setup complete (new webhook created)");
		} else {
			console.log("✅ Webhook auto-setup complete (existing webhook found)");
		}

		console.log(`   Webhook ID: ${result.webhookId}`);
		console.log(`   Endpoint: ${webhookUrl}`);
	} catch (error) {
		console.error("❌ Webhook auto-setup failed:", error);
		console.error(
			"   You can manually create webhooks or disable auto-setup with WEBHOOK_AUTO_SETUP=false",
		);
		// Don't throw - webhook setup failure shouldn't prevent server startup
	}
}
