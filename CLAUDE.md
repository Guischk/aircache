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
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
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

This is an Airtable cache service that syncs data from Airtable to Redis using a dual-namespace strategy for zero-downtime updates.

### Core Components

- **Main Process** (`index.ts`): Manages a worker that refreshes data every 5 minutes
- **Worker** (`src/worker/index.ts`): Handles the actual data sync from Airtable to Redis
- **Airtable Client** (`src/lib/airtable/index.ts`): Configured Airtable base connection
- **Redis Helpers** (`src/lib/redis/helpers.ts`): Key generation and namespace management utilities
- **Schema** (`src/lib/airtable/schema.ts`): Generated Zod schemas for all Airtable tables

### Key Architecture Patterns

**Dual Namespace Strategy**: The system uses `v1` and `v2` Redis namespaces to enable atomic cache updates:
- Active namespace serves current data
- Inactive namespace is populated with fresh data
- After sync completes, namespaces are flipped atomically
- Prevents serving stale data during refresh cycles

**Worker-Based Refresh**: Data refresh runs in a Web Worker to avoid blocking the main thread during large data sync operations.

**Distributed Locking**: Uses Redis locks to prevent concurrent refresh operations across multiple processes/workers.

### Environment Configuration

Required environment variables:
- `AIRTABLE_PERSONAL_TOKEN`: Airtable API authentication
- `AIRTABLE_BASE_ID`: Target Airtable base identifier
- `REDIS_URL`: Redis connection string
- `CACHE_TTL`: Cache expiration time in seconds (default: 5400)
- `REFRESH_INTERVAL`: How often to refresh cache in seconds (default: 5400)
- `BEARER_TOKEN`: API authentication token

### Development Commands

- `bun run airtable:types`: Generate TypeScript types from Airtable schema
- `bun index.ts`: Start the cache service
- `bun --hot index.ts`: Start with hot reload during development

### Security Considerations

The following files contain sensitive data and are git-ignored:
- `.env`
- `src/airtable/config.ts`
- `src/airtable/schema.ts` (contains actual schema, not the generated one)
- `src/airtable/secrets.ts`
- `cache/` directory
- `*.cache.json` files

### Data Flow

1. Main process starts worker and schedules periodic refreshes
2. Worker acquires distributed lock to prevent concurrent operations
3. Worker fetches all data from configured Airtable tables
4. Data is flattened using `airtable-types-gen` and stored in inactive Redis namespace
5. After all data is synced, active namespace pointer is flipped atomically
6. Old data expires naturally via TTL

### Key Utilities

- `normalizeKey()`: Sanitizes strings for Redis key usage
- `keyRecord()`, `keyIndex()`, `keyTables()`: Generate consistent Redis keys
- `withLock()`: Provides distributed locking functionality
- `flipActiveNS()`: Atomic namespace switching