/**
 * Main server entry point for Aircache
 * SQLite-only caching service configuration
 */

import { loggers } from "../lib/logger";

const logger = loggers.server;

export interface ServerConfig {
	port: number;
	refreshInterval: number;
}

export function getServerConfig(): ServerConfig {
	return {
		port: Number.parseInt(process.env.PORT || "3000"),
		refreshInterval: Number.parseInt(process.env.REFRESH_INTERVAL || "86400"), // Default to 24 hours for SQLite
	};
}

export async function startServer(
	config?: Partial<ServerConfig>,
): Promise<void> {
	const fullConfig = { ...getServerConfig(), ...config };

	logger.start("Starting Aircache service (SQLite)");
	logger.info("Configuration", {
		port: fullConfig.port,
		refreshInterval: `${fullConfig.refreshInterval}s`,
	});

	await startSQLiteServer(fullConfig);
}

async function startSQLiteServer(config: ServerConfig): Promise<void> {
	const { startSQLiteApiServer } = await import("../api/index");

	logger.start("Starting SQLite worker");

	const worker = new Worker("src/worker/index.ts");

	// Initialize SQLite service
	logger.info("Initializing SQLite databases");
	const { sqliteService } = await import("../lib/sqlite/index");
	await sqliteService.connect();
	logger.success("SQLite databases initialized");

	// Sync table mappings on startup
	logger.start("Syncing table mappings");
	try {
		const { syncMappingsToDatabase } = await import(
			"../lib/airtable/mapping-generator"
		);
		await syncMappingsToDatabase();
		logger.success("Table mappings synced");
	} catch (error) {
		logger.warn("Failed to sync table mappings", error);
		logger.warn("Run 'bun run types' to generate mappings");
		// Continue startup - mappings are needed for webhooks but not for full refresh
	}

	worker.onmessage = (e) => {
		if (e.data?.type === "refresh:done") {
			logger.success("Refresh completed", e.data.stats);
		} else if (e.data?.type === "refresh:error") {
			logger.error("Refresh error", e.data.error);
		} else {
			logger.info("SQLite Worker message", e.data);
		}
	};

	worker.onerror = (error) => {
		logger.error("SQLite Worker error", error);
	};

	// Start the API server
	await startSQLiteApiServer(config.port, worker);

	// Auto-setup webhooks if configured
	try {
		const { autoSetupWebhooks } = await import("../lib/webhooks/auto-setup");
		await autoSetupWebhooks();
	} catch (error) {
		logger.warn("Webhook auto-setup error", error);
		// Continue startup even if webhook setup fails
	}

	// Initial refresh on startup
	logger.start("Starting initial refresh");
	worker.postMessage({ type: "refresh:start" });

	// Periodic refresh
	setInterval(() => {
		logger.info("Periodic refresh triggered");
		worker.postMessage({ type: "refresh:start" });
	}, config.refreshInterval * 1000);

	const hours = Math.floor(config.refreshInterval / 3600);
	const minutes = Math.floor((config.refreshInterval % 3600) / 60);
	let refreshMsg = "Refresh scheduled every ";
	if (hours > 0) refreshMsg += `${hours} hour${hours > 1 ? "s" : ""}`;
	if (hours > 0 && minutes > 0) refreshMsg += " ";
	if (minutes > 0) refreshMsg += `${minutes} minute${minutes > 1 ? "s" : ""}`;
	if (hours === 0 && minutes === 0)
		refreshMsg += `${config.refreshInterval} seconds`;
	logger.ready(refreshMsg);
	logger.success("SQLite service fully started");
	logger.info("Storage", {
		databases: "data/aircache-v1.sqlite, data/aircache-v2.sqlite",
		attachments: process.env.STORAGE_PATH || "./data/attachments",
	});

	setupGracefulShutdown(worker);
}

function setupGracefulShutdown(worker: Worker): void {
	const shutdown = async (signal: string) => {
		logger.info(`Shutdown ${signal}`);

		try {
			worker.terminate();

			// Close SQLite service
			const { sqliteService } = await import("../lib/sqlite/index");
			await sqliteService.close();

			logger.success("Service stopped gracefully");
			process.exit(0);
		} catch (error) {
			logger.error("Error during shutdown", error);
			process.exit(1);
		}
	};

	process.on("SIGINT", () => shutdown("graceful"));
	process.on("SIGTERM", () => shutdown("requested"));
}
