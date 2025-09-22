# Quick Start Guide

## Prerequisites

- [Bun](https://bun.sh) runtime installed
- Airtable account with API access
- Node.js 18+ (for compatibility with some tools)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aircache
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure your environment**
   Edit `.env` with your Airtable credentials:
   ```bash
   AIRTABLE_PERSONAL_TOKEN=your_airtable_token
   AIRTABLE_BASE_ID=your_base_id
   BEARER_TOKEN=your_api_auth_token
   ```

## First Run

1. **Start the service**
   ```bash
   bun index.ts
   ```

2. **Verify it's working**
   Open http://localhost:3000/health in your browser

3. **Check available tables**
   ```bash
   curl -H "Authorization: Bearer your_api_auth_token" \
        http://localhost:3000/api/tables
   ```

## Development Mode

For development with hot reload:
```bash
bun --hot index.ts
```

## Next Steps

- [Configuration Guide](configuration.md) - Detailed configuration options
- [API Documentation](../development/api-benchmarks.md) - API endpoints and usage
- [Architecture Overview](../architecture/overview.md) - System design and components

## Common Issues

### Port Already in Use
If port 3000 is busy, set a different port:
```bash
PORT=3001 bun index.ts
```

### Airtable Authentication
Ensure your `AIRTABLE_PERSONAL_TOKEN` has access to the specified base:
1. Go to https://airtable.com/create/tokens
2. Create a new token with appropriate scopes
3. Add the base to the token's access list

### SQLite Permissions
Ensure the process has write permissions to the data directory:
```bash
mkdir -p data
chmod 755 data
```