# Airboost Documentation

Welcome to the Airboost documentation. Airboost is a high-performance SQLite cache for Airtable that makes your queries **240x faster**.

## Quick Links

| I want to... | Go to... |
|--------------|----------|
| Get started quickly | [Quick Start Guide](getting-started/quick-start.md) |
| Configure my instance | [Configuration Guide](getting-started/configuration.md) |
| Set up real-time sync | [Webhook Setup](webhooks.md) |
| Deploy to production | [Production Guide](deployment/production.md) |
| Understand the architecture | [Architecture Overview](architecture/overview.md) |

## Documentation Structure

### Getting Started
- **[Quick Start Guide](getting-started/quick-start.md)** - Deploy Airboost in minutes
- **[Configuration Guide](getting-started/configuration.md)** - All environment variables and settings

### Architecture
- **[System Overview](architecture/overview.md)** - How Airboost works
- **[SQLite Backend](architecture/sqlite-backend.md)** - Database implementation details

### Features
- **[Webhook Setup](webhooks.md)** - Real-time cache updates with Airtable webhooks

### Performance
- **[Benchmarks](performance/benchmarks.md)** - Performance comparison data
- **[Optimizations](performance/optimizations.md)** - Performance tuning guide
- **[Attachment Handling](performance/attachments.md)** - File download optimization

### Deployment
- **[Production Setup](deployment/production.md)** - Complete deployment guide
- **[Railway Platform](deployment/railway.md)** - One-click Railway deployment

### Development
- **[Testing Guide](development/testing.md)** - Test framework and practices
- **[Security Guidelines](development/security.md)** - Security best practices
- **[Available Scripts](development/scripts.md)** - Development commands

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Runtime | Bun 1.0+ | Bun 1.1+ |
| RAM | 512MB | 2GB |
| Storage | 10GB | 50GB SSD |
| Network | Stable | Low-latency |

## Key Concepts

### Dual-Database Strategy

Airboost uses two SQLite databases for zero-downtime updates:
1. **Active database** - Serves all API requests
2. **Inactive database** - Receives fresh data during refresh
3. **Atomic swap** - Databases switch instantly after sync

### Sync Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `polling` | Regular full refresh | Default, works everywhere |
| `webhook` | Real-time incremental updates | Low-latency requirements |
| `manual` | API-triggered refresh only | Full control scenarios |

### Type Safety

Airboost automatically generates TypeScript types from your Airtable schema:
- Access types via `/api/types` endpoint
- Field mappings via `/api/mappings` endpoint
- Full Zod validation for runtime safety

## Common Commands

```bash
# Start the server
bun run start

# Development with hot reload
bun run dev

# Run tests
bun test

# Full validation
bun run validate

# Generate types from Airtable
bun run types
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Service won't start | Check required environment variables |
| 401 Unauthorized | Verify `BEARER_TOKEN` in requests |
| Slow performance | Check database indexes, review refresh interval |
| Webhook not working | Verify `WEBHOOK_PUBLIC_URL` is publicly accessible |
| High memory usage | Review dataset size, consider pagination |

## Getting Help

1. Check the [GitHub Issues](https://github.com/guischk/airboost/issues)
2. Join [GitHub Discussions](https://github.com/guischk/airboost/discussions)
3. Review application logs for error details

## Additional Resources

- [Main README](../README.md) - Project overview
- [AGENTS.md](../AGENTS.md) - AI coding guidelines
- [API Endpoints](../README.md#api-endpoints) - Full API reference
