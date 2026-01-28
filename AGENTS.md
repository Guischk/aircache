# AGENTS.md

Guidelines for AI coding agents working in the Aircache codebase.

## Build, Lint, and Test Commands

| Command                                                 | Description                                    |
| ------------------------------------------------------- | ---------------------------------------------- |
| `bun index.ts`                                          | Start the service                              |
| `bun --hot index.ts`                                    | Start with hot reload (development)            |
| `bun install`                                           | Install dependencies                           |
| `bun test`                                              | Run all tests                                  |
| `bun test tests/api.test.ts`                            | Run a specific test file                       |
| `bun test tests/api.test.ts -t "should return healthy"` | Run a single test by name                      |
| `bun test --watch`                                      | Run tests in watch mode                        |
| `bun run lint`                                          | Lint code with Biome (auto-fix)                |
| `bun run format`                                        | Format code with Biome                         |
| `bun run check`                                         | Full Biome check (lint + format with auto-fix) |
| `bun run validate`                                      | Run check + test + benchmark                   |
| `bun run benchmark`                                     | Run performance benchmarks                     |
| `bun run types`                                         | Generate Airtable types                        |

## Runtime Environment

**Use Bun, not Node.js:**

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of `jest` or `vitest`
- `bun install` instead of `npm/yarn/pnpm install`
- Bun automatically loads `.env` - do NOT use dotenv

**Bun-specific APIs (prefer these):**

- `Bun.serve()` with Elysia - not Express or Hono
- `bun:sqlite` - not `better-sqlite3`
- `Bun.file()` - not `node:fs` readFile/writeFile
- `Bun.$\`cmd\`` - not execa
- Built-in `WebSocket` - not the `ws` package

## Code Style Guidelines

### Formatting (Biome)

- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes for strings
- **Imports**: Auto-organized by Biome
- **Linting**: Biome recommended rules

### TypeScript Configuration

- **Target/Module**: ESNext with bundler resolution
- **Strict mode**: Enabled
- **noUncheckedIndexedAccess**: Enabled
- **noFallthroughCasesInSwitch**: Enabled
- **noImplicitOverride**: Enabled

### Naming Conventions

| Type             | Convention           | Example                               |
| ---------------- | -------------------- | ------------------------------------- |
| Files            | lowercase-hyphenated | `sqlite-backend.ts`, `test-config.ts` |
| Classes          | PascalCase           | `SQLiteService`, `SQLiteBackend`      |
| Functions        | camelCase            | `handleTables`, `normalizeKey`        |
| Interfaces/Types | PascalCase           | `ApiResponse`, `RefreshStats`         |
| Constants        | SCREAMING_SNAKE_CASE | `AIRTABLE_TABLE_NAMES`                |

### Import Patterns

```typescript
// Type imports use `import type`
import type { Context } from "elysia";

// Dynamic imports for optimizing startup
const { sqliteService } = await import("../../lib/sqlite/index");

// Relative imports within src/
import { handleTables } from "../handlers/tables";
```

## Error Handling Patterns

### Standard try-catch with typed errors:

```typescript
try {
  // operation
} catch (error) {
  return new Response(
    JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      backend: "sqlite",
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    },
  );
}
```

### Not found responses:

```typescript
if (!record) {
  return new Response(
    JSON.stringify({
      error: "Record not found",
      backend: "sqlite",
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
}
```

### Batch operations with Promise.allSettled:

```typescript
const results = await Promise.allSettled(items.map(processFn));
for (const result of results) {
  if (result.status === "fulfilled") processed++;
  else console.error("Processing failed:", result.reason);
}
```

## Testing Patterns

### Test file structure:

```typescript
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

describe("Feature Name", () => {
  beforeAll(async () => {
    // Setup (e.g., start server)
  });

  afterAll(() => {
    // Cleanup (e.g., stop server)
  });

  test("should [behavior] when [condition]", async () => {
    expect(result).toBe(expected);
  });
});
```

### Test server lifecycle:

Tests spawn separate server instances on different ports (3001, 3002, 3003) to avoid conflicts with the main service.

### Dynamic table references:

Never hardcode Airtable table names in tests. Always retrieve dynamically:

```typescript
const tablesResult = await apiRequest("/api/tables");
const firstTable = tablesResult.data.tables[0];
```

## Project Structure

```
aircache/
├── index.ts                    # Main entry point
├── src/
│   ├── config.ts              # Environment configuration
│   ├── api/
│   │   ├── app.ts             # Elysia application setup
│   │   ├── routes/            # Route definitions
│   │   ├── handlers/          # Request handlers (business logic)
│   │   └── middleware/        # Auth and other middleware
│   ├── server/
│   │   └── index.ts           # Server initialization
│   ├── worker/
│   │   ├── index.ts           # Background worker
│   │   └── backends/          # Storage backends
│   └── lib/
│       ├── airtable/          # Airtable client and schemas
│       ├── sqlite/            # SQLite service and helpers
│       └── utils/             # Utility functions
└── tests/                     # Test files
```

## Architecture Patterns

**Dual Database Strategy**: Uses `v1` and `v2` SQLite databases for atomic cache updates with zero-downtime. Active database serves data while inactive is refreshed.

**Handler-Route Separation**: Routes define endpoints in `src/api/routes/`, handlers contain business logic in `src/api/handlers/`.

**Dynamic Imports**: Use dynamic imports in handlers to optimize startup time.

**Singleton Services**: `sqliteService` is exported as a singleton instance.

## Security

- Never expose real Airtable table names in code or documentation
- Use dynamic table references in tests
- Sensitive files are gitignored: `.env`, `data/`, `*.cache.json`, `src/lib/airtable/schema.ts`
- Bearer token authentication required for all `/api/*` endpoints (except `/health`)
- Never perform commit on your own

## API Response Format

All API responses include `backend: "sqlite"`:

```typescript
// Success
{ backend: "sqlite", records: [], page: 1, limit: 100 }

// Error
{ backend: "sqlite", error: "Error message" }
```
