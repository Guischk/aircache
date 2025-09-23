/**
 * 📋 Table Routes
 */

import type { Hono } from "hono";
import { normalizeKey } from "../../lib/utils/index";
import type { AppContext } from "../app";
import {
	handleSingleRecord,
	handleTableRecords,
	handleTables,
} from "../handlers/tables";
import { convertResponseToHono } from "../utils";

export function setupTableRoutes(app: Hono<AppContext>) {
	// 📋 List all tables
	app.get("/api/tables", async (c) => {
		const response = await handleTables();
		return convertResponseToHono(response, c);
	});

	// 📄 Get specific record by ID
	app.get("/api/tables/:tableName/:recordId", async (c) => {
		const tableName = normalizeKey(
			decodeURIComponent(c.req.param("tableName")),
		);
		const recordId = decodeURIComponent(c.req.param("recordId"));

		const response = await handleSingleRecord(tableName, recordId);
		return convertResponseToHono(response, c);
	});

	// 📋 Get table records with pagination
	app.get("/api/tables/:tableName", async (c) => {
		const rawTableName = decodeURIComponent(c.req.param("tableName"));
		const tableName = normalizeKey(rawTableName);
		console.log(`🔍 Table lookup: "${rawTableName}" -> "${tableName}"`);
		const url = new URL(c.req.url);

		const response = await handleTableRecords(tableName, url);
		return convertResponseToHono(response, c);
	});
}
