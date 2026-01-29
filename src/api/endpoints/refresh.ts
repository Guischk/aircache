import { Elysia, t } from "elysia";
import { loggers } from "../../lib/logger";

const log = loggers.api;

export const refresh = new Elysia({ prefix: "/api/refresh" }).post(
	"/",
	async ({ store, set }) => {
		const worker = (store as { worker?: Worker }).worker;

		if (!worker) {
			log.error("Worker not available for manual refresh");
			set.status = 503;
			return {
				error: "Worker service unavailable",
				backend: "sqlite",
			};
		}

		log.info("Manual refresh triggered via API");
		worker.postMessage({ type: "refresh:start" });

		return {
			message: "Refresh triggered",
			backend: "sqlite",
		};
	},
	{
		detail: {
			summary: "Trigger Cache Refresh",
			description: "Manually triggers a refresh of the Airtable cache",
		},
	},
);
