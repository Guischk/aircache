/**
 * TypeScript types generator for Airboost
 * Generates ready-to-use TypeScript interfaces from table mappings
 */

import { sqliteService } from "../sqlite/index";

interface FieldMapping {
	id: string;
	name: string;
	type: string;
}

/**
 * Convert Airtable field type to TypeScript type
 */
function airtableTypeToTypeScript(airtableType: string): string {
	const typeMap: Record<string, string> = {
		singleLineText: "string",
		multilineText: "string",
		richText: "string",
		email: "string",
		url: "string",
		phoneNumber: "string",
		number: "number",
		currency: "number",
		percent: "number",
		duration: "number",
		rating: "number",
		autoNumber: "number",
		checkbox: "boolean",
		date: "string",
		dateTime: "string",
		createdTime: "string",
		lastModifiedTime: "string",
		singleSelect: "string",
		multipleSelects: "string[]",
		singleCollaborator: "object",
		multipleCollaborators: "object[]",
		multipleRecordLinks: "string[]",
		multipleAttachments:
			"Array<{ id: string; url: string; filename: string; size?: number; type?: string }>",
		barcode: "{ text: string; type?: string }",
		button: "{ label: string; url: string }",
		createdBy: "{ id: string; email?: string; name?: string }",
		lastModifiedBy: "{ id: string; email?: string; name?: string }",
		formula: "any",
		rollup: "any",
		count: "number",
		lookup: "any",
		multipleLookupValues: "any[]",
		externalSyncSource: "string",
	};

	return typeMap[airtableType] || "unknown";
}

/**
 * Generate TypeScript interface for a single table
 */
function generateTableType(
	originalName: string,
	normalizedName: string,
	fields: Record<string, unknown>,
): string {
	const interfaceName = `${normalizedName.charAt(0).toUpperCase()}${normalizedName.slice(1)}Record`;

	const fieldLines = Object.entries(fields)
		.map(([_fieldId, fieldData]) => {
			const field = fieldData as FieldMapping;
			const tsType = airtableTypeToTypeScript(field.type);
			// Make all fields optional since Airtable records may have incomplete data
			return `  ${field.name}?: ${tsType};`;
		})
		.join("\n");

	return `/**
 * Record type for table: ${originalName}
 * Normalized name: ${normalizedName}
 */
export interface ${interfaceName} {
  id: string;
${fieldLines}
}`;
}

/**
 * Generate complete TypeScript definitions file
 */
export async function generateAirboostTypes(): Promise<string> {
	await sqliteService.connect();
	const mappings = await sqliteService.getAllMappings();

	if (mappings.length === 0) {
		throw new Error("No table mappings found. Run 'bun run types' first.");
	}

	const header = `/**
 * Auto-generated TypeScript types for Airboost
 * Generated at: ${new Date().toISOString()}
 * 
 * Usage:
 *   import type { UsersRecord, TABLE_MAPPINGS } from './airboost-types';
 *   
 *   const users: UsersRecord[] = await fetch('/api/tables/users').then(r => r.json());
 */

`;

	// Generate table name union type
	const tableNames = mappings.map((m) => `"${m.normalizedName}"`).join(" | ");
	const tableNameType = `export type AirboostTableName = ${tableNames};\n\n`;

	// Generate interfaces for each table
	const interfaces = mappings
		.map((m) => generateTableType(m.originalName, m.normalizedName, m.fields))
		.join("\n\n");

	// Generate table mappings constant
	const mappingsObject = mappings
		.map(
			(m) => `  "${m.normalizedName}": {
    tableId: "${m.id}",
    originalName: "${m.originalName}",
    normalizedName: "${m.normalizedName}",
    primaryFieldId: "${m.primaryFieldId}",
  }`,
		)
		.join(",\n");

	const mappingsConst = `\n\n/**
 * Table mapping metadata
 * Maps normalized names to Airtable IDs and original names
 */
export const TABLE_MAPPINGS = {
${mappingsObject}
} as const;\n`;

	// Generate record type union
	const recordTypes = mappings
		.map((m) => {
			const interfaceName = `${m.normalizedName.charAt(0).toUpperCase()}${m.normalizedName.slice(1)}Record`;
			return interfaceName;
		})
		.join(" | ");
	const recordUnion = `\n/**
 * Union of all record types
 */
export type AirboostRecord = ${recordTypes};\n`;

	return header + tableNameType + interfaces + mappingsConst + recordUnion;
}

/**
 * Generate JSON metadata (alternative format)
 */
export async function generateAirboostTypesJson(): Promise<object> {
	await sqliteService.connect();
	const mappings = await sqliteService.getAllMappings();

	if (mappings.length === 0) {
		throw new Error("No table mappings found. Run 'bun run types' first.");
	}

	return {
		generatedAt: new Date().toISOString(),
		tableCount: mappings.length,
		tables: mappings.map((m) => ({
			tableId: m.id,
			originalName: m.originalName,
			normalizedName: m.normalizedName,
			primaryFieldId: m.primaryFieldId,
			fields: Object.entries(m.fields).map(([_fieldId, fieldData]) => {
				const field = fieldData as FieldMapping;
				return {
					id: field.id,
					name: field.name,
					type: field.type,
					tsType: airtableTypeToTypeScript(field.type),
				};
			}),
		})),
	};
}
