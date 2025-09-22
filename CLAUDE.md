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

Aircache is a high-performance Airtable cache service that syncs data from Airtable to SQLite using a dual-database strategy for zero-downtime updates. It provides a REST API that is 240x faster than direct Airtable access.

### Core Components

- **Main Process** (`index.ts`): Coordinates server and worker operations
- **Server** (`src/server/index.ts`): High-performance REST API with Bun.serve()
- **Worker** (`src/worker/index.ts`): Background data sync and file processing
- **SQLite Backend** (`src/worker/backends/sqlite-backend.ts`): Optimized database with strategic indexing
- **Airtable Client** (`src/lib/airtable/index.ts`): Configured Airtable base connection
- **SQLite Helpers** (`src/lib/sqlite/index.ts`): Database management and versioning utilities
- **Schema** (`src/lib/airtable/schema.ts`): Generated Zod schemas for all Airtable tables

### Key Architecture Patterns

**Dual Database Strategy**: Uses `v1` and `v2` SQLite databases for atomic cache updates:
- Active database serves current data
- Inactive database is populated with fresh data
- After sync completes, databases are flipped atomically
- Prevents serving stale data during refresh cycles

**Worker-Based Refresh**: Data refresh runs in a Web Worker to avoid blocking the main thread.

**File-Based Locking**: Uses file system locks to prevent concurrent refresh operations.

**Performance Optimizations**:
- Batch processing (50 records per transaction)
- Attachment deduplication with deterministic naming
- Strategic database indexes
- Connection pooling for downloads

### Environment Configuration

Required environment variables:
- `AIRTABLE_PERSONAL_TOKEN`: Airtable API authentication
- `AIRTABLE_BASE_ID`: Target Airtable base identifier
- `BEARER_TOKEN`: API authentication token

Optional environment variables:
- `PORT`: Server port (default: 3000)
- `SQLITE_PATH`: SQLite database path (default: ./data)
- `STORAGE_PATH`: Attachments storage path (default: ./data/attachments)
- `REFRESH_INTERVAL`: Cache refresh interval in seconds (default: 86400)
- `ENABLE_ATTACHMENT_DOWNLOAD`: Enable file downloads (default: true)

### Development Commands

- `bun index.ts`: Start the cache service
- `bun --hot index.ts`: Start with hot reload during development
- `bun test`: Run all tests
- `bun test tests/sqlite-vs-airtable.benchmark.ts`: Run performance benchmarks

### Documentation Structure

The project uses a comprehensive documentation structure:

```
docs/
├── README.md              # Main documentation index
├── getting-started/       # Quick start and configuration
├── architecture/          # System design and patterns
├── performance/           # Benchmarks and optimizations
├── deployment/           # Production and platform guides
└── development/          # Testing, security, and tools
```

Key documentation files:
- [Getting Started](docs/getting-started/quick-start.md): Setup and configuration
- [Architecture Overview](docs/architecture/overview.md): System design
- [Performance Benchmarks](docs/performance/benchmarks.md): Performance data
- [Production Deployment](docs/deployment/production.md): Production setup

### Security Considerations

Git-ignored sensitive files:
- `.env` - Environment variables
- `data/` - SQLite databases and attachments
- `*.cache.json` - Cache files

### Performance Characteristics

- **240x faster** than direct Airtable API calls
- **99.4% latency reduction** on average
- **Zero failures** on production workloads
- **Intelligent caching** with smart invalidation