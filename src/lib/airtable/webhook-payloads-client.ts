/**
 * Client pour récupérer les payloads de webhook Airtable
 *
 * Après réception d'une notification (ping), on doit appeler GET /payloads
 * pour obtenir les vraies données de changement.
 *
 * Référence: https://airtable.com/developers/web/api/list-webhook-payloads
 */

import { config } from "../../config";
import { loggers } from "../logger";

const logger = loggers.webhook;

/**
 * Structure d'un payload de webhook Airtable
 */
export interface WebhookPayload {
	timestamp: string;
	baseTransactionNumber: number;
	payloadFormat: string;
	actionMetadata?: {
		source: string;
		sourceMetadata?: {
			user?: {
				id: string;
				email: string;
				permissionLevel: string;
			};
		};
	};
	changedTablesById?: {
		[tableId: string]: {
			createdRecordsById?: { [recordId: string]: unknown };
			changedRecordsById?: { [recordId: string]: unknown };
			destroyedRecordIds?: string[];
		};
	};
	createdTablesById?: { [tableId: string]: unknown };
	destroyedTableIds?: string[];
	error?: boolean;
	code?: string;
}

/**
 * Réponse de l'API list-webhook-payloads
 */
interface ListPayloadsResponse {
	cursor: number;
	mightHaveMore: boolean;
	payloads: WebhookPayload[];
}

/**
 * Récupère les payloads de webhook depuis l'API Airtable
 * Cette méthode doit être appelée après réception d'une notification
 *
 * Note: Appeler cet endpoint étend automatiquement la durée de vie du webhook
 *
 * @param webhookId - L'ID du webhook
 * @param cursor - Le curseur pour la pagination (optionnel)
 * @returns Les payloads avec les données de changement
 */
export async function fetchWebhookPayloads(
	webhookId: string,
	cursor?: number,
): Promise<ListPayloadsResponse> {
	const baseId = config.airtableBaseId;
	const token = config.airtableToken;

	let url = `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}/payloads`;
	if (cursor !== undefined) {
		url += `?cursor=${cursor}`;
	}

	logger.info("Fetching webhook payloads from Airtable", { webhookId, cursor });

	const response = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch payloads: ${response.status} - ${error}`);
	}

	const data = (await response.json()) as ListPayloadsResponse;

	logger.info("Fetched webhook payloads", {
		count: data.payloads.length,
		cursor: data.cursor,
		mightHaveMore: data.mightHaveMore,
	});

	return data;
}

/**
 * Récupère TOUS les payloads en gérant la pagination
 *
 * @param webhookId - L'ID du webhook
 * @param startCursor - Curseur de départ (optionnel)
 * @returns Tous les payloads disponibles
 */
export async function fetchAllWebhookPayloads(
	webhookId: string,
	startCursor?: number,
): Promise<WebhookPayload[]> {
	const allPayloads: WebhookPayload[] = [];
	let cursor = startCursor;
	let mightHaveMore = true;
	let iterations = 0;
	const maxIterations = 20; // Sécurité: max 1000 payloads (20 * 50)

	while (mightHaveMore && iterations < maxIterations) {
		const response = await fetchWebhookPayloads(webhookId, cursor);
		allPayloads.push(...response.payloads);
		cursor = response.cursor;
		mightHaveMore = response.mightHaveMore;
		iterations++;

		if (allPayloads.length > 500) {
			logger.warn("Large number of payloads", { count: allPayloads.length });
		}
	}

	if (iterations >= maxIterations && mightHaveMore) {
		logger.warn("Reached max iterations for payload fetching", {
			iterations,
			totalPayloads: allPayloads.length,
		});
	}

	return allPayloads;
}

/**
 * Agrège les changements de plusieurs payloads en une seule structure
 *
 * @param payloads - Liste des payloads à agréger
 * @returns Structure agrégée des changements par table
 */
export function aggregatePayloadChanges(payloads: WebhookPayload[]): {
	[tableId: string]: {
		createdRecordIds: string[];
		changedRecordIds: string[];
		destroyedRecordIds: string[];
	};
} {
	const aggregated: {
		[tableId: string]: {
			createdRecordIds: string[];
			changedRecordIds: string[];
			destroyedRecordIds: string[];
		};
	} = {};

	for (const payload of payloads) {
		// Skip les payloads d'erreur
		if (payload.error) {
			logger.warn("Skipping error payload", { code: payload.code });
			continue;
		}

		if (payload.changedTablesById) {
			for (const [tableId, changes] of Object.entries(
				payload.changedTablesById,
			)) {
				if (!aggregated[tableId]) {
					aggregated[tableId] = {
						createdRecordIds: [],
						changedRecordIds: [],
						destroyedRecordIds: [],
					};
				}

				if (changes.createdRecordsById) {
					aggregated[tableId].createdRecordIds.push(
						...Object.keys(changes.createdRecordsById),
					);
				}
				if (changes.changedRecordsById) {
					aggregated[tableId].changedRecordIds.push(
						...Object.keys(changes.changedRecordsById),
					);
				}
				if (changes.destroyedRecordIds) {
					aggregated[tableId].destroyedRecordIds.push(
						...changes.destroyedRecordIds,
					);
				}
			}
		}
	}

	// Dédupliquer les IDs
	for (const tableId of Object.keys(aggregated)) {
		const tableData = aggregated[tableId];
		if (tableData) {
			tableData.createdRecordIds = [...new Set(tableData.createdRecordIds)];
			tableData.changedRecordIds = [...new Set(tableData.changedRecordIds)];
			tableData.destroyedRecordIds = [...new Set(tableData.destroyedRecordIds)];
		}
	}

	return aggregated;
}
