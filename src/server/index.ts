/**
 * Main server entry point for Aircache
 * SQLite-only caching service configuration
 */

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

	console.log("🚀 Starting Aircache service (SQLite)");
	console.log(`📊 Port: ${fullConfig.port}`);
	console.log(`⏰ Refresh: ${fullConfig.refreshInterval}s`);

	await startSQLiteServer(fullConfig);
}

async function startSQLiteServer(config: ServerConfig): Promise<void> {
	const { startSQLiteApiServer } = await import("../api/index");

	console.log("🔄 Starting SQLite worker...");

	const worker = new Worker("src/worker/index.ts");

	// Initialize SQLite service
	console.log("📊 Initializing SQLite databases...");
	const { sqliteService } = await import("../lib/sqlite/index");
	await sqliteService.connect();
	console.log("✅ SQLite databases initialized");

	// Sync table mappings on startup
	console.log("🔄 Syncing table mappings...");
	try {
		const { syncMappingsToDatabase } = await import(
			"../lib/airtable/mapping-generator"
		);
		await syncMappingsToDatabase();
		console.log("✅ Table mappings synced");
	} catch (error) {
		console.warn("⚠️  Failed to sync table mappings:", error);
		console.warn("   💡 Run 'bun run types' to generate mappings");
		// Continue startup - mappings are needed for webhooks but not for full refresh
	}

	worker.onmessage = (e) => {
		if (e.data?.type === "refresh:done") {
			console.log("✅ Refresh completed:", e.data.stats);
		} else if (e.data?.type === "refresh:error") {
			console.error("❌ Refresh error:", e.data.error);
		} else {
			console.log("📨 SQLite Worker:", e.data);
		}
	};

	worker.onerror = (error) => {
		console.error("❌ SQLite Worker error:", error);
	};

	// Start the API server
	await startSQLiteApiServer(config.port, worker);

	// Auto-setup webhooks if configured
	try {
		const { autoSetupWebhooks } = await import("../lib/webhooks/auto-setup");
		await autoSetupWebhooks();
	} catch (error) {
		console.error("⚠️  Webhook auto-setup error:", error);
		// Continue startup even if webhook setup fails
	}

	// Initial refresh on startup
	console.log("🔄 Starting initial refresh...");
	worker.postMessage({ type: "refresh:start" });

	// Periodic refresh
	setInterval(() => {
		console.log("⏰ Periodic refresh triggered");
		worker.postMessage({ type: "refresh:start" });
	}, config.refreshInterval * 1000);

	const hours = Math.floor(config.refreshInterval / 3600);
	const minutes = Math.floor((config.refreshInterval % 3600) / 60);
	let refreshMsg = "⏰ Refresh scheduled every ";
	if (hours > 0) refreshMsg += `${hours} hour${hours > 1 ? "s" : ""}`;
	if (hours > 0 && minutes > 0) refreshMsg += " ";
	if (minutes > 0) refreshMsg += `${minutes} minute${minutes > 1 ? "s" : ""}`;
	if (hours === 0 && minutes === 0)
		refreshMsg += `${config.refreshInterval} seconds`;
	console.log(refreshMsg);
	console.log(`✅ SQLite service fully started!`);
	console.log(`📊 Databases: data/aircache-v1.sqlite, data/aircache-v2.sqlite`);
	console.log(
		`📎 Attachments: ${process.env.STORAGE_PATH || "./data/attachments"}`,
	);

	setupGracefulShutdown(worker);
}

function setupGracefulShutdown(worker: Worker): void {
	const shutdown = async (signal: string) => {
		console.log(`\n🛑 Shutdown ${signal}...`);

		try {
			worker.terminate();

			// Close SQLite service
			const { sqliteService } = await import("../lib/sqlite/index");
			await sqliteService.close();

			console.log("✅ Service stopped gracefully");
			process.exit(0);
		} catch (error) {
			console.error("❌ Error during shutdown:", error);
			process.exit(1);
		}
	};

	process.on("SIGINT", () => shutdown("graceful"));
	process.on("SIGTERM", () => shutdown("requested"));
}
