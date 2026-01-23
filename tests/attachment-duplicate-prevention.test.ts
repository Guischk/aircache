#!/usr/bin/env bun

/**
 * Test that attachments are not re-downloaded unnecessarily
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import path from "path";
import { sqliteService } from "../src/lib/sqlite/index";
import { SQLiteBackend } from "../src/worker/backends/sqlite-backend";

describe("Attachment Duplicate Prevention", () => {
	const testStoragePath = "./test-attachments";
	const originalStoragePath = process.env.STORAGE_PATH;

	beforeEach(async () => {
		// Set test storage path
		process.env.STORAGE_PATH = testStoragePath;
		// Clean up any existing test files
		await Bun.$`rm -rf ${testStoragePath}`;
		await Bun.$`mkdir -p ${testStoragePath}`;
	});

	afterEach(async () => {
		// Restore original storage path
		if (originalStoragePath) {
			process.env.STORAGE_PATH = originalStoragePath;
		} else {
			delete process.env.STORAGE_PATH;
		}
		// Clean up test files
		await Bun.$`rm -rf ${testStoragePath}`;
	});

	test("should generate deterministic attachment paths based on URL", () => {
		const backend = new SQLiteBackend();

		// Use reflection to access private method for testing
		const generateAttachmentPath = (backend as any).generateAttachmentPath.bind(backend);

		const tableName = "Table1";
		const recordId = "rec123";
		const fieldName = "attachments";
		const filename = "test-image.jpg";
		const url = "https://example.com/image.jpg";

		// Generate path multiple times - should be identical
		const path1 = generateAttachmentPath(tableName, recordId, fieldName, filename, url);
		const path2 = generateAttachmentPath(tableName, recordId, fieldName, filename, url);

		expect(path1).toBe(path2);
		expect(path1).toMatch(/Table1[\\/]rec123[\\/]attachments[\\/]test-image_[a-f0-9]{8}\.jpg/);
	});

	test("should generate different paths for different URLs", () => {
		const backend = new SQLiteBackend();
		const generateAttachmentPath = (backend as any).generateAttachmentPath.bind(backend);

		const tableName = "Table1";
		const recordId = "rec123";
		const fieldName = "attachments";
		const filename = "test-image.jpg";
		const url1 = "https://example.com/image1.jpg";
		const url2 = "https://example.com/image2.jpg";

		const path1 = generateAttachmentPath(tableName, recordId, fieldName, filename, url1);
		const path2 = generateAttachmentPath(tableName, recordId, fieldName, filename, url2);

		expect(path1).not.toBe(path2);
	});

	test("should create consistent hash for same string", () => {
		const backend = new SQLiteBackend();
		const hashString = (backend as any).hashString.bind(backend);

		const testString = "https://example.com/test.jpg";
		const hash1 = hashString(testString);
		const hash2 = hashString(testString);

		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^[a-f0-9]+$/);
	});

	test("should create different hashes for different strings", () => {
		const backend = new SQLiteBackend();
		const hashString = (backend as any).hashString.bind(backend);

		const hash1 = hashString("https://example.com/test1.jpg");
		const hash2 = hashString("https://example.com/test2.jpg");

		expect(hash1).not.toBe(hash2);
	});
});
