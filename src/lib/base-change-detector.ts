/**
 * Base Change Detector
 *
 * Detects when the Airtable base ID has changed and handles the necessary
 * reset of cached data, webhooks, and schema regeneration.
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
 *    - Regenerates schema.ts via airtable-types-gen
 *    - Regenerates mappings.json from Airtable Metadata API
 *    - Clears all cached data in v1/v2 databases
 *    - Clears webhook configuration
 *    - Stores the new base ID
 *
 * @returns BaseChangeResult with details about the change
 * @throws Error if regeneration fails (service cannot start with invalid schema)
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
		logger.start("Resetting cached data and regenerating schema...");
	}

	// Step 1: Regenerate schema.ts
	logger.info("Regenerating Airtable schema (schema.ts)...");
	const schemaSuccess = await regenerateSchema();
	if (!schemaSuccess) {
		throw new Error(
			"Failed to regenerate Airtable schema. " +
				"Please check your AIRTABLE_PERSONAL_TOKEN and AIRTABLE_BASE_ID. " +
				"The service cannot start without a valid schema.",
		);
	}
	logger.success("Schema regenerated successfully");

	// Step 2: Regenerate mappings.json
	logger.info("Regenerating table mappings (mappings.json)...");
	const mappingsSuccess = await regenerateMappings();
	if (!mappingsSuccess) {
		throw new Error(
			"Failed to regenerate table mappings. " +
				"Please check your Airtable API access. " +
				"The service cannot start without valid mappings.",
		);
	}
	logger.success("Mappings regenerated successfully");

	// Step 3: Clear cached data (only if not first initialization)
	if (!isFirstInitialization) {
		logger.info("Clearing cached data from previous base...");
		await sqliteService.clearAllCachedData();
		logger.success("Cached data cleared");
	}

	// Step 4: Clear webhook metadata
	logger.info("Clearing webhook configuration...");
	await sqliteService.clearWebhookMetadata();
	logger.success("Webhook configuration cleared");

	// Step 5: Store the new base ID
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

/**
 * Regenerate schema.ts using airtable-types-gen
 */
async function regenerateSchema(): Promise<boolean> {
	try {
		const { updateAirtableSchema } = await import("./airtable/schema-updater");
		return await updateAirtableSchema();
	} catch (error) {
		logger.error("Error regenerating schema", error);
		return false;
	}
}

/**
 * Regenerate mappings.json from Airtable Metadata API
 */
async function regenerateMappings(): Promise<boolean> {
	try {
		const { generateMappingsFile } = await import("./airtable/mapping-generator");
		await generateMappingsFile();
		return true;
	} catch (error) {
		logger.error("Error regenerating mappings", error);
		return false;
	}
}
