/**
 * Auto-setup webhooks on server startup
 * Automatically creates/configures Airtable webhooks if enabled
 */

import { config } from "../../config";
import { AirtableWebhookClient } from "../airtable/webhook-client";
import { loggers } from "../logger";

const logger = loggers.webhook;

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
		logger.info("Webhook auto-setup disabled (WEBHOOK_AUTO_SETUP=false)");
		return;
	}

	// Check if public URL is configured
	if (!config.webhookPublicUrl) {
		logger.warn(
			"Webhook auto-setup skipped: WEBHOOK_PUBLIC_URL not configured",
		);
		logger.warn("Set WEBHOOK_PUBLIC_URL to enable automatic webhook creation");
		return;
	}

	// Check if webhook secret is configured
	if (!config.webhookSecret) {
		logger.warn("Webhook auto-setup skipped: WEBHOOK_SECRET not configured");
		logger.warn("Generate a secret with: openssl rand -hex 32");
		return;
	}

	try {
		logger.start("Starting webhook auto-setup...");

		const client = new AirtableWebhookClient();
		const webhookUrl = `${config.webhookPublicUrl}/webhooks/airtable/refresh`;

		const result = await client.setupWebhook(webhookUrl);

		if (result.created) {
			logger.success("Webhook auto-setup complete (new webhook created)", {
				webhookId: result.webhookId,
				endpoint: webhookUrl,
			});
		} else {
			logger.success("Webhook auto-setup complete (existing webhook found)", {
				webhookId: result.webhookId,
				endpoint: webhookUrl,
			});
		}
	} catch (error) {
		logger.error("Webhook auto-setup failed:", error);
		logger.error(
			"You can manually create webhooks or disable auto-setup with WEBHOOK_AUTO_SETUP=false",
		);
		// Don't throw - webhook setup failure shouldn't prevent server startup
	}
}
