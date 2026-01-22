# Aircache Documentation

Complete guide for setting up and running Aircache - a high-performance SQLite cache for Airtable.

## Getting Started

New to Aircache? Start here:

- **[Quick Start Guide](getting-started/quick-start.md)** - Deploy in 5 minutes
- **[Configuration Guide](getting-started/configuration.md)** - Environment variables and settings
- **[Webhook Setup](webhooks.md)** - Real-time cache updates

## Architecture

How Aircache works:

- **[System Overview](architecture/overview.md)** - Core design patterns
- **[SQLite Backend](architecture/sqlite-backend.md)** - Database implementation

## Performance

Optimization and benchmarking:

- **[Benchmarks](performance/benchmarks.md)** - Performance metrics
- **[Optimizations](performance/optimizations.md)** - Tuning techniques
- **[Attachment Handling](performance/attachments.md)** - File optimization

## Deployment

Production guides:

- **[Production Setup](deployment/production.md)** - Complete deployment guide
- **[Railway Platform](deployment/railway.md)** - One-click Railway deployment

## Development

For contributors:

- **[Testing Guide](development/testing.md)** - Test framework
- **[Security Guidelines](development/security.md)** - Best practices
- **[Development Scripts](development/scripts.md)** - Available commands
- **[API Benchmarks](development/api-benchmarks.md)** - Performance testing

## Quick Reference

**System Requirements:**
- Bun 1.0+
- 512MB RAM minimum (2GB recommended)
- 10GB storage (varies with dataset size)

**Key Commands:**
```bash
bun install              # Install dependencies
bun --hot index.ts       # Development mode
bun test                 # Run tests
bun run benchmark        # Performance tests
bun run validate         # Lint + test + benchmark
```

**Essential Variables:**
```bash
AIRTABLE_PERSONAL_TOKEN=pat_your_token
AIRTABLE_BASE_ID=app_your_base_id
BEARER_TOKEN=your_api_token
```

## Common Issues

| Issue                | Solution                                           |
| -------------------- | -------------------------------------------------- |
| Service won't start  | Check environment variables and file permissions   |
| High memory usage    | Review dataset size and refresh interval           |
| Slow performance     | Check database indexes and attachment settings     |
| API errors           | Verify Airtable token permissions                  |
| Webhook not working  | Verify WEBHOOK_PUBLIC_URL and WEBHOOK_SECRET       |

## Getting Help

1. Check application logs for errors
2. Verify environment variables are set correctly
3. Review relevant documentation sections
4. [Report issues](https://github.com/guischk/aircache/issues) on GitHub

## Additional Resources

- [Main README](../README.md) - Project overview
- [AGENTS.md](../AGENTS.md) - Development guidelines
- [Tests Directory](../tests/) - Example tests