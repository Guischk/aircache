# Aircache

High-performance Airtable cache service built with SQLite and Bun. Provides lightning-fast REST API access to your Airtable data with zero-downtime updates.

## ✨ Features

- **🚀 Ultra-fast performance** - 240x faster than direct Airtable API calls
- **🔄 Zero-downtime updates** - Dual database strategy for seamless cache refreshes
- **📎 Attachment support** - Intelligent file download and deduplication
- **🛡️ Production-ready** - Built-in security, monitoring, and error handling
- **🧩 Type-safe** - Full TypeScript support with generated schemas

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your Airtable credentials

# Start the service
bun index.ts

# Or start with hot reload for development
bun --hot index.ts
```

**Next steps:** [Configuration Guide](docs/getting-started/configuration.md) | [Architecture Overview](docs/architecture/overview.md)

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and system status |
| `/api/tables` | GET | List all available tables |
| `/api/tables/:table` | GET | Get records from a specific table |
| `/api/tables/:table/:id` | GET | Get a specific record by ID |
| `/api/stats` | GET | Cache statistics and performance metrics |
| `/api/refresh` | POST | Trigger manual cache refresh |
| `/api/attachments/:id` | GET | Download attachment files |

**Authentication:** All API endpoints require a `Bearer` token in the `Authorization` header.

## 🔧 Configuration

### Required Environment Variables

```bash
AIRTABLE_PERSONAL_TOKEN=pat_your_token_here
AIRTABLE_BASE_ID=app_your_base_id
BEARER_TOKEN=your_secure_api_token
```

### Optional Configuration

```bash
PORT=3000                              # Server port
REFRESH_INTERVAL=86400                 # Cache refresh interval (seconds)
STORAGE_PATH=./data/attachments        # Attachments directory
SQLITE_PATH=./data                     # Database directory
ENABLE_ATTACHMENT_DOWNLOAD=true        # Enable file downloads
```

**Full guide:** [Configuration Documentation](docs/getting-started/configuration.md)

## 📖 Documentation

### Getting Started
- [Quick Start Guide](docs/getting-started/quick-start.md) - Get up and running
- [Configuration Guide](docs/getting-started/configuration.md) - Environment setup

### Architecture
- [System Overview](docs/architecture/overview.md) - Architecture and design patterns
- [SQLite Backend](docs/architecture/sqlite-backend.md) - Database implementation

### Performance
- [Benchmarks](docs/performance/benchmarks.md) - Performance comparisons
- [Optimizations](docs/performance/optimizations.md) - Performance tuning guide
- [Attachment Handling](docs/performance/attachments.md) - File optimization

### Deployment
- [Production Guide](docs/deployment/production.md) - Production deployment
- [Railway Deployment](docs/deployment/railway.md) - Railway platform guide

### Development
- [Testing Guide](docs/development/testing.md) - Testing framework
- [Security Guidelines](docs/development/security.md) - Security best practices
- [Development Scripts](docs/development/scripts.md) - Available tools

## 🏗️ Architecture

Aircache uses a **dual-database strategy** for zero-downtime cache updates:

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

**Key components:**
- **Main Process**: Coordinates server and worker operations
- **Server**: High-performance REST API with Bun.serve()
- **Worker**: Background data sync and file processing
- **SQLite Backend**: Optimized database with strategic indexing

## ⚡ Performance

- **240x faster** than direct Airtable API calls
- **99.4% latency reduction** on average
- **Zero failures** on production workloads
- **Intelligent caching** with smart invalidation

| Operation | SQLite Cache | Direct Airtable | Improvement |
|-----------|--------------|-----------------|-------------|
| Single record | 1.2ms | 288ms | 240x faster |
| Small batch | 2.0ms | 275ms | 137x faster |
| Table scan | 1.8ms | 296ms | 164x faster |

**Details:** [Performance Benchmarks](docs/performance/benchmarks.md)

## 🧪 Testing

```bash
# Run all tests
bun test

# Run specific test suites
bun test tests/attachments.test.ts
bun test tests/attachment-functional.test.ts

# Run performance benchmarks
bun test tests/sqlite-vs-airtable.benchmark.ts

# Test with coverage
bun test --coverage
```

**Guide:** [Testing Documentation](docs/development/testing.md)

## 🚀 Deployment

### Docker
```bash
docker build -t aircache .
docker run -d -p 3000:3000 --env-file .env aircache
```

### Railway
```bash
railway login
railway project create aircache
railway up
```

### Systemd Service
```bash
sudo systemctl enable aircache
sudo systemctl start aircache
```

**Full guides:** [Production Deployment](docs/deployment/production.md) | [Railway Guide](docs/deployment/railway.md)

## 🛠️ Technology Stack

- **Runtime:** [Bun](https://bun.sh) - Fast JavaScript runtime
- **Database:** SQLite with `bun:sqlite` - Local high-performance storage
- **Server:** Bun.serve() - Native HTTP server with routing
- **Validation:** Zod - Type-safe schema validation
- **Testing:** Bun test - Built-in testing framework

## 📊 Project Status

- ✅ **Production Ready** - Stable and battle-tested
- ✅ **Actively Maintained** - Regular updates and improvements
- ✅ **Well Documented** - Comprehensive guides and examples
- ✅ **Type Safe** - Full TypeScript support
- ✅ **High Performance** - Optimized for speed and efficiency

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

**Development setup:** [Getting Started Guide](docs/getting-started/quick-start.md)

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ using [Bun](https://bun.sh) 🥟
