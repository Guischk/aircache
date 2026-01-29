#!/usr/bin/env bun

/**
 * Functional test demonstrating that attachments are not re-downloaded unnecessarily
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import path from "path";
import { getPendingAttachments, markAttachmentDownloaded } from "../src/lib/sqlite/helpers";
import { sqliteService } from "../src/lib/sqlite/index";
import { SQLiteBackend } from "../src/worker/backends/sqlite-backend";

describe("Attachment Re-download Prevention (Functional)", () => {
	const testStoragePath = "./test-functional-attachments";
	const originalStoragePath = process.env.STORAGE_PATH;
	const testDbPath = "./test-data";

	// Save original DB paths
	const originalV1Path = process.env.SQLITE_V1_PATH;
	const originalV2Path = process.env.SQLITE_V2_PATH;
	const originalMetadataPath = process.env.SQLITE_METADATA_PATH;

	beforeEach(async () => {
		// Set test storage path
		process.env.STORAGE_PATH = testStoragePath;
		// Ensure attachment download is enabled for this test
		process.env.ENABLE_ATTACHMENT_DOWNLOAD = "true";

		// Set test DB paths to isolate from main DB
		process.env.SQLITE_V1_PATH = path.join(testDbPath, "v1.sqlite");
		process.env.SQLITE_V2_PATH = path.join(testDbPath, "v2.sqlite");
		process.env.SQLITE_METADATA_PATH = path.join(testDbPath, "metadata.sqlite");

		// Clean up any existing test files and DBs
		await Bun.$`rm -rf ${testStoragePath}`;
		await Bun.$`rm -rf ${testDbPath}`;
		await Bun.$`mkdir -p ${testStoragePath}`;
		await Bun.$`mkdir -p ${testDbPath}`;

		// Force reconnection to use new paths
		// We need to close existing connections first if any (though sqliteService singleton might be tricky)
		await sqliteService.close();
		// Re-instantiate or re-connect would be ideal, but sqliteService is a singleton.
		// However, the connect() method uses the paths from the constructor OR env vars if we re-instantiate?
		// Actually, sqliteService reads env vars in its constructor default values.
		// Since it's a singleton exported module, it's already instantiated.
		// We might need to manually set the paths on the instance if possible, or hack it.
		// Looking at SQLiteService class, paths are private properties set in constructor.
		// We need to create a new instance or modify the existing one.

		// Since we can't easily replace the exported singleton, we'll use "any" to override private properties
		(sqliteService as any).v1Path = process.env.SQLITE_V1_PATH;
		(sqliteService as any).v2Path = process.env.SQLITE_V2_PATH;
		(sqliteService as any).metadataPath = process.env.SQLITE_METADATA_PATH;
		(sqliteService as any).activeDb = null;
		(sqliteService as any).inactiveDb = null;
		(sqliteService as any).metadataDb = null;

		// Ensure database is connected
		await sqliteService.connect();
	});

	afterEach(async () => {
		await sqliteService.close();

		// Restore original storage path
		if (originalStoragePath) {
			process.env.STORAGE_PATH = originalStoragePath;
		} else {
			delete process.env.STORAGE_PATH;
		}

		// Restore original DB paths
		if (originalV1Path) process.env.SQLITE_V1_PATH = originalV1Path;
		else delete process.env.SQLITE_V1_PATH;

		if (originalV2Path) process.env.SQLITE_V2_PATH = originalV2Path;
		else delete process.env.SQLITE_V2_PATH;

		if (originalMetadataPath) process.env.SQLITE_METADATA_PATH = originalMetadataPath;
		else delete process.env.SQLITE_METADATA_PATH;

		// Restore sqliteService paths (best effort, though it might be tricky if other tests run in same process)
		// Ideally tests should run in isolation or we should reset properly.
		(sqliteService as any).v1Path = originalV1Path || "data/airboost-v1.sqlite";
		(sqliteService as any).v2Path = originalV2Path || "data/airboost-v2.sqlite";
		(sqliteService as any).metadataPath = originalMetadataPath || "data/metadata.sqlite";

		// Reset attachment download setting (it was false in .env)
		process.env.ENABLE_ATTACHMENT_DOWNLOAD = "false";

		// Clean up test files
		await Bun.$`rm -rf ${testStoragePath}`;
		await Bun.$`rm -rf ${testDbPath}`;
	});

	test("should skip download when file already exists with correct size", async () => {
		const backend = new SQLiteBackend();

		// Mock attachment data (as it would come from Airtable)
		const mockAttachmentData = {
			url: "https://example.com/test-image.jpg",
			filename: "test-image.jpg",
			size: 1024,
			type: "image/jpeg",
		};

		// First, simulate an existing file with correct size in hierarchical structure
		const generateAttachmentPath = (backend as any).generateAttachmentPath.bind(backend);
		const relativePath = generateAttachmentPath(
			"test-table",
			"rec123",
			"photos",
			mockAttachmentData.filename,
			mockAttachmentData.url,
		);
		const localPath = path.join(testStoragePath, relativePath);

		// Ensure directory exists
		const dir = path.dirname(localPath);
		await Bun.$`mkdir -p ${dir}`;

		// Create a file with the expected size
		const testData = new Uint8Array(1024);
		testData.fill(42); // Fill with some test data
		await Bun.write(localPath, testData);

		// Verify file exists and has correct size
		const file = Bun.file(localPath);
		expect(await file.exists()).toBe(true);
		expect(file.size).toBe(1024);

		// Insert the attachment into database without download info
		await sqliteService.setRecord(
			"test-table",
			"rec123",
			{
				name: "Test Record",
				photos: [mockAttachmentData],
			},
			false,
		);

		// Get pending attachments - should include our test attachment
		const pendingBefore = await getPendingAttachments(false);
		expect(pendingBefore.length).toBeGreaterThan(0);

		// Find our specific attachment (the ID will be generated by extractAttachments)
		const ourAttachment = pendingBefore.find((a) => a.original_url === mockAttachmentData.url);
		expect(ourAttachment).toBeDefined();

		// Mock fetch to simulate download (we don't want real network requests in this test)
		const originalFetch = globalThis.fetch;
		globalThis.fetch = Object.assign(async (url: string | URL | Request) => {
			// This test relies on SKIP logic, so fetch should NOT be called for the existing file
			if (url.toString() === mockAttachmentData.url) {
				throw new Error("Should not fetch when file exists with correct size");
			}
			return originalFetch(url);
		}, originalFetch);

		try {
			// Now run the download process - it should skip downloading since file exists
			const stats = await backend.downloadPendingAttachments();

			// Should report 1 downloaded (skipped but marked as downloaded)
			expect(stats.downloaded).toBe(1);
			expect(stats.errors).toBe(0);
		} finally {
			// Restore original fetch
			globalThis.fetch = originalFetch;
		}

		// After download process, should have no pending attachments with our URL
		const pendingAfter = await getPendingAttachments(false);
		const stillPending = pendingAfter.filter((a) => a.original_url === mockAttachmentData.url);
		expect(stillPending.length).toBe(0);

		// File should still exist and be unchanged
		expect(await file.exists()).toBe(true);
		expect(file.size).toBe(1024);
	});

	test("should re-download when file exists but has wrong size", async () => {
		const backend = new SQLiteBackend();

		// Mock attachment data (as it would come from Airtable)
		const mockAttachmentData = {
			url: "https://example.com/test-doc.pdf",
			filename: "test-doc.pdf",
			size: 2048,
			type: "application/pdf",
		};

		// Create a file with wrong size in hierarchical structure
		const generateAttachmentPath = (backend as any).generateAttachmentPath.bind(backend);
		const relativePath = generateAttachmentPath(
			"test-table",
			"rec456",
			"documents",
			mockAttachmentData.filename,
			mockAttachmentData.url,
		);
		const localPath = path.join(testStoragePath, relativePath);

		// Ensure directory exists
		const dir = path.dirname(localPath);
		await Bun.$`mkdir -p ${dir}`;

		const wrongSizeData = new Uint8Array(512); // Wrong size
		wrongSizeData.fill(99);
		await Bun.write(localPath, wrongSizeData);

		// Verify file exists but has wrong size
		const file = Bun.file(localPath);
		expect(await file.exists()).toBe(true);
		expect(file.size).toBe(512); // Wrong size

		// Insert the attachment into database
		await sqliteService.setRecord(
			"test-table",
			"rec456",
			{
				name: "Test Record",
				documents: [mockAttachmentData],
			},
			false,
		);

		// Should still be pending since file has wrong size
		const pendingBefore = await getPendingAttachments(false);
		const ourAttachment = pendingBefore.find((a) => a.original_url === mockAttachmentData.url);
		expect(ourAttachment).toBeDefined();

		// Mock fetch to simulate download
		const originalFetch = globalThis.fetch;
		const correctSizeData = new Uint8Array(2048);
		correctSizeData.fill(123);

		globalThis.fetch = Object.assign(async (url: string | URL | Request) => {
			const urlStr = url.toString();
			if (urlStr === mockAttachmentData.url) {
				return new Response(correctSizeData, {
					status: 200,
					headers: { "content-type": "application/pdf" },
				});
			}
			return originalFetch(url);
		}, originalFetch);

		try {
			// Run download process
			const stats = await backend.downloadPendingAttachments();

			// Should have downloaded (not skipped)
			expect(stats.downloaded).toBe(1);
			expect(stats.errors).toBe(0);

			// File should now have correct size
			const updatedFile = Bun.file(localPath);
			expect(await updatedFile.exists()).toBe(true);
			expect(updatedFile.size).toBe(2048);
		} finally {
			// Restore original fetch
			globalThis.fetch = originalFetch;
		}
	});
});
