<div align="center">

# Aircache

**High-performance SQLite cache for Airtable - 3x faster with zero-downtime updates**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aircache?referralCode=3Ri9K9)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**3x faster • Real-time webhooks • Production ready**

</div>

## Features

- **Fast** - 3x faster than direct Airtable API calls
- **Real-time** - Webhook support for instant cache updates
- **Reliable** - Dual database strategy prevents downtime during refreshes
- **Simple** - Deploy in 60 seconds with Railway
- **Type-safe** - Full TypeScript support with Zod validation

## Performance

| Metric          | Direct Airtable | With Aircache | Improvement |
| --------------- | --------------- | ------------- | ----------- |
| Avg response    | 270ms           | 98ms          | **3x**      |
| Latency reduced | -               | -             | **64%**     |

## Quick Start

### Deploy on Railway (60 seconds)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aircache?referralCode=3Ri9K9)

1. Click the deploy button
2. Add your Airtable credentials
3. Done!

### Local Development

```bash
bun install
cp .env.example .env
# Edit .env with your credentials
bun index.ts
```

## API Endpoints

| Endpoint                 | Description                       |
| ------------------------ | --------------------------------- |
| `/health`                | Health check                      |
| `/api/tables`            | List all tables                   |
| `/api/tables/:table`     | Get records from table            |
| `/api/tables/:table/:id` | Get specific record               |
| `/api/stats`             | Cache statistics                  |
| `/api/refresh`           | Trigger cache refresh (POST)      |
| `/api/attachments/:id`   | Download attachment               |
| `/webhooks/airtable/refresh` | Webhook endpoint (POST)   |

All endpoints require Bearer token authentication except `/health`.

## Configuration

### Required Variables

```bash
AIRTABLE_PERSONAL_TOKEN=pat_your_token
AIRTABLE_BASE_ID=app_your_base_id
BEARER_TOKEN=your_secure_token
```

### Optional Variables

```bash
PORT=3000                           # Server port
REFRESH_INTERVAL=86400              # Auto-refresh interval (seconds)
ENABLE_ATTACHMENT_DOWNLOAD=true     # Enable file downloads

# Webhook configuration
WEBHOOK_SECRET=your_webhook_secret  # Min 32 chars (use: openssl rand -hex 32)
WEBHOOK_PUBLIC_URL=https://your.domain.com  # For auto-setup
WEBHOOK_AUTO_SETUP=true             # Auto-create webhooks on startup
```

See [Configuration Guide](docs/getting-started/configuration.md) for details.

## Architecture

Aircache uses a **dual-database strategy** for zero-downtime cache updates:

- Active database serves requests
- Inactive database receives fresh data
- Databases swap atomically after sync
- Webhook support for real-time incremental updates

**Tech Stack:**
- [Bun](https://bun.sh) - Fast JavaScript runtime
- SQLite with `bun:sqlite` - Local database
- Bun.serve() - Native HTTP server
- Zod - Type-safe validation

See [Architecture Overview](docs/architecture/overview.md) for details.

## Documentation

- [Quick Start Guide](docs/getting-started/quick-start.md)
- [Configuration](docs/getting-started/configuration.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Webhook Setup](docs/webhooks.md)
- [Performance Benchmarks](docs/performance/benchmarks.md)
- [Production Deployment](docs/deployment/production.md)

## Testing

```bash
bun test                    # Run all tests
bun run benchmark          # Run performance benchmarks
bun run validate           # Lint + test + benchmark
```

## License

MIT License - See [LICENSE](LICENSE) for details

Built with [Bun](https://bun.sh)
