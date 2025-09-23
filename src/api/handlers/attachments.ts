/**
 * Attachments handlers for SQLite with hierarchical structure
 */

import path from "node:path";
import {
	getAttachment,
	getFieldAttachments,
	getRecordAttachments,
	getTableAttachments,
} from "../../lib/sqlite/helpers";

/**
 * List all attachments for a table
 */
export async function handleTableAttachments(
	_request: Request,
	tableName: string,
): Promise<Response> {
	try {
		const attachments = await getTableAttachments(tableName);

		return new Response(
			JSON.stringify({
				success: true,
				data: attachments,
				table: tableName,
				count: attachments.length,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	} catch (error) {
		console.error(
			`❌ Error listing attachments for table '${tableName}':`,
			error,
		);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Internal server error",
				message: "Unable to list table attachments",
				code: "INTERNAL_ERROR",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	}
}

/**
 * List all attachments for a record
 */
export async function handleRecordAttachments(
	_request: Request,
	tableName: string,
	recordId: string,
): Promise<Response> {
	try {
		const attachments = await getRecordAttachments(tableName, recordId);

		return new Response(
			JSON.stringify({
				success: true,
				data: attachments,
				table: tableName,
				record: recordId,
				count: attachments.length,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	} catch (error) {
		console.error(
			`❌ Error listing attachments for record '${tableName}/${recordId}':`,
			error,
		);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Internal server error",
				message: "Unable to list record attachments",
				code: "INTERNAL_ERROR",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	}
}

/**
 * List all attachments for a field
 */
export async function handleFieldAttachments(
	_request: Request,
	tableName: string,
	recordId: string,
	fieldName: string,
): Promise<Response> {
	try {
		const attachments = await getFieldAttachments(
			tableName,
			recordId,
			fieldName,
		);

		return new Response(
			JSON.stringify({
				success: true,
				data: attachments,
				table: tableName,
				record: recordId,
				field: fieldName,
				count: attachments.length,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	} catch (error) {
		console.error(
			`❌ Error listing attachments for field '${tableName}/${recordId}/${fieldName}':`,
			error,
		);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Internal server error",
				message: "Unable to list field attachments",
				code: "INTERNAL_ERROR",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	}
}

/**
 * Serve a specific attachment file
 */
export async function handleSpecificAttachment(
	_request: Request,
	tableName: string,
	recordId: string,
	fieldName: string,
	filename: string,
): Promise<Response> {
	try {
		// Get all attachments for the field and find the one matching the filename
		const attachments = await getFieldAttachments(
			tableName,
			recordId,
			fieldName,
		);
		const attachment = attachments.find((att: any) => {
			const localFilename = path.basename(att.local_path || "");
			return localFilename === filename;
		});

		if (!attachment) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Attachment not found",
					message: `Attachment '${filename}' not found in ${tableName}/${recordId}/${fieldName}`,
					code: "NOT_FOUND",
				}),
				{
					status: 404,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
					},
				},
			);
		}

		return serveAttachmentFile(attachment);
	} catch (error) {
		console.error(
			`❌ Error serving specific attachment '${tableName}/${recordId}/${fieldName}/${filename}':`,
			error,
		);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Internal server error",
				message: "Unable to serve attachment",
				code: "INTERNAL_ERROR",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	}
}

/**
 * Legacy: Serve an attachment file by ID (for backward compatibility)
 */
export async function handleAttachment(
	_request: Request,
	attachmentId: string,
): Promise<Response> {
	try {
		// Get attachment info from database
		const attachment = await getAttachment(attachmentId);

		if (!attachment) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Attachment not found",
					message: `Attachment '${attachmentId}' does not exist`,
					code: "NOT_FOUND",
				}),
				{
					status: 404,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
					},
				},
			);
		}

		return serveAttachmentFile(attachment);
	} catch (error) {
		console.error(`❌ Error serving attachment '${attachmentId}':`, error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Internal server error",
				message: "Unable to serve attachment",
				code: "INTERNAL_ERROR",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	}
}

/**
 * Common function to serve an attachment file
 */
async function serveAttachmentFile(attachment: any): Promise<Response> {
	// Check if file was downloaded
	if (!attachment.local_path || !attachment.downloaded_at) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Attachment not downloaded",
				message: `Attachment '${attachment.id}' is not available locally`,
				code: "NOT_AVAILABLE",
			}),
			{
				status: 404,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	}

	// Check if file exists
	const file = Bun.file(attachment.local_path);
	const exists = await file.exists();

	if (!exists) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "File not found",
				message: `Attachment file '${attachment.id}' not found on disk`,
				code: "FILE_NOT_FOUND",
			}),
			{
				status: 404,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			},
		);
	}

	// Determine content type
	const ext = path.extname(attachment.filename || "").toLowerCase();
	const contentType = getContentType(ext);

	// Serve the file
	return new Response(file, {
		headers: {
			"Content-Type": contentType,
			"Content-Disposition": `inline; filename="${attachment.filename}"`,
			"Content-Length": (attachment.size || 0).toString(),
			"Cache-Control": "public, max-age=31536000", // 1 year cache
			"Access-Control-Allow-Origin": "*",
		},
	});
}

/**
 * Get content type based on file extension
 */
function getContentType(ext: string): string {
	const mimeTypes: Record<string, string> = {
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".gif": "image/gif",
		".webp": "image/webp",
		".svg": "image/svg+xml",
		".pdf": "application/pdf",
		".doc": "application/msword",
		".docx":
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".xls": "application/vnd.ms-excel",
		".xlsx":
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".ppt": "application/vnd.ms-powerpoint",
		".pptx":
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		".txt": "text/plain",
		".csv": "text/csv",
		".json": "application/json",
		".zip": "application/zip",
		".mp4": "video/mp4",
		".mp3": "audio/mpeg",
		".wav": "audio/wav",
	};

	return mimeTypes[ext] || "application/octet-stream";
}
