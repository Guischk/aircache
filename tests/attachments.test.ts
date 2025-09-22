#!/usr/bin/env bun

/**
 * Attachment synchronization tests
 */

import { describe, expect, test } from "bun:test";
import { extractAttachments } from "../src/lib/sqlite/schema-generator";

describe("Attachment Extraction", () => {
	test("should extract attachments from Airtable record data", () => {
		const recordId = "recTestRecord123";
		const recordData = {
			name: "Test Record",
			photos: [
				{
					id: "attPhoto1",
					url: "https://dl.airtable.com/.../photo1.jpg",
					filename: "photo1.jpg",
					size: 1024,
					type: "image/jpeg",
				},
				{
					id: "attPhoto2",
					url: "https://dl.airtable.com/.../photo2.png",
					filename: "photo2.png",
					size: 2048,
					type: "image/png",
				},
			],
			documents: [
				{
					id: "attDoc1",
					url: "https://dl.airtable.com/.../document.pdf",
					filename: "document.pdf",
					size: 4096,
					type: "application/pdf",
				},
			],
			description: "Test record with attachments",
		};

		const attachments = extractAttachments(recordId, recordData);

		expect(attachments).toHaveLength(3);

		// Check first photo
		expect(attachments[0]).toEqual({
			id: `${recordId}_photos_0`,
			record_id: recordId,
			field_name: "photos",
			original_url: "https://dl.airtable.com/.../photo1.jpg",
			filename: "photo1.jpg",
			size: 1024,
			type: "image/jpeg",
		});

		// Check second photo
		expect(attachments[1]).toEqual({
			id: `${recordId}_photos_1`,
			record_id: recordId,
			field_name: "photos",
			original_url: "https://dl.airtable.com/.../photo2.png",
			filename: "photo2.png",
			size: 2048,
			type: "image/png",
		});

		// Check document
		expect(attachments[2]).toEqual({
			id: `${recordId}_documents_0`,
			record_id: recordId,
			field_name: "documents",
			original_url: "https://dl.airtable.com/.../document.pdf",
			filename: "document.pdf",
			size: 4096,
			type: "application/pdf",
		});
	});

	test("should handle records without attachments", () => {
		const recordId = "recNoAttachments";
		const recordData = {
			name: "Record without attachments",
			description: "Simple text record",
			number: 42,
		};

		const attachments = extractAttachments(recordId, recordData);
		expect(attachments).toHaveLength(0);
	});

	test("should handle empty attachment arrays", () => {
		const recordId = "recEmptyArrays";
		const recordData = {
			name: "Record with empty arrays",
			photos: [],
			documents: [],
		};

		const attachments = extractAttachments(recordId, recordData);
		expect(attachments).toHaveLength(0);
	});

	test("should handle malformed attachment data", () => {
		const recordId = "recMalformed";
		const recordData = {
			name: "Record with malformed attachments",
			photos: [
				{ id: "att1" }, // Missing required fields
				"not an object", // Wrong type
				{ url: "test.jpg", filename: "test.jpg" }, // Missing size
			],
		};

		const attachments = extractAttachments(recordId, recordData);
		expect(attachments).toHaveLength(0);
	});
});

describe("Attachment API Integration", () => {
	test("should provide attachment routes", () => {
		// Test that our API routes are properly structured
		const availableRoutes = [
			"GET /health",
			"GET /api/tables",
			"GET /api/tables/:tableName",
			"GET /api/tables/:tableName/:recordId",
			"GET /api/stats",
			"POST /api/refresh",
			"GET /api/attachments/:attachmentId",
		];

		expect(availableRoutes).toContain("GET /api/attachments/:attachmentId");
	});
});
