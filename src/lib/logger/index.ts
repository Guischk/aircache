import { type ConsolaInstance, createConsola } from "consola";

/**
 * Log level configuration
 * 0: Fatal and Error
 * 1: Warnings
 * 2: Normal logs
 * 3: Informational logs (success, fail, ready, start)
 * 4: Debug logs
 * 5: Trace logs
 */
const LOG_LEVEL = Number.parseInt(process.env.CONSOLA_LEVEL || "3");
const FANCY_LOGS = process.env.CONSOLA_FANCY !== "false";

/**
 * Main logger instance
 * Configured with fancy output and log level from environment
 */
export const logger = createConsola({
	level: LOG_LEVEL,
	fancy: FANCY_LOGS,
	formatOptions: {
		date: true,
		colors: true,
		compact: false,
	},
});

/**
 * Create a scoped logger with a tag
 * @param tag - Tag name to identify the logger scope
 * @returns Scoped logger instance
 */
export function createLogger(tag: string): ConsolaInstance {
	return logger.withTag(tag);
}

// Pre-created scoped loggers for common modules
export const loggers = {
	server: createLogger("Server"),
	worker: createLogger("Worker"),
	sqlite: createLogger("SQLite"),
	airtable: createLogger("Airtable"),
	webhook: createLogger("Webhook"),
	api: createLogger("API"),
	auth: createLogger("Auth"),
	schema: createLogger("Schema"),
	mapping: createLogger("Mapping"),
} as const;

// Export main logger as default
export default logger;
