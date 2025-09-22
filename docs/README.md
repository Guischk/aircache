# Aircache Documentation

Welcome to the Aircache documentation! This comprehensive guide covers everything you need to know about setting up, configuring, and deploying the high-performance Airtable cache service.

## 🚀 Getting Started

Perfect for new users who want to get Aircache up and running quickly.

- **[Quick Start Guide](getting-started/quick-start.md)** - Get Aircache running in 5 minutes
- **[Configuration Guide](getting-started/configuration.md)** - Detailed environment setup and options

## 🏗️ Architecture

Understand how Aircache works under the hood.

- **[System Overview](architecture/overview.md)** - Core architecture and design patterns
- **[SQLite Backend](architecture/sqlite-backend.md)** - Database implementation details

## ⚡ Performance

Learn about Aircache's performance characteristics and optimization techniques.

- **[Benchmarks](performance/benchmarks.md)** - Performance comparisons and metrics
- **[Optimizations](performance/optimizations.md)** - Performance tuning techniques
- **[Attachment Handling](performance/attachments.md)** - File download optimizations

## 🚀 Deployment

Deploy Aircache in various environments from development to production.

- **[Production Deployment](deployment/production.md)** - Complete production setup guide
- **[Railway Platform](deployment/railway.md)** - Deploy on Railway cloud platform

## 🛠️ Development

Resources for developers working on or with Aircache.

- **[Testing Guide](development/testing.md)** - Testing framework and best practices
- **[Security Guidelines](development/security.md)** - Security best practices
- **[Development Scripts](development/scripts.md)** - Available development tools
- **[API Benchmarks](development/api-benchmarks.md)** - API performance testing

## 📊 Quick Reference

### System Requirements
- **Runtime**: Bun 1.0+
- **Memory**: 512MB minimum, 2GB recommended
- **Storage**: 10GB minimum (depends on dataset size)
- **Network**: Stable internet for Airtable API access

### Key Commands
```bash
# Installation
bun install

# Development
bun --hot index.ts

# Testing
bun test

# Production
bun index.ts
```

### Environment Variables
```bash
# Required
AIRTABLE_PERSONAL_TOKEN=pat_your_token
AIRTABLE_BASE_ID=app_your_base_id
BEARER_TOKEN=your_api_token

# Optional
PORT=3000
REFRESH_INTERVAL=86400
ENABLE_ATTACHMENT_DOWNLOAD=true
```

## 🆘 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Service won't start | Check environment variables and file permissions |
| High memory usage | Review dataset size and refresh interval |
| Slow performance | Check database indexes and attachment settings |
| API errors | Verify Airtable token permissions and base access |

### Getting Help

1. **Check logs**: Review application logs for error details
2. **Verify config**: Ensure all required environment variables are set
3. **Test connectivity**: Verify network access to Airtable API
4. **Review docs**: Check relevant documentation sections
5. **File issue**: Report bugs on the project repository

## 📈 Performance Overview

Aircache delivers significant performance improvements over direct Airtable API access:

- **240x faster** average response time
- **99.4% latency reduction**
- **Zero failures** in production workloads
- **Unlimited local scalability**

## 🔒 Security Features

- Bearer token authentication for API access
- File system permission controls
- Secure attachment handling
- Rate limiting support
- Production hardening guidelines

## 🔧 Maintenance

### Regular Tasks
- **Weekly**: Review logs and performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Test backup/recovery procedures
- **Annually**: Security audit and performance review

### Monitoring
- Service uptime and availability
- Response time and throughput
- Error rates and failure patterns
- Disk usage and storage growth
- Memory and CPU utilization

## 📚 Additional Resources

- **[Main README](../README.md)** - Project overview and quick start
- **[CLAUDE.md](../CLAUDE.md)** - Development guidelines for Claude Code
- **[Tests Directory](../tests/)** - Example tests and benchmarks

---

**Note**: This documentation is regularly updated to reflect the latest features and best practices. For the most current information, always refer to the latest version in the repository.