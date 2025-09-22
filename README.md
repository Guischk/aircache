<div align="center">

# 🚀 Aircache

## Make Your Airtable **3.2x Faster**

_Open-source high-performance cache service with zero-downtime updates_

[![GitHub stars](https://img.shields.io/github/stars/guischk/aircache?style=social)](https://github.com/guischk/aircache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Built%20with-Bun-black)](https://bun.sh)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aircache)

**🎯 63.6% average latency reduction • 🛡️ 100% reliability • ⚡ Zero-downtime updates**

[🚀 Deploy Now](#-quick-deployment) • [📊 View Benchmarks](#-proven-performance) • [📖 Documentation](docs/)

</div>

---

## 💡 Why Aircache?

**Stop waiting for Airtable.** Transform your slow API calls into lightning-fast responses with enterprise-grade caching.

### The Problem

- ❌ Airtable API calls: **250ms+ average latency**
- ❌ Rate limits: **5 requests/second maximum**
- ❌ Quotas and pricing tiers limiting your scale
- ❌ Network dependency for every single request

### The Solution

- ✅ **3.2x faster** responses (Real benchmarks from 19 tables)
- ✅ **100% uptime** - No external API dependency during reads
- ✅ **Unlimited scale** - No rate limits on cached data
- ✅ **Zero-downtime** cache refreshes with dual-database strategy

## ✨ Key Features

- **⚡ Proven Performance** - 3.2x faster with 63.6% latency reduction across real workloads
- **🔄 Smart Caching** - Dual database strategy for seamless, zero-downtime updates
- **📎 File Management** - Intelligent attachment download with deduplication
- **🛡️ Enterprise Ready** - Built-in security, monitoring, and error handling
- **🧩 Developer Friendly** - Full TypeScript support with auto-generated schemas
- **🐳 Easy Deploy** - One-click Railway deployment or Docker containers

## 🚀 Quick Deployment

### ⚡ **One-Click Deploy** (Recommended)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aircache)

**💡 Tip:** Please support the project by using my Railway referral link: [https://railway.com?referralCode=3Ri9K9](https://railway.com?referralCode=3Ri9K9)

_Deploy in under 60 seconds with pre-configured environment and persistent storage._

### 🐳 **Docker Deployment**

```bash
# Clone and deploy with Docker
git clone https://github.com/guischk/aircache.git
cd aircache
cp .env.example .env
# Edit .env with your Airtable credentials
docker build -t aircache .
docker run -d -p 3000:3000 --env-file .env aircache
```

### 💻 **Local Development**

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

**📋 Next steps:** [Configuration Guide](docs/getting-started/configuration.md) | [Architecture Overview](docs/architecture/overview.md)

## 📊 API Endpoints

| Endpoint                 | Method | Description                              |
| ------------------------ | ------ | ---------------------------------------- |
| `/health`                | GET    | Health check and system status           |
| `/api/tables`            | GET    | List all available tables                |
| `/api/tables/:table`     | GET    | Get records from a specific table        |
| `/api/tables/:table/:id` | GET    | Get a specific record by ID              |
| `/api/stats`             | GET    | Cache statistics and performance metrics |
| `/api/refresh`           | POST   | Trigger manual cache refresh             |
| `/api/attachments/:id`   | GET    | Download attachment files                |

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

## 📊 Proven Performance

_Real benchmarks from production workloads (September 22, 2025)_

### 🎯 **Executive Summary**

- **3.2x faster** average performance across 19 tables
- **63.6% latency reduction** on all operations
- **100% reliability** - Zero failures on 1,615 SQLite queries
- **4 scenarios tested** - Single records, batches, and table scans

### 📈 **Detailed Results**

| Scenario          | SQLite Avg | Airtable Avg | Improvement     | Reduction |
| ----------------- | ---------- | ------------ | --------------- | --------- |
| **Single Record** | 98ms       | 258ms        | **2.6x faster** | 62.0%     |
| **Small Batch**   | 96ms       | 263ms        | **2.7x faster** | 63.5%     |
| **Medium Batch**  | 98ms       | 267ms        | **2.7x faster** | 63.3%     |
| **Table Scan**    | 99ms       | 287ms        | **2.9x faster** | 65.5%     |

### 🏆 **Best Performance Gains**

- **table_C table_scan**: 36.4x faster (97.3% reduction)
- **table_J medium_batch**: 3.2x faster (69.1% reduction)
- **table_Q medium_batch**: 3.5x faster (71.5% reduction)

**Full Report:** [Performance Analysis](sqlite-vs-airtable-comparison-2025-09-22.md)

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

## 🚀 Production Deployment

### 🌐 **Cloud Platforms**

| Platform    | Deploy Time | Features                         | Link                                                                                        |
| ----------- | ----------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| **Railway** | 60 seconds  | Auto-scaling, persistent storage | [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aircache) |
| **Docker**  | 2 minutes   | Portable, self-hosted            | [Guide](docs/deployment/production.md)                                                      |
| **Systemd** | 5 minutes   | Linux native, full control       | [Guide](docs/deployment/production.md)                                                      |

### 🔧 **Production Checklist**

- ✅ **Environment Variables**: Airtable credentials configured
- ✅ **Storage**: Persistent volumes for SQLite and attachments
- ✅ **Monitoring**: Health checks on `/health` endpoint
- ✅ **Security**: Bearer token authentication enabled
- ✅ **Backup**: Regular SQLite database snapshots

**📖 Full guides:** [Production Deployment](docs/deployment/production.md) | [Railway Guide](docs/deployment/railway.md)

## 🛠️ Technology Stack

- **Runtime:** [Bun](https://bun.sh) - Fast JavaScript runtime
- **Database:** SQLite with `bun:sqlite` - Local high-performance storage
- **Server:** Bun.serve() - Native HTTP server with routing
- **Validation:** Zod - Type-safe schema validation
- **Testing:** Bun test - Built-in testing framework

## 💰 Business Impact

### **Cost Savings**

- **Reduce Airtable API usage** by 95%+ with intelligent caching
- **Avoid rate limit penalties** with unlimited local queries
- **Lower infrastructure costs** with efficient SQLite storage
- **Faster development cycles** with 3.2x performance improvement

### **Technical Benefits**

- **Zero vendor lock-in** - Works with any Airtable base
- **Offline capability** - Serve data even when Airtable is down
- **Predictable performance** - No network latency variance
- **Easy integration** - Drop-in replacement for Airtable API

## 🌟 Project Status

<div align="center">

[![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-green?style=for-the-badge)]()
[![Actively Maintained](https://img.shields.io/badge/Maintenance-Active-brightgreen?style=for-the-badge)]()
[![Open Source](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)]()

**🎯 Battle-tested • 📚 Well documented • 🛡️ Type-safe • ⚡ High performance**

</div>

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
