/**
 * SQLite backend for the worker
 */

import path from "path";
import { config } from "../../config";
import { base } from "../../lib/airtable/index";
import { AIRTABLE_TABLE_NAMES } from "../../lib/airtable/schema";
import {
	getPendingAttachments,
	markAttachmentDownloaded,
} from "../../lib/sqlite/helpers";
import { sqliteService } from "../../lib/sqlite/index";
import { normalizeKey } from "../../lib/utils/index";

export interface RefreshStats {
	tables: number;
	records: number;
	attachments: number;
	duration: number;
	errors: number;
}

export class SQLiteBackend {
	private chunkArray<T>(array: T[], chunkSize: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += chunkSize) {
			chunks.push(array.slice(i, i + chunkSize));
		}
		return chunks;
	}

	/**
	 * Refresh incrémental basé sur les changements du webhook
	 */
	async incrementalRefresh(changedTablesById: {
		[tableId: string]: {
			createdRecordsById?: { [recordId: string]: null };
			changedRecordsById?: { [recordId: string]: null };
			destroyedRecordIds?: string[];
		};
	}): Promise<{
		tables: number;
		recordsCreated: number;
		recordsUpdated: number;
		recordsDeleted: number;
		duration: number;
	}> {
		const startTime = performance.now();
		let recordsCreated = 0;
		let recordsUpdated = 0;
		let recordsDeleted = 0;

		console.log("🔄 [SQLite] Starting incremental refresh...");

		try {
			await sqliteService.connect();

			// Itérer sur chaque table modifiée
			for (const [tableId, changes] of Object.entries(changedTablesById)) {
				try {
					// 1. Résoudre le nom de la table depuis son ID
					const tableName = await this.resolveTableNameFromId(tableId);
					if (!tableName) {
						console.warn(`⚠️ Unknown table ID: ${tableId}, skipping`);
						continue;
					}

					console.log(`🔄 [SQLite] Processing table: ${tableName}`);
					const normalizedTableName = normalizeKey(tableName);

					// 2. Collecter les IDs à fetch (créés + modifiés)
					const recordIdsToFetch = [
						...Object.keys(changes.createdRecordsById || {}),
						...Object.keys(changes.changedRecordsById || {}),
					];

					// 3. Fetch records depuis Airtable (batch)
					if (recordIdsToFetch.length > 0) {
						console.log(`   📥 Fetching ${recordIdsToFetch.length} records...`);

						// Airtable API: select() avec filterByFormula
						const formula = `OR(${recordIdsToFetch.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
						const records = await base(tableName)
							.select({ filterByFormula: formula })
							.all();

						// Sauvegarder dans activeDb (pas inactive!)
						await sqliteService.setRecordsBatch(
							normalizedTableName,
							records,
							false, // useInactive = false → met à jour activeDb
						);

						recordsCreated += Object.keys(
							changes.createdRecordsById || {},
						).length;
						recordsUpdated += Object.keys(
							changes.changedRecordsById || {},
						).length;
						console.log(`   ✅ ${records.length} records updated in cache`);
					}

					// 4. Supprimer les records détruits
					const destroyedIds = changes.destroyedRecordIds || [];
					if (destroyedIds.length > 0) {
						console.log(`   🗑️  Deleting ${destroyedIds.length} records...`);

						for (const recordId of destroyedIds) {
							await sqliteService.deleteRecord(
								normalizedTableName,
								recordId,
								false,
							);
							recordsDeleted++;
						}

						console.log(`   ✅ ${destroyedIds.length} records deleted`);
					}
				} catch (error) {
					console.error(`❌ Error processing table ${tableId}:`, error);
				}
			}

			const duration = performance.now() - startTime;
			console.log(
				`✅ [SQLite] Incremental refresh completed in ${(duration / 1000).toFixed(2)}s`,
			);
			console.log(
				`   📊 Created: ${recordsCreated}, Updated: ${recordsUpdated}, Deleted: ${recordsDeleted}`,
			);

			return {
				tables: Object.keys(changedTablesById).length,
				recordsCreated,
				recordsUpdated,
				recordsDeleted,
				duration,
			};
		} catch (error) {
			console.error("❌ [SQLite] Error during incremental refresh:", error);
			throw error;
		}
	}

	/**
	 * Résout le nom de table depuis son ID Airtable (tblXXX)
	 * TODO: Sera complété avec la Phase 2 (Mapping table)
	 */
	private async resolveTableNameFromId(
		tableId: string,
	): Promise<string | null> {
		try {
			// Pour l'instant, retourne null si pas trouvé
			// L'implémentation complète viendra avec la Phase 2 (Mapping)
			console.warn(`⚠️ Table ID resolution not yet implemented: ${tableId}`);
			console.warn("   💡 Will be implemented in Phase 2 (Mapping table)");
			console.warn(
				"   📌 Using fallback: full refresh will be triggered instead",
			);
			return null;
		} catch (error) {
			console.error(`❌ Error resolving table ID ${tableId}:`, error);
			return null;
		}
	}

	/**
	 * Process attachments in parallel with limited concurrency
	 */
	private async processAttachmentsWithPool<T>(
		items: T[],
		processFn: (item: T) => Promise<void>,
		maxConcurrency = 5,
	): Promise<{ processed: number; errors: number }> {
		let processed = 0;
		let errors = 0;

		// Process items in chunks to limit concurrency
		for (let i = 0; i < items.length; i += maxConcurrency) {
			const chunk = items.slice(i, i + maxConcurrency);

			// Process chunk in parallel
			const results = await Promise.allSettled(
				chunk.map(async (item) => await processFn(item)),
			);

			// Count results
			for (const result of results) {
				if (result.status === "fulfilled") {
					processed++;
				} else {
					errors++;
					console.error(`   ❌ Attachment processing failed:`, result.reason);
				}
			}
		}

		return { processed, errors };
	}

	async refreshData(): Promise<RefreshStats> {
		const startTime = performance.now();
		let totalRecords = 0;
		let totalErrors = 0;

		console.log("🔄 [SQLite] Starting Airtable data refresh...");

		try {
			// Ensure SQLite is connected
			await sqliteService.connect();

			// Clean up previous version
			console.log("🧹 [SQLite] Cleaning previous version...");
			await sqliteService.clearInactiveDatabase();

			// Refresh each table
			const tableNames = Object.values(AIRTABLE_TABLE_NAMES);
			console.log(`📋 [SQLite] Processing ${tableNames.length} tables...`);

			for (const tableName of tableNames) {
				try {
					console.log(`🔄 [SQLite] Syncing ${tableName}...`);

					// Retrieve all records from the table
					const records = await base(tableName).select().all();
					console.log(`   📊 ${records.length} records found`);

					// Save records to SQLite in batches for better performance
					const batchSize = 50;
					const recordChunks = this.chunkArray(records, batchSize);

					for (const chunk of recordChunks) {
						try {
							const normalizedTableName = normalizeKey(tableName);
							await sqliteService.setRecordsBatch(
								normalizedTableName,
								chunk,
								true,
							);
							totalRecords += chunk.length;
							console.log(`   📦 Processed batch of ${chunk.length} records`);
						} catch (error) {
							console.error(`   ❌ Error with batch:`, error);
							// Fallback to individual processing for this chunk
							const normalizedTableName = normalizeKey(tableName);
							for (const record of chunk) {
								try {
									await sqliteService.setRecord(
										normalizedTableName,
										record.id,
										record.fields,
										true,
									);
									totalRecords++;
								} catch (recordError) {
									console.error(
										`   ❌ Error with record ${record.id}:`,
										recordError,
									);
									totalErrors++;
								}
							}
						}
					}

					console.log(
						`   ✅ ${tableName}: ${records.length} records synchronized`,
					);
				} catch (error) {
					console.error(`❌ [SQLite] Error with table ${tableName}:`, error);
					totalErrors++;
				}
			}

			// Finalize synchronization
			await sqliteService.flipActiveVersion();

			// Download pending attachments
			console.log("📎 [SQLite] Downloading attachments...");
			const attachmentStats = await this.downloadPendingAttachments();

			const duration = performance.now() - startTime;

			console.log(
				`✅ [SQLite] Refresh completed in ${(duration / 1000).toFixed(2)}s`,
			);
			console.log(
				`📊 [SQLite] ${totalRecords} records synchronized, ${attachmentStats.downloaded} attachments downloaded, ${totalErrors} errors`,
			);

			return {
				tables: tableNames.length,
				records: totalRecords,
				attachments: attachmentStats.downloaded,
				duration,
				errors: totalErrors,
			};
		} catch (error) {
			console.error("❌ [SQLite] Error during refresh:", error);
			throw new Error(
				`SQLite refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Download all pending attachments from the active database
	 */
	async downloadPendingAttachments(): Promise<{
		downloaded: number;
		errors: number;
	}> {
		let downloaded = 0;
		let errors = 0;

		try {
			// Check if attachment download is enabled
			if (!config.enableAttachmentDownload) {
				console.log(
					"📎 Attachment download is disabled (ENABLE_ATTACHMENT_DOWNLOAD=false)",
				);
				return { downloaded: 0, errors: 0 };
			}

			// Get all pending attachments from the active database
			const pendingAttachments = await getPendingAttachments(false);

			if (pendingAttachments.length === 0) {
				console.log("📎 No attachments to download");
				return { downloaded: 0, errors: 0 };
			}

			console.log(
				`📎 Found ${pendingAttachments.length} attachments to download`,
			);

			// Ensure storage directory exists
			const storagePath = config.storagePath;
			await Bun.$`mkdir -p ${storagePath}`;

			// Download attachments with limited concurrency
			const maxConcurrentDownloads = 5;
			const { processed, errors: poolErrors } =
				await this.processAttachmentsWithPool(
					pendingAttachments,
					async (attachment) => {
						// Generate hierarchical path: table/record/field/filename
						const relativePath = this.generateAttachmentPath(
							attachment.table_name,
							attachment.record_id,
							attachment.field_name,
							attachment.filename || `attachment_${attachment.id}`,
							attachment.original_url,
						);
						const localPath = path.join(storagePath, relativePath);

						// Check if file already exists and has the correct size
						const existingFile = Bun.file(localPath);
						const fileExists = await existingFile.exists();

						if (fileExists) {
							const existingSize = existingFile.size;
							if (existingSize === attachment.size) {
								// File already exists with correct size, just mark as downloaded
								console.log(
									`📎 Skipping download (file exists): ${attachment.filename}`,
								);
								await markAttachmentDownloaded(
									attachment.id,
									localPath,
									attachment.size,
								);
								return;
							} else {
								// File exists but wrong size, delete and re-download
								console.log(
									`📎 File exists but wrong size (${existingSize} vs ${attachment.size}), re-downloading: ${attachment.filename}`,
								);
								await Bun.$`rm -f ${localPath}`;
							}
						}

						// Ensure directory structure exists
						const dir = path.dirname(localPath);
						await Bun.$`mkdir -p ${dir}`;

						// Download file
						console.log(
							`📎 Downloading: ${attachment.filename} to ${relativePath} (${attachment.size} bytes)`,
						);
						const response = await fetch(attachment.original_url);

						if (!response.ok) {
							throw new Error(
								`HTTP ${response.status}: ${response.statusText}`,
							);
						}

						// Save to local storage
						const arrayBuffer = await response.arrayBuffer();
						await Bun.write(localPath, arrayBuffer);

						// Mark as downloaded in database
						await markAttachmentDownloaded(
							attachment.id,
							localPath,
							attachment.size,
						);

						console.log(`   ✅ ${relativePath} downloaded successfully`);
					},
					maxConcurrentDownloads,
				);

			downloaded = processed;
			errors = poolErrors;

			console.log(
				`📎 Attachment download completed: ${downloaded} successful, ${errors} errors`,
			);
		} catch (error) {
			console.error("❌ [SQLite] Error downloading attachments:", error);
			errors++;
		}

		return { downloaded, errors };
	}

	/**
	 * Generate a hierarchical path for local storage: table/record/field/filename
	 */
	private generateAttachmentPath(
		tableName: string,
		recordId: string,
		fieldName: string,
		filename: string,
		url: string,
	): string {
		// Remove unsafe characters and limit length for filename
		const safeFilename = filename
			.replace(/[^a-zA-Z0-9._-]/g, "_")
			.substring(0, 100);

		// Create a hash from the URL to ensure uniqueness while being deterministic
		const urlHash = this.hashString(url).substring(0, 8);
		const ext = path.extname(safeFilename);
		const name = path.basename(safeFilename, ext);

		const finalFilename = `${name}_${urlHash}${ext}`;

		// Create hierarchical path: table/record/field/filename
		return path.join(tableName, recordId, fieldName, finalFilename);
	}

	/**
	 * Generate a simple hash from a string
	 */
	private hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(16);
	}

	async getStats(): Promise<any> {
		try {
			return await sqliteService.getStats();
		} catch (error) {
			console.error("❌ [SQLite] Error retrieving stats:", error);
			return null;
		}
	}

	async close(): Promise<void> {
		try {
			await sqliteService.close();
			console.log("✅ [SQLite] Connection closed");
		} catch (error) {
			console.error("❌ [SQLite] Error during close:", error);
		}
	}
}
