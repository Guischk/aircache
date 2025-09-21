# Aircache

SQLite-based caching service for Airtable data with REST API.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Start the service
bun index.ts

# Or start with hot reload
bun --hot index.ts
```

## 📊 API Endpoints

- `GET /health` - Health check
- `GET /api/tables` - List all tables
- `GET /api/tables/:table` - Get records from a table
- `GET /api/tables/:table/:id` - Get a specific record
- `GET /api/stats` - Cache statistics
- `POST /api/refresh` - Manual cache refresh

## 🔧 Configuration

Required environment variables:

- `AIRTABLE_PERSONAL_TOKEN` - Airtable API token
- `AIRTABLE_BASE_ID` - Airtable base ID
- `BEARER_TOKEN` - API authentication token

Optional:

- `PORT` - Server port (default: 3000)
- `REFRESH_INTERVAL` - Cache refresh interval in seconds (default: 86400 = 24 hours)

## 📖 Documentation

- [Benchmarks](docs/BENCHMARK.md) - Performance benchmarks
- [Security](docs/SECURITY.md) - Security documentation
- [Scripts](docs/SCRIPTS.md) - Available scripts
- [Deployment](docs/RAILWAY-DEPLOYMENT.md) - Railway deployment guide
- [Migration](docs/MIGRATION-SQLITE.md) - SQLite migration guide

## 🏗️ Architecture

```
src/
├── server/           # Server initialization
├── api/
│   ├── handlers/     # Route handlers
│   └── middleware/   # Auth, CORS middleware
├── worker/
│   └── backends/     # SQLite implementation
├── lib/
│   ├── airtable/     # Airtable client
│   ├── sqlite/       # SQLite helpers
│   └── utils/        # Utilities
tests/                # Tests and benchmarks
scripts/              # Utility scripts
docs/                 # Documentation
```

## 🧪 Testing

```bash
# Run all tests
bun test

# Run specific benchmark
bun tests/sqlite-vs-airtable.benchmark.ts
```

## 📦 Build

```bash
bun run build
```

Built with [Bun](https://bun.sh) 🥟
