/**
 * Configuration file for Aircache
 * Simple configuration with environment variables
 */

export interface Config {
	// Server settings
	port: number;

	// Airtable settings
	airtableToken: string;
	airtableBaseId: string;

	// API settings
	bearerToken: string;

	// Cache settings
	refreshInterval: number;

	// Storage settings
	storagePath: string;
	enableAttachmentDownload: boolean;

	// Webhook settings
	webhookSecret: string;
	webhookRateLimit: number;
	webhookTimestampWindow: number;
	webhookIdempotencyTTL: number;
	webhookAutoSetup: boolean;
	webhookPublicUrl: string;

	// Logger settings
	logLevel: number;
	logFancy: boolean;
}

export function loadConfig(): Config {
	// Required environment variables
	const airtableToken = process.env.AIRTABLE_PERSONAL_TOKEN;
	const airtableBaseId = process.env.AIRTABLE_BASE_ID;
	const bearerToken = process.env.BEARER_TOKEN;

	if (!airtableToken || !airtableBaseId || !bearerToken) {
		throw new Error(
			"Missing required environment variables. Please set:\n" +
				"- AIRTABLE_PERSONAL_TOKEN\n" +
				"- AIRTABLE_BASE_ID\n" +
				"- BEARER_TOKEN",
		);
	}

	return {
		port: Number.parseInt(process.env.PORT || "3000"),
		airtableToken,
		airtableBaseId,
		bearerToken,
		refreshInterval: Number.parseInt(process.env.REFRESH_INTERVAL || "86400"), // 24 hours default
		storagePath: process.env.STORAGE_PATH || "./data/attachments",
		enableAttachmentDownload:
			process.env.ENABLE_ATTACHMENT_DOWNLOAD !== "false", // Default to true

		// Webhook settings
		webhookSecret: process.env.WEBHOOK_SECRET || "",
		webhookRateLimit: Number.parseInt(process.env.WEBHOOK_RATE_LIMIT || "30"), // seconds
		webhookTimestampWindow: Number.parseInt(
			process.env.WEBHOOK_TIMESTAMP_WINDOW || "300",
		), // 5 minutes
		webhookIdempotencyTTL: Number.parseInt(
			process.env.WEBHOOK_IDEMPOTENCY_TTL || "86400",
		), // 24 hours
		webhookAutoSetup: process.env.WEBHOOK_AUTO_SETUP !== "false", // Default to true
		webhookPublicUrl: process.env.WEBHOOK_PUBLIC_URL || "", // e.g., https://aircache.example.com

		// Logger settings
		logLevel: Number.parseInt(process.env.CONSOLA_LEVEL || "3"), // 3 = info level
		logFancy: process.env.CONSOLA_FANCY !== "false", // Default to true
	};
}

// Export the config for use in other files
export const config = loadConfig();
