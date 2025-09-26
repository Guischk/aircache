<div align="center">

# 🚀 Aircache

**High-performance Airtable cache service - 3.2x faster responses with zero-downtime updates**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aircache?referralCode=3Ri9K9)
[![GitHub stars](https://img.shields.io/github/stars/guischk/aircache?style=social)](https://github.com/guischk/aircache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**⚡ 3.2x faster • 📊 63.6% latency reduction • 🚀 Deploy in 60s**

</div>

## ✨ Features

- **⚡ 3.2x faster responses** - Proven performance with 63.6% latency reduction
- **🔄 Zero-downtime updates** - Dual database strategy for seamless cache refreshes
- **📎 Smart file handling** - Intelligent attachment download with deduplication
- **🛡️ Production ready** - Built-in security, monitoring, and error handling
- **🧩 Developer friendly** - Full TypeScript support with auto-generated schemas

## ⚡ Performance

| Scenario              | Direct Airtable | With Aircache | Improvement     |
| --------------------- | --------------- | ------------- | --------------- |
| **Dashboard queries** | 250ms           | 98ms          | **2.6x faster** |
| **Search operations** | 300ms           | 96ms          | **3.1x faster** |
| **Mobile app calls**  | 280ms           | 99ms          | **2.8x faster** |
| **Analytics reports** | 500ms+          | 100ms         | **5x+ faster**  |

## 🚀 Quick Start

### Deploy in 60 seconds

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aircache?referralCode=3Ri9K9)

1. Click deploy button above
2. Add your Airtable credentials
3. Your cache is live! 🎉

### Local Development

```bash
bun install
cp .env.example .env
# Edit .env with your Airtable credentials
bun index.ts
```

## 📊 API

| Endpoint                 | Method | Description                              |
| ------------------------ | ------ | ---------------------------------------- |
| `/health`                | GET    | Health check and system status           |
| `/api/tables`            | GET    | List all available tables                |
| `/api/tables/:table`     | GET    | Get records from a specific table        |
| `/api/tables/:table/:id` | GET    | Get a specific record by ID              |
| `/api/stats`             | GET    | Cache statistics and performance metrics |
| `/api/refresh`           | POST   | Trigger manual cache refresh             |
| `/api/attachments/:id`   | GET    | Download attachment files                |

**Authentication:** Bearer token required in Authorization header.

## 🔧 Configuration

Required environment variables:

```bash
AIRTABLE_PERSONAL_TOKEN=pat_your_token_here
AIRTABLE_BASE_ID=app_your_base_id
BEARER_TOKEN=your_secure_api_token
```

Optional:

```bash
PORT=3000
REFRESH_INTERVAL=86400
ENABLE_ATTACHMENT_DOWNLOAD=true
```

## 🏗️ Architecture

Aircache uses a **dual-database strategy** for zero-downtime updates:

```
┌─────────────┐    ┌─────────────┐
│   Active    │    │  Inactive   │
│ Database    │ ⟷  │ Database    │
│ (Serving)   │    │ (Updating)  │
└─────────────┘    └─────────────┘
       │                  │
       └──── Atomic ──────┘
            Switch
```

- **Server**: High-performance REST API with Bun.serve()
- **Worker**: Background data sync and file processing
- **SQLite Backend**: Optimized database with strategic indexing

## 🛠️ Technology

- **Runtime:** [Bun](https://bun.sh) - Fast JavaScript runtime
- **Database:** SQLite with `bun:sqlite`
- **Server:** Bun.serve() native HTTP server
- **Validation:** Zod type-safe schemas
- **Testing:** Bun test framework

## 🧪 Testing

```bash
# Run all tests
bun test

# Run benchmarks
bun test tests/sqlite-vs-airtable.benchmark.ts
```

## 📚 Documentation

- [Getting Started](docs/getting-started/quick-start.md)
- [Configuration Guide](docs/getting-started/configuration.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Performance Benchmarks](docs/performance/benchmarks.md)
- [Production Deployment](docs/deployment/production.md)

## 📄 License

MIT License - Built with ❤️ using [Bun](https://bun.sh)
