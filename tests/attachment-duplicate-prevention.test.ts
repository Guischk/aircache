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

	test("should generate deterministic filenames based on URL", () => {
		const backend = new SQLiteBackend();

		// Use reflection to access private method for testing
		const generateSafeFilename = (backend as any).generateSafeFilename.bind(
			backend,
		);

		const filename = "test-image.jpg";
		const url = "https://example.com/image.jpg";

		// Generate filename multiple times - should be identical
		const filename1 = generateSafeFilename(filename, url);
		const filename2 = generateSafeFilename(filename, url);

		expect(filename1).toBe(filename2);
		expect(filename1).toMatch(/test-image_[a-f0-9]{8}\.jpg/);
	});

	test("should generate different filenames for different URLs", () => {
		const backend = new SQLiteBackend();
		const generateSafeFilename = (backend as any).generateSafeFilename.bind(
			backend,
		);

		const filename = "test-image.jpg";
		const url1 = "https://example.com/image1.jpg";
		const url2 = "https://example.com/image2.jpg";

		const filename1 = generateSafeFilename(filename, url1);
		const filename2 = generateSafeFilename(filename, url2);

		expect(filename1).not.toBe(filename2);
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
