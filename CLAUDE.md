# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## Project Architecture

This is an Airtable cache service that syncs data from Airtable to SQLite using a dual-database strategy for zero-downtime updates.

### Core Components

- **Main Process** (`index.ts`): Manages a worker that refreshes data periodically
- **Server** (`src/server/index.ts`): Main server entry point and configuration
- **Worker** (`src/worker/index.ts`): Handles the actual data sync from Airtable to SQLite
- **Airtable Client** (`src/lib/airtable/index.ts`): Configured Airtable base connection
- **SQLite Helpers** (`src/lib/sqlite/helpers.ts`): Database management and versioning utilities
- **Schema** (`src/lib/airtable/schema.ts`): Generated Zod schemas for all Airtable tables

### Key Architecture Patterns

**Dual Database Strategy**: The system uses `v1` and `v2` SQLite databases to enable atomic cache updates:
- Active database serves current data
- Inactive database is populated with fresh data
- After sync completes, databases are flipped atomically
- Prevents serving stale data during refresh cycles

**Worker-Based Refresh**: Data refresh runs in a Web Worker to avoid blocking the main thread during large data sync operations.

**File-Based Locking**: Uses file system locks to prevent concurrent refresh operations across multiple processes/workers.

### Environment Configuration

Required environment variables:
- `AIRTABLE_PERSONAL_TOKEN`: Airtable API authentication
- `AIRTABLE_BASE_ID`: Target Airtable base identifier
- `SQLITE_PATH`: SQLite database path (default: ./data)
- `STORAGE_PATH`: Attachments storage path (default: ./data/attachments)
- `REFRESH_INTERVAL`: How often to refresh cache in seconds (default: 86400)
- `BEARER_TOKEN`: API authentication token
- `PORT`: Server port (default: 3000)

### Development Commands

- `bun run airtable:types`: Generate TypeScript types from Airtable schema
- `bun index.ts`: Start the cache service
- `bun --hot index.ts`: Start with hot reload during development
- `bun test`: Run all tests
- `bun run demo`: Run demonstration script

### Security Considerations

The following files contain sensitive data and are git-ignored:
- `.env`
- `data/` directory (SQLite databases)
- `*.cache.json` files

### Data Flow

1. Main process starts worker and schedules periodic refreshes
2. Worker acquires file-based lock to prevent concurrent operations
3. Worker fetches all data from configured Airtable tables
4. Data is flattened using `airtable-types-gen` and stored in inactive SQLite database
5. After all data is synced, active database pointer is flipped atomically
6. Old database is cleaned up for next refresh cycle

### Key Utilities

- `normalizeKey()`: Sanitizes strings for database usage
- `sqliteService`: Main SQLite service for database operations
- `getActiveVersion()`, `flipActiveVersion()`: Database version management
- File-based locking for concurrent operation prevention