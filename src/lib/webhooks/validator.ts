/**
 * Webhook Validator
 * Validates and synchronizes webhooks between SQLite and Airtable on startup
 *
 * Scenarios handled:
 * - Stored webhook ID doesn't exist in Airtable → clear config + recreate
 * - Webhook exists in Airtable but not in SQLite → delete + recreate (to get macSecretBase64)
 * - Multiple webhooks with same URL → keep the one matching config, delete others
 */

import { config } from "../../config";
import { AirtableWebhookClient } from "../airtable/webhook-client";
import { loggers } from "../logger";
import { sqliteService } from "../sqlite";

const logger = loggers.webhook;

export interface ValidationResult {
	status: "synced" | "recreated" | "cleaned" | "skipped";
	webhookId?: string;
	actions: string[];
}

/**
 * Validate and synchronize webhooks between SQLite and Airtable
 * Called before autoSetupWebhooks() to ensure consistency
 */
export async function validateAndSyncWebhooks(): Promise<ValidationResult> {
	const actions: string[] = [];

	// Skip if no public URL configured (autoSetupWebhooks will also skip)
	if (!config.webhookPublicUrl) {
		logger.info("Webhook validation skipped: WEBHOOK_PUBLIC_URL not configured");
		return { status: "skipped", actions: ["No WEBHOOK_PUBLIC_URL configured"] };
	}

	const webhookUrl = `${config.webhookPublicUrl}/webhooks/airtable/refresh`;

	logger.start("Starting webhook validation...");

	try {
		const client = new AirtableWebhookClient();

		// Get stored config from SQLite
		const storedConfig = await sqliteService.getWebhookConfig();

		// List all webhooks from Airtable
		const airtableWebhooks = await client.listWebhooks();

		// Filter webhooks matching our URL
		const matchingWebhooks = airtableWebhooks.filter((wh) => wh.notificationUrl === webhookUrl);

		logger.info("Validation state", {
			storedWebhookId: storedConfig?.webhookId || "none",
			airtableWebhooksCount: airtableWebhooks.length,
			matchingUrlCount: matchingWebhooks.length,
		});

		// Case A: We have a stored config
		if (storedConfig) {
			const storedWebhookExists = airtableWebhooks.some((wh) => wh.id === storedConfig.webhookId);

			if (storedWebhookExists) {
				// Webhook is valid - check for duplicates to clean up
				const duplicates = matchingWebhooks.filter((wh) => wh.id !== storedConfig.webhookId);

				if (duplicates.length > 0) {
					logger.warn(`Found ${duplicates.length} duplicate webhook(s), cleaning up`);
					for (const duplicate of duplicates) {
						try {
							await client.deleteWebhook(duplicate.id);
							actions.push(`Deleted duplicate webhook: ${duplicate.id}`);
							logger.info(`Deleted duplicate webhook: ${duplicate.id}`);
						} catch (error) {
							logger.error(`Failed to delete duplicate ${duplicate.id}`, error);
						}
					}

					logger.success("Webhook validation complete: cleaned duplicates", {
						webhookId: storedConfig.webhookId,
					});
					return {
						status: "cleaned",
						webhookId: storedConfig.webhookId,
						actions,
					};
				}

				// Everything is synced
				logger.success("Webhook validation complete: already synced", {
					webhookId: storedConfig.webhookId,
				});
				return {
					status: "synced",
					webhookId: storedConfig.webhookId,
					actions: ["Webhook already synchronized"],
				};
			}

			// Stored webhook doesn't exist in Airtable anymore
			logger.warn(`Stored webhook ${storedConfig.webhookId} not found in Airtable`);
			actions.push(`Stored webhook ${storedConfig.webhookId} not found in Airtable`);

			// Clear local config
			await sqliteService.clearWebhookConfig();
			actions.push("Cleared local webhook config");

			// Delete any orphan webhooks with our URL
			for (const orphan of matchingWebhooks) {
				try {
					await client.deleteWebhook(orphan.id);
					actions.push(`Deleted orphan webhook: ${orphan.id}`);
					logger.info(`Deleted orphan webhook: ${orphan.id}`);
				} catch (error) {
					logger.error(`Failed to delete orphan ${orphan.id}`, error);
				}
			}

			// Create new webhook
			const newWebhook = await client.createWebhook(webhookUrl);
			actions.push(`Created new webhook: ${newWebhook.id}`);

			// Enable notifications
			await client.enableNotifications(newWebhook.id);
			actions.push("Enabled notifications");

			logger.success("Webhook validation complete: recreated", {
				oldWebhookId: storedConfig.webhookId,
				newWebhookId: newWebhook.id,
			});

			return {
				status: "recreated",
				webhookId: newWebhook.id,
				actions,
			};
		}

		// Case B: No stored config
		if (matchingWebhooks.length > 0) {
			// Orphan webhooks exist without local config - delete and recreate
			logger.warn(`Found ${matchingWebhooks.length} orphan webhook(s) without local config`);
			actions.push(`Found ${matchingWebhooks.length} orphan webhook(s) without local config`);

			// Delete all orphan webhooks
			for (const orphan of matchingWebhooks) {
				try {
					await client.deleteWebhook(orphan.id);
					actions.push(`Deleted orphan webhook: ${orphan.id}`);
					logger.info(`Deleted orphan webhook: ${orphan.id}`);
				} catch (error) {
					logger.error(`Failed to delete orphan ${orphan.id}`, error);
				}
			}

			// Create new webhook (to get macSecretBase64)
			const newWebhook = await client.createWebhook(webhookUrl);
			actions.push(`Created new webhook: ${newWebhook.id}`);

			// Enable notifications
			await client.enableNotifications(newWebhook.id);
			actions.push("Enabled notifications");

			logger.success("Webhook validation complete: recreated from orphans", {
				webhookId: newWebhook.id,
			});

			return {
				status: "recreated",
				webhookId: newWebhook.id,
				actions,
			};
		}

		// No stored config and no matching webhooks - autoSetupWebhooks will handle creation
		logger.info("No webhook config found - autoSetupWebhooks will create one");
		return {
			status: "skipped",
			actions: ["No existing webhook - will be created by autoSetupWebhooks"],
		};
	} catch (error) {
		logger.error("Webhook validation failed", error);
		throw error;
	}
}
