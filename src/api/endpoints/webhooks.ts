import { Elysia, t } from "elysia";
import { loggers } from "../../lib/logger";

const log = loggers.webhook;

export const webhooks = new Elysia({ prefix: "/webhooks" })
	.post(
		"/airtable/refresh",
		async ({ body, set, store }) => {
			const worker = (store as { worker?: Worker }).worker;

			log.info("Received webhook payload");

			if (!worker) {
				log.error("Worker not available to handle webhook");
				set.status = 503;
				return {
					error: "Worker service unavailable",
					backend: "sqlite",
				};
			}

			// Forward payload to worker for processing
			worker.postMessage({
				type: "WEBHOOK_RECEIVED",
				payload: body,
			});

			return {
				received: true,
				status: "processing",
				backend: "sqlite",
			};
		},
		{
			body: t.Any(), // Allow any payload structure from Airtable
			detail: {
				summary: "Airtable Webhook Receiver",
				description: "Receives and processes webhook notifications from Airtable",
			},
		},
	);
