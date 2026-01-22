/**
 * 🔗 WEBHOOK HANDLERS
 * Gestion des webhooks Airtable avec refresh incrémental
 */

/**
 * Structure du payload webhook Airtable
 * Docs: https://airtable.com/developers/web/api/webhooks-overview
 *
 * Note: Airtable envoie les changements dans un tableau `payloads`
 * Chaque payload contient les modifications pour une transaction
 */
interface AirtableWebhookNotification {
	timestamp: string;
	baseTransactionNumber?: number;
	webhookId?: string;

	// Les changements sont dans un tableau de payloads
	payloads?: Array<{
		baseTransactionNumber: number;
		timestamp: string;
		changedTablesById?: {
			[tableId: string]: {
				createdRecordsById?: { [recordId: string]: null };
				changedRecordsById?: { [recordId: string]: null };
				destroyedRecordIds?: string[];
			};
		};
	}>;

	// Support aussi le format direct pour les tests/webhooks custom
	changedTablesById?: {
		[tableId: string]: {
			createdRecordsById?: { [recordId: string]: null };
			changedRecordsById?: { [recordId: string]: null };
			destroyedRecordIds?: string[];
		};
	};
}

/**
 * 🔗 HANDLER: Webhook Airtable
 * Route: POST /webhooks/airtable/refresh
 *
 * Stratégie:
 * 1. Si changedTablesById présent → Refresh incrémental
 * 2. Sinon → Fallback refresh complet
 */
export async function handleAirtableWebhook(
	payload: AirtableWebhookNotification,
): Promise<Response> {
	try {
		console.log("🔗 [Webhook] Received Airtable webhook");
		console.log(`   Timestamp: ${payload.timestamp}`);
		console.log(`   Transaction: ${payload.baseTransactionNumber}`);

		// 1. Vérifier idempotency (éviter double processing)
		if (payload.webhookId) {
			const { sqliteService } = await import("../../lib/sqlite");
			const alreadyProcessed = await sqliteService.isWebhookProcessed(
				payload.webhookId,
			);

			if (alreadyProcessed) {
				console.log(`⏭️ [Webhook] Already processed: ${payload.webhookId}`);
				return new Response(
					JSON.stringify({
						status: "skipped",
						reason: "Already processed",
						webhookId: payload.webhookId,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		// 2. Extraire changedTablesById (support format Airtable + format test)
		// Airtable envoie dans payloads[0].changedTablesById
		// Nos tests utilisent le format direct pour simplicité
		const changedTablesById =
			payload.payloads?.[0]?.changedTablesById || payload.changedTablesById;

		// 3. Décider du type de refresh
		const hasChangedTables =
			changedTablesById && Object.keys(changedTablesById).length > 0;

		const refreshType: "incremental" | "full" = hasChangedTables
			? "incremental"
			: "full";

		console.log(`🔄 [Webhook] Triggering ${refreshType} refresh (async)`);

		// 4. Marquer le webhook comme traité AVANT le refresh (éviter race condition)
		if (payload.webhookId) {
			const { sqliteService } = await import("../../lib/sqlite");
			await sqliteService.markWebhookProcessed(
				payload.webhookId,
				refreshType,
				{ pending: true }, // Stats seront mis à jour après refresh
			);
		}

		// 5. Trigger async refresh (ne pas attendre)
		// Utiliser Promise.resolve().then() pour éviter le blocage de la réponse
		Promise.resolve().then(async () => {
			try {
				const { SQLiteBackend } = await import(
					"../../worker/backends/sqlite-backend"
				);
				const backend = new SQLiteBackend();

				if (hasChangedTables && changedTablesById) {
					console.log("🔄 [Webhook] Running incremental refresh...");
					await backend.incrementalRefresh(changedTablesById);
				} else {
					console.log("🔄 [Webhook] Running full refresh...");
					await backend.refreshData();
				}

				console.log(`✅ [Webhook] ${refreshType} refresh completed`);
			} catch (error) {
				console.error("❌ [Webhook] Refresh error:", error);
			}
		});

		// 6. Retourner immédiatement succès (refresh en cours en background)
		return new Response(
			JSON.stringify({
				status: "success",
				refreshType,
				message: `${refreshType} refresh triggered`,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("❌ [Webhook] Error:", error);
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
