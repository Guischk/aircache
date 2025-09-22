/**
 * Attachments handlers for SQLite
 */

import path from "node:path";
import { getAttachment } from "../../lib/sqlite/helpers";

/**
 * Serve an attachment file by ID
 */
export async function handleAttachment(
	request: Request,
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

		// Check if file was downloaded
		if (!attachment.local_path || !attachment.downloaded_at) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Attachment not downloaded",
					message: `Attachment '${attachmentId}' is not available locally`,
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
					message: `Attachment file '${attachmentId}' not found on disk`,
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
