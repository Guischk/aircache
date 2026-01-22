/**
 * Airtable Metadata Mapping Generator
 *
 * Fetches table and field metadata from Airtable Metadata API
 * and generates mappings between table IDs, original names, and normalized names.
 */

import { normalizeKey } from "../utils/index";

/**
 * Field metadata from Airtable
 */
export interface FieldMetadata {
	id: string;
	name: string;
	type: string;
}

/**
 * Table mapping structure
 */
export interface TableMapping {
	id: string;
	originalName: string;
	normalizedName: string;
	primaryFieldId: string;
	fields: Record<string, FieldMetadata>;
}

/**
 * Complete mapping data structure
 */
export interface MappingData {
	generatedAt: string;
	baseId: string;
	tables: Record<string, TableMapping>;
}

/**
 * Raw Airtable Metadata API response
 */
interface AirtableMetadataResponse {
	tables: Array<{
		id: string;
		name: string;
		primaryFieldId: string;
		fields: Array<{
			id: string;
			name: string;
			type: string;
		}>;
	}>;
}

/**
 * Fetch table and field mappings from Airtable Metadata API
 */
export async function fetchAirtableMetadata(): Promise<MappingData> {
	const token = process.env.AIRTABLE_PERSONAL_TOKEN;
	const baseId = process.env.AIRTABLE_BASE_ID;

	if (!token || !baseId) {
		throw new Error(
			"Missing AIRTABLE_PERSONAL_TOKEN or AIRTABLE_BASE_ID environment variables",
		);
	}

	console.log(`📡 Fetching metadata from Airtable API for base ${baseId}...`);

	const response = await fetch(
		`https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
		{
			headers: {
				Authorization: `Bearer ${token}`,
			},
		},
	);

	if (!response.ok) {
		throw new Error(
			`Failed to fetch Airtable metadata: ${response.status} ${response.statusText}`,
		);
	}

	const data = (await response.json()) as AirtableMetadataResponse;

	return transformToMappingFormat(data, baseId);
}

/**
 * Transform Airtable API response to our mapping format
 */
function transformToMappingFormat(
	data: AirtableMetadataResponse,
	baseId: string,
): MappingData {
	const tables: Record<string, TableMapping> = {};

	for (const table of data.tables) {
		const normalizedName = normalizeKey(table.name);

		// Build fields mapping
		const fields: Record<string, FieldMetadata> = {};
		for (const field of table.fields) {
			fields[field.id] = {
				id: field.id,
				name: field.name,
				type: field.type,
			};
		}

		tables[table.id] = {
			id: table.id,
			originalName: table.name,
			normalizedName,
			primaryFieldId: table.primaryFieldId,
			fields,
		};
	}

	console.log(
		`✅ Fetched metadata for ${data.tables.length} tables from Airtable`,
	);

	return {
		generatedAt: new Date().toISOString(),
		baseId,
		tables,
	};
}

/**
 * Generate mappings.json file
 */
export async function generateMappingsFile(): Promise<void> {
	console.log("🔄 Generating mappings.json file...");

	const metadata = await fetchAirtableMetadata();
	const outputPath = "./src/lib/airtable/mappings.json";

	await Bun.write(outputPath, JSON.stringify(metadata, null, 2));

	console.log(`✅ Mappings file generated: ${outputPath}`);
	console.log(`   Tables: ${Object.keys(metadata.tables).length}`);
}

/**
 * Sync mappings to SQLite databases (v1 and v2)
 */
export async function syncMappingsToDatabase(): Promise<void> {
	console.log("🔄 Syncing mappings to SQLite databases...");

	// Read mappings file
	const mappingsFile = Bun.file("./src/lib/airtable/mappings.json");

	if (!(await mappingsFile.exists())) {
		console.warn(
			"⚠️ mappings.json not found. Run 'bun run types:mappings' first.",
		);
		return;
	}

	const mappingsData = (await mappingsFile.json()) as MappingData;

	// Import SQLite service
	const { sqliteService } = await import("../sqlite/index");

	// Ensure databases are initialized
	await sqliteService.connect();

	// Sync to both v1 and v2 databases
	let syncedCount = 0;

	for (const [tableId, tableData] of Object.entries(mappingsData.tables)) {
		// Sync to both databases (with null checks)
		const v1Db = sqliteService.v1Db;
		const v2Db = sqliteService.v2Db;

		if (!v1Db || !v2Db) {
			throw new Error("Database initialization failed");
		}

		await sqliteService.upsertTableMapping(v1Db, tableData);
		await sqliteService.upsertTableMapping(v2Db, tableData);
		syncedCount++;
	}

	console.log(`✅ Synced ${syncedCount} table mappings to both databases`);
}

/**
 * CLI Mode
 * Usage: bun src/lib/airtable/mapping-generator.ts [generate|sync]
 */
if (import.meta.main) {
	const command = process.argv[2];

	try {
		if (command === "generate") {
			await generateMappingsFile();
		} else if (command === "sync") {
			await syncMappingsToDatabase();
		} else {
			console.error("Usage: bun mapping-generator.ts [generate|sync]");
			process.exit(1);
		}
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
}
