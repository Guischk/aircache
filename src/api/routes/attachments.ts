/**
 * 📎 Attachment Routes
 */

import type { Hono } from "hono";
import { normalizeKey } from "../../lib/utils/index";
import type { AppContext } from "../app";
import {
	handleAttachment,
	handleFieldAttachments,
	handleRecordAttachments,
	handleSpecificAttachment,
	handleTableAttachments,
} from "../handlers/attachments";
import { convertFileResponseToHono, convertResponseToHono } from "../utils";

export function setupAttachmentRoutes(app: Hono<AppContext>) {
	// 📁 Specific file route: /api/attachments/:table/:record/:field/:filename
	app.get("/api/attachments/:table/:record/:field/:filename", async (c) => {
		const table = normalizeKey(decodeURIComponent(c.req.param("table")));
		const record = decodeURIComponent(c.req.param("record"));
		const field = decodeURIComponent(c.req.param("field"));
		const filename = decodeURIComponent(c.req.param("filename"));

		const response = await handleSpecificAttachment(c.req.raw, table, record, field, filename);

		// For attachments, we need to preserve the original response type
		if (response.headers.get("content-type")?.startsWith("application/json")) {
			return convertResponseToHono(response, c);
		} else {
			// Return the raw response for file downloads
			return convertFileResponseToHono(response);
		}
	});

	// 📎 Field route: /api/attachments/:table/:record/:field
	app.get("/api/attachments/:table/:record/:field", async (c) => {
		const table = normalizeKey(decodeURIComponent(c.req.param("table")));
		const record = decodeURIComponent(c.req.param("record"));
		const field = decodeURIComponent(c.req.param("field"));

		const response = await handleFieldAttachments(c.req.raw, table, record, field);
		return convertResponseToHono(response, c);
	});

	// 📄 Record route: /api/attachments/:table/:record
	app.get("/api/attachments/:table/:record", async (c) => {
		const table = normalizeKey(decodeURIComponent(c.req.param("table")));
		const record = decodeURIComponent(c.req.param("record"));

		const response = await handleRecordAttachments(c.req.raw, table, record);
		return convertResponseToHono(response, c);
	});

	// 📋 Table route: /api/attachments/:table
	app.get("/api/attachments/:table", async (c) => {
		const table = normalizeKey(decodeURIComponent(c.req.param("table")));

		const response = await handleTableAttachments(c.req.raw, table);
		return convertResponseToHono(response, c);
	});

	// 🔗 Legacy route: /api/attachments/:attachmentId
	app.get("/api/attachments/:attachmentId", async (c) => {
		const attachmentId = decodeURIComponent(c.req.param("attachmentId"));

		const response = await handleAttachment(c.req.raw, attachmentId);

		// For attachments, we need to preserve the original response type
		if (response.headers.get("content-type")?.startsWith("application/json")) {
			return convertResponseToHono(response, c);
		} else {
			// Return the raw response for file downloads
			return convertFileResponseToHono(response);
		}
	});
}
