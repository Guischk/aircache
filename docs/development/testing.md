# Testing Guide

## Overview

Aircache uses Bun's built-in test runner for unit tests, integration tests, and performance benchmarks.

## Running Tests

### All Tests
```bash
bun test
```

### Specific Test Files
```bash
# Run attachment tests
bun test tests/attachments.test.ts

# Run functional tests
bun test tests/attachment-functional.test.ts

# Run benchmark tests
bun test tests/sqlite-vs-airtable.benchmark.ts
```

### Test with Coverage
```bash
bun test --coverage
```

## Test Categories

### Unit Tests

Test individual functions and methods:

```typescript
// Example: tests/attachments.test.ts
import { test, expect } from "bun:test";
import { normalizeKey, hashString } from "../src/lib/utils";

test("normalizeKey should handle special characters", () => {
  expect(normalizeKey("User Name")).toBe("user_name");
  expect(normalizeKey("Email-Address")).toBe("email_address");
});

test("hashString should be deterministic", () => {
  const url = "https://example.com/file.jpg";
  const hash1 = hashString(url);
  const hash2 = hashString(url);
  expect(hash1).toBe(hash2);
});
```

### Integration Tests

Test component interactions:

```typescript
// Example: tests/attachment-functional.test.ts
import { test, expect } from "bun:test";
import { SQLiteService } from "../src/lib/sqlite";

test("attachment download integration", async () => {
  const sqliteService = new SQLiteService();

  // Test attachment workflow
  const attachment = {
    id: "test-123",
    url: "https://example.com/test.jpg",
    filename: "test.jpg",
    size: 1024
  };

  // Insert attachment
  await sqliteService.insertAttachment(attachment);

  // Verify insertion
  const stored = await sqliteService.getAttachment("test-123");
  expect(stored).toBeDefined();
  expect(stored.filename).toBe("test.jpg");
});
```

### Performance Benchmarks

Measure and compare performance:

```typescript
// Example: tests/sqlite-vs-airtable.benchmark.ts
import { test, expect } from "bun:test";

test("SQLite vs Airtable performance", async () => {
  const sqliteTime = await measureSQLiteQuery();
  const airtableTime = await measureAirtableQuery();

  console.log(`SQLite: ${sqliteTime}ms`);
  console.log(`Airtable: ${airtableTime}ms`);
  console.log(`Improvement: ${(airtableTime / sqliteTime).toFixed(1)}x faster`);

  expect(sqliteTime).toBeLessThan(airtableTime);
});
```

## Test Environment Setup

### Test Configuration

Create a separate test environment:

```bash
# .env.test
AIRTABLE_PERSONAL_TOKEN=test_token
AIRTABLE_BASE_ID=test_base_id
BEARER_TOKEN=test-bearer-token
PORT=3001
REFRESH_INTERVAL=60
ENABLE_ATTACHMENT_DOWNLOAD=false
STORAGE_PATH=./test-data/attachments
SQLITE_PATH=./test-data
```

### Test Data Cleanup

```typescript
import { beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";

beforeEach(() => {
  // Clean test databases
  if (existsSync("./test-data/cache_v1.db")) {
    unlinkSync("./test-data/cache_v1.db");
  }
  if (existsSync("./test-data/cache_v2.db")) {
    unlinkSync("./test-data/cache_v2.db");
  }
});

afterEach(() => {
  // Additional cleanup if needed
});
```

## Writing Tests

### Test Structure

Follow this pattern for consistency:

```typescript
import { test, expect, describe, beforeEach, afterEach } from "bun:test";

describe("Feature Name", () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  test("should handle normal case", () => {
    // Test implementation
    expect(result).toBe(expected);
  });

  test("should handle edge case", () => {
    // Edge case testing
    expect(result).toThrow();
  });
});
```

### Test Naming Conventions

- Use descriptive test names
- Follow "should [behavior] when [condition]" pattern
- Group related tests with `describe`

```typescript
describe("Attachment processing", () => {
  test("should skip download when file exists with correct size", () => {
    // Test implementation
  });

  test("should re-download when file exists with wrong size", () => {
    // Test implementation
  });

  test("should create deterministic filename from URL hash", () => {
    // Test implementation
  });
});
```

### Mocking External Dependencies

Mock Airtable API calls for reliable testing:

```typescript
import { test, expect, mock } from "bun:test";

const mockAirtable = {
  base: mock(() => ({
    select: mock(() => ({
      firstPage: mock(async () => [
        { id: "rec123", fields: { Name: "Test" } }
      ])
    }))
  }))
};

test("should handle Airtable response", async () => {
  // Test with mocked response
  const result = await fetchFromAirtable();
  expect(result).toHaveLength(1);
});
```

## Performance Testing

### Benchmark Structure

```typescript
import { test } from "bun:test";

test("performance benchmark", async () => {
  const iterations = 100;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await operationToTest();
    times.push(performance.now() - start);
  }

  const avgTime = times.reduce((a, b) => a + b) / times.length;
  console.log(`Average time: ${avgTime.toFixed(2)}ms`);
});
```

### Load Testing

Test with realistic data volumes:

```typescript
test("handle large dataset", async () => {
  const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
    id: `rec${i}`,
    fields: { Name: `Record ${i}` }
  }));

  const start = performance.now();
  await processRecords(largeDataset);
  const duration = performance.now() - start;

  console.log(`Processed ${largeDataset.length} records in ${duration}ms`);
  expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun test --coverage
```

### Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
bun test
bun run lint
bun run typecheck
```

## Debugging Tests

### Debug Output
```typescript
import { test } from "bun:test";

test("debug example", () => {
  const result = complexOperation();
  console.log("Debug result:", result); // Shows in test output
  expect(result).toBeDefined();
});
```

### Debugging with Bun
```bash
# Run single test with debugger
bun test --debug tests/specific.test.ts

# Run with verbose output
bun test --verbose
```

## Common Test Patterns

### Testing Async Operations
```typescript
test("async operation", async () => {
  const result = await asyncOperation();
  expect(result).toBeDefined();
});
```

### Testing Error Conditions
```typescript
test("should throw on invalid input", () => {
  expect(() => {
    functionThatShouldThrow(invalidInput);
  }).toThrow("Expected error message");
});
```

### Testing File Operations
```typescript
test("file operations", async () => {
  const testFile = "./test-data/test.txt";

  await Bun.write(testFile, "test content");
  const content = await Bun.file(testFile).text();

  expect(content).toBe("test content");

  // Cleanup
  await unlink(testFile);
});
```