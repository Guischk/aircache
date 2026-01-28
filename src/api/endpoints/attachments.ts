import { Elysia, t } from "elysia";
import { sqliteService } from "../../lib/sqlite";
import { normalizeKey } from "../../lib/utils";

export const attachments = new Elysia({ prefix: "/api/attachments" })
	// 📄 Get all attachments for a table
	.get(
		"/:table",
		async ({ params: { table } }) => {
			const tableName = normalizeKey(decodeURIComponent(table));
			const attachments = await sqliteService.getTableAttachments(tableName);
			return {
				backend: "sqlite",
				attachments,
			};
		},
		{
			params: t.Object({
				table: t.String(),
			}),
		},
	)

	// 📄 Get attachments for a specific record
	.get(
		"/:table/:record",
		async ({ params: { table, record } }) => {
			const tableName = normalizeKey(decodeURIComponent(table));
			const recordId = decodeURIComponent(record);
			const attachments = await sqliteService.getRecordAttachments(tableName, recordId);
			return {
				backend: "sqlite",
				attachments,
			};
		},
		{
			params: t.Object({
				table: t.String(),
				record: t.String(),
			}),
		},
	)

	// 📄 Get attachments for a specific field
	.get(
		"/:table/:record/:field",
		async ({ params: { table, record, field } }) => {
			const tableName = normalizeKey(decodeURIComponent(table));
			const recordId = decodeURIComponent(record);
			const fieldName = decodeURIComponent(field);
			const attachments = await sqliteService.getFieldAttachments(tableName, recordId, fieldName);
			return {
				backend: "sqlite",
				attachments,
			};
		},
		{
			params: t.Object({
				table: t.String(),
				record: t.String(),
				field: t.String(),
			}),
		},
	)

	// 📥 Download attachment file
	.get(
		"/:table/:record/:field/:filename",
		async ({ params: { table, record, field, filename }, set }) => {
			const tableName = normalizeKey(decodeURIComponent(table));
			const recordId = decodeURIComponent(record);
			const fieldName = decodeURIComponent(field);
			const fileName = decodeURIComponent(filename);

			const attachments = await sqliteService.getFieldAttachments(tableName, recordId, fieldName);

			const attachment = attachments.find((a) => a.filename === fileName);

			if (!attachment) {
				set.status = 404;
				return {
					error: "Attachment not found",
					backend: "sqlite",
				};
			}

			// If we have a local path, serve the file
			if (attachment.local_path && (await Bun.file(attachment.local_path).exists())) {
				const file = Bun.file(attachment.local_path);
				set.headers["Content-Type"] = attachment.type || "application/octet-stream";
				set.headers["Content-Length"] = String(attachment.size);
				return file;
			}

			// Fallback to original URL redirect if local file missing
			return Response.redirect(attachment.original_url);
		},
		{
			params: t.Object({
				table: t.String(),
				record: t.String(),
				field: t.String(),
				filename: t.String(),
			}),
		},
	)

	// 📄 Legacy: Get attachment by ID (Moved to /by-id/:id to avoid conflict with /:table)
	.get(
		"/by-id/:id",
		async ({ params: { id }, set }) => {
			const attachment = await sqliteService.getAttachment(id);

			if (!attachment) {
				set.status = 404;
				return {
					error: "Attachment not found",
					backend: "sqlite",
				};
			}

			return {
				backend: "sqlite",
				...attachment,
			};
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		},
	);
