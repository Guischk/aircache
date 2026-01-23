/**
 * Base Change Detector
 *
 * Detects when the Airtable base ID has changed and handles the necessary
 * reset of cached data and webhooks.
 */

import { config } from "../config";
import { loggers } from "./logger";

const logger = loggers.server;

export interface BaseChangeResult {
	changed: boolean;
	previousBaseId: string | null;
	currentBaseId: string;
	isFirstInitialization: boolean;
}

/**
 * Detect if the Airtable base has changed and handle the transition.
 *
 * This function:
 * 1. Compares the current AIRTABLE_BASE_ID with the stored one
 * 2. If different (or first initialization):
 *    - Clears all cached data in v1/v2 databases
 *    - Clears webhook configuration
 *    - Stores the new base ID
 *
 * @returns BaseChangeResult with details about the change
 */
export async function detectAndHandleBaseChange(): Promise<BaseChangeResult> {
	const { sqliteService } = await import("./sqlite/index");

	const currentBaseId = config.airtableBaseId;
	const storedBaseId = sqliteService.getStoredBaseId();

	const isFirstInitialization = storedBaseId === null;
	const hasChanged = storedBaseId !== currentBaseId;

	// No change detected, continue normally
	if (!hasChanged) {
		logger.debug("Base ID unchanged, continuing normally", {
			baseId: currentBaseId,
		});
		return {
			changed: false,
			previousBaseId: storedBaseId,
			currentBaseId,
			isFirstInitialization: false,
		};
	}

	// Log the change
	if (isFirstInitialization) {
		logger.start("First initialization detected, setting up Airtable base...", {
			baseId: currentBaseId,
		});
	} else {
		logger.warn("Airtable base change detected!", {
			previousBaseId: storedBaseId,
			newBaseId: currentBaseId,
		});
		logger.start("Resetting cached data...");
	}

	// Note: schema.ts and mappings.json regeneration is handled by the build process/startup script
	// We assume they are up to date if the app is restarting with a new configuration.

	// Step 1: Clear cached data (only if not first initialization)
	if (!isFirstInitialization) {
		logger.info("Clearing cached data from previous base...");
		await sqliteService.clearAllCachedData();
		logger.success("Cached data cleared");
	}

	// Step 2: Clear webhook metadata
	logger.info("Clearing webhook configuration...");
	await sqliteService.clearWebhookMetadata();
	logger.success("Webhook configuration cleared");

	// Step 3: Store the new base ID
	sqliteService.setStoredBaseId(currentBaseId);

	// Final log
	if (isFirstInitialization) {
		logger.success("First initialization completed", { baseId: currentBaseId });
	} else {
		logger.success("Base change handled successfully", {
			previousBaseId: storedBaseId,
			newBaseId: currentBaseId,
		});
	}

	return {
		changed: true,
		previousBaseId: storedBaseId,
		currentBaseId,
		isFirstInitialization,
	};
}
