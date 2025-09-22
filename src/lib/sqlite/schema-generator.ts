/**
 * SQLite schema generator based on Airtable types
 * Uses Zod schema to create optimized SQLite tables
 */

import {
	AIRTABLE_TABLE_NAMES,
	type AirtableTableName,
} from "../airtable/schema";
import { normalizeKey } from "../utils";

/**
 * Mapping Zod types to SQLite
 */
const zodToSqliteType = (zodType: string): string => {
	if (zodType.includes("string")) return "TEXT";
	if (zodType.includes("number")) return "REAL";
	if (zodType.includes("boolean")) return "INTEGER"; // SQLite stores booleans as 0/1
	if (zodType.includes("array")) return "TEXT"; // JSON stringified
	if (zodType.includes("object")) return "TEXT"; // JSON stringified
	if (zodType.includes("datetime")) return "TEXT"; // ISO string
	if (zodType.includes("date")) return "TEXT"; // YYYY-MM-DD
	return "TEXT"; // Fallback
};

/**
 * Generate DDL for an Airtable table
 */
export function generateTableSchema(tableName: AirtableTableName): string {
	const normalizedName = normalizeKey(tableName);

	// Base table to store JSON data (simple approach)
	return `
    CREATE TABLE IF NOT EXISTS "${normalizedName}" (
      record_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "idx_${normalizedName}_version" ON "${normalizedName}"(version);
    CREATE INDEX IF NOT EXISTS "idx_${normalizedName}_updated" ON "${normalizedName}"(updated_at);
  `;
}

/**
 * Generate an optimized table with attachment detection
 */
export function generateOptimizedTableSchema(
	tableName: AirtableTableName,
	sampleData?: any,
): string {
	const normalizedName = normalizeKey(tableName);

	// Detect attachment fields in sample data
	const hasAttachments = sampleData && detectAttachmentFields(sampleData);

	let schema = `
    CREATE TABLE IF NOT EXISTS "${normalizedName}" (
      record_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  `;

	// Add dedicated columns for frequently used fields
	if (tableName === "Users") {
		schema += `,
      email TEXT,
      firstname TEXT,
      lastname TEXT,
      user_type TEXT`;
	} else if (tableName === "Clinics") {
		schema += `,
      name TEXT,
      city TEXT,
      country TEXT,
      published INTEGER`;
	} else if (tableName === "Requests") {
		schema += `,
      type TEXT,
      status TEXT,
      created TEXT`;
	}

	// Add an attachments table if necessary
	schema += `
    );

    CREATE INDEX IF NOT EXISTS "idx_${normalizedName}_version" ON "${normalizedName}"(version);
    CREATE INDEX IF NOT EXISTS "idx_${normalizedName}_updated" ON "${normalizedName}"(updated_at);
  `;

	if (hasAttachments) {
		schema += `
    CREATE TABLE IF NOT EXISTS "${normalizedName}_attachments" (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      original_url TEXT NOT NULL,
      local_path TEXT,
      filename TEXT,
      size INTEGER,
      type TEXT,
      downloaded_at DATETIME,
      version INTEGER DEFAULT 1,
      FOREIGN KEY (record_id) REFERENCES "${normalizedName}"(record_id)
    );

    CREATE INDEX IF NOT EXISTS "idx_${normalizedName}_att_record" ON "${normalizedName}_attachments"(record_id);
    CREATE INDEX IF NOT EXISTS "idx_${normalizedName}_att_version" ON "${normalizedName}_attachments"(version);
    `;
	}

	return schema;
}

/**
 * Detect if an object contains attachment fields
 */
function detectAttachmentFields(data: any): boolean {
	if (!data || typeof data !== "object") return false;

	for (const [key, value] of Object.entries(data)) {
		if (Array.isArray(value) && value.length > 0) {
			const firstItem = value[0];
			if (
				firstItem &&
				typeof firstItem === "object" &&
				firstItem.url &&
				firstItem.filename &&
				firstItem.size
			) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Extract attachments from a record
 */
export function extractAttachments(
	recordId: string,
	data: any,
): Array<{
	id: string;
	record_id: string;
	field_name: string;
	original_url: string;
	filename: string;
	size: number;
	type: string;
}> {
	const attachments: any[] = [];

	if (!data || typeof data !== "object") return attachments;

	for (const [fieldName, value] of Object.entries(data)) {
		if (Array.isArray(value)) {
			value.forEach((item, index) => {
				if (
					item &&
					typeof item === "object" &&
					item.url &&
					item.filename &&
					item.size
				) {
					attachments.push({
						id: `${recordId}_${fieldName}_${index}`,
						record_id: recordId,
						field_name: fieldName,
						original_url: item.url,
						filename: item.filename,
						size: item.size,
						type: item.type || "",
					});
				}
			});
		}
	}

	return attachments;
}

/**
 * Generate the complete SQLite schema for all Airtable tables
 */
export function generateFullSchema(): string {
	let fullSchema = `
    -- Main tables for metadata
    CREATE TABLE IF NOT EXISTS cache_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS locks (
      name TEXT PRIMARY KEY,
      lock_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL
    );

    -- Global table for attachments
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      original_url TEXT NOT NULL,
      local_path TEXT,
      filename TEXT,
      size INTEGER,
      type TEXT,
      downloaded_at DATETIME,
      version INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_table_record ON attachments(table_name, record_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_version ON attachments(version);

  `;

	// Generate tables for each Airtable table
	for (const tableName of AIRTABLE_TABLE_NAMES) {
		fullSchema += generateTableSchema(tableName);
		fullSchema += "\n";
	}

	return fullSchema;
}

/**
 * Configuration options for tables
 */
export interface TableConfig {
	enableAttachments: boolean;
	optimizedColumns: boolean;
	enableFullTextSearch: boolean;
}

/**
 * Default configuration for each table
 */
export const DEFAULT_TABLE_CONFIGS: Record<AirtableTableName, TableConfig> = {
	Users: {
		enableAttachments: true,
		optimizedColumns: true,
		enableFullTextSearch: true,
	},
	Clinics: {
		enableAttachments: true,
		optimizedColumns: true,
		enableFullTextSearch: true,
	},
	Cases: {
		enableAttachments: true,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	Requests: {
		enableAttachments: true,
		optimizedColumns: true,
		enableFullTextSearch: false,
	},
	"Patient Needs": {
		enableAttachments: true,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	"Treat Filters": {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	"Treat Filters Group": {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	Languages: {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	Content: {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: true,
	},
	Countries: {
		enableAttachments: true,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	Continents: {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	"Clinics' requests": {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	Subscriptions: {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	Options: {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	"(old) Blog Posts": {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: true,
	},
	"(unused) Graft prices": {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	"(unused) Doctors": {
		enableAttachments: true,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	"(unused) Prices": {
		enableAttachments: false,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
	"(old) Contacts": {
		enableAttachments: true,
		optimizedColumns: false,
		enableFullTextSearch: false,
	},
};
