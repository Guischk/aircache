/**
 * 🔗 WEBHOOK HANDLERS
 * Gestion des webhooks Airtable avec refresh incrémental
 *
 * Flux correct selon la documentation Airtable :
 * 1. Recevoir notification (ping) avec {base, webhook, timestamp}
 * 2. Appeler GET /payloads pour récupérer les vraies données
 * 3. Traiter les payloads et effectuer le refresh
 *
 * Référence: https://airtable.com/developers/web/api/webhooks-overview
 */

import {
	aggregatePayloadChanges,
	fetchAllWebhookPayloads,
} from "../../lib/airtable/webhook-payloads-client";
import { loggers } from "../../lib/logger";

const logger = loggers.webhook;

/**
 * Structure de la notification Airtable (ping)
 * NOTE: Ne contient PAS les données de changement, juste un signal
 */
export interface AirtableWebhookNotification {
	base?: { id: string };
	webhook?: { id: string };
	timestamp: string;
}

/**
 * 🔗 HANDLER: Webhook Airtable
 * Route: POST /webhooks/airtable/refresh
 *
 * Reçoit une notification (ping) d'Airtable et déclenche le refresh approprié
 */
export async function handleAirtableWebhook(
	payload: AirtableWebhookNotification,
): Promise<Response> {
	try {
		const webhookId = payload.webhook?.id;

		logger.info("Received Airtable webhook notification", {
			timestamp: payload.timestamp,
			webhookId: webhookId || "unknown",
			baseId: payload.base?.id || "unknown",
		});

		// 1. Vérifier qu'on a un webhook ID pour récupérer les payloads
		if (!webhookId) {
			logger.warn("No webhook ID in notification, triggering full refresh");
			return triggerFullRefresh("No webhook ID provided");
		}

		// 2. Vérifier idempotency avec une clé unique
		const { sqliteService } = await import("../../lib/sqlite");
		const idempotencyKey = `${webhookId}-${payload.timestamp}`;
		const alreadyProcessed = await sqliteService.isWebhookProcessed(idempotencyKey);

		if (alreadyProcessed) {
			logger.info("Webhook already processed (skipping)", { idempotencyKey });
			return new Response(
				JSON.stringify({
					status: "skipped",
					reason: "Already processed",
					webhookId,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// 3. Récupérer les payloads depuis l'API Airtable
		logger.info("Fetching payloads from Airtable API...");
		let payloads: Awaited<ReturnType<typeof fetchAllWebhookPayloads>>;
		try {
			payloads = await fetchAllWebhookPayloads(webhookId);
		} catch (error) {
			logger.error("Failed to fetch payloads from Airtable:", error);
			// Mark as processed to prevent duplicate full refreshes for the same notification
			await sqliteService.markWebhookProcessed(idempotencyKey, "full", {
				error: "Failed to fetch payloads",
				message: error instanceof Error ? error.message : "Unknown error",
			});
			// En cas d'erreur, on fait un full refresh par sécurité
			return triggerFullRefresh("Failed to fetch payloads");
		}

		if (payloads.length === 0) {
			logger.info("No payloads to process");
			// Mark as processed even with no payloads to ensure idempotency
			await sqliteService.markWebhookProcessed(idempotencyKey, "incremental", {
				payloadsCount: 0,
				tablesChanged: 0,
				message: "No payloads to process",
			});
			return new Response(
				JSON.stringify({
					status: "success",
					message: "No payloads to process",
					webhookId,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// 4. Agréger les changements de tous les payloads
		const aggregatedChanges = aggregatePayloadChanges(payloads);
		const tablesChanged = Object.keys(aggregatedChanges).length;

		// 5. Décider du type de refresh
		const refreshType: "incremental" | "full" = tablesChanged > 0 ? "incremental" : "full";

		logger.info("Processing webhook", {
			refreshType,
			tablesChanged,
			payloadsProcessed: payloads.length,
		});

		// 6. Marquer comme traité AVANT le refresh
		await sqliteService.markWebhookProcessed(idempotencyKey, refreshType, {
			payloadsCount: payloads.length,
			tablesChanged,
		});

		// 7. Trigger async refresh (ne pas attendre)
		Promise.resolve().then(async () => {
			try {
				const { SQLiteBackend } = await import("../../worker/backends/sqlite-backend");
				const backend = new SQLiteBackend();

				if (refreshType === "incremental" && tablesChanged > 0) {
					logger.start("Running incremental refresh...");

					// Convertir le format agrégé vers le format attendu par incrementalRefresh
					const changesForRefresh: {
						[tableId: string]: {
							createdRecordsById?: { [recordId: string]: null };
							changedRecordsById?: { [recordId: string]: null };
							destroyedRecordIds?: string[];
						};
					} = {};

					for (const [tableId, changes] of Object.entries(aggregatedChanges)) {
						changesForRefresh[tableId] = {
							destroyedRecordIds: changes.destroyedRecordIds,
						};

						// Convertir les arrays d'IDs en objets
						if (changes.createdRecordIds.length > 0) {
							const created: { [recordId: string]: null } = {};
							for (const id of changes.createdRecordIds) {
								created[id] = null;
							}
							changesForRefresh[tableId].createdRecordsById = created;
						}
						if (changes.changedRecordIds.length > 0) {
							const changed: { [recordId: string]: null } = {};
							for (const id of changes.changedRecordIds) {
								changed[id] = null;
							}
							changesForRefresh[tableId].changedRecordsById = changed;
						}
					}

					await backend.incrementalRefresh(changesForRefresh);
				} else {
					logger.start("Running full refresh...");
					await backend.refreshData();
				}

				logger.success("Refresh completed", { refreshType });
			} catch (error) {
				logger.error("Refresh error:", error);
			}
		});

		// 8. Retourner succès immédiatement
		return new Response(
			JSON.stringify({
				status: "success",
				refreshType,
				message: `${refreshType} refresh triggered`,
				payloadsProcessed: payloads.length,
				tablesChanged,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		logger.error("Webhook handler error:", error);
		return new Response(
			JSON.stringify({
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

/**
 * Helper pour déclencher un full refresh
 */
async function triggerFullRefresh(reason: string): Promise<Response> {
	const logger = loggers.webhook;

	Promise.resolve().then(async () => {
		try {
			const { SQLiteBackend } = await import("../../worker/backends/sqlite-backend");
			const backend = new SQLiteBackend();
			await backend.refreshData();
			logger.success("Full refresh completed");
		} catch (error) {
			logger.error("Full refresh error:", error);
		}
	});

	return new Response(
		JSON.stringify({
			status: "success",
			refreshType: "full",
			message: `Full refresh triggered: ${reason}`,
			timestamp: new Date().toISOString(),
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
}
