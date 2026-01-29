# Configuration Guide

Complete reference for all Airboost configuration options.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AIRTABLE_PERSONAL_TOKEN` | Airtable API token | `patAbc123...` |
| `AIRTABLE_BASE_ID` | Airtable base identifier | `appXyz789...` |
| `BEARER_TOKEN` | API authentication token | `your-secret-token` |

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

### Sync Mode Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNC_MODE` | `polling` | Sync mode: `polling`, `webhook`, or `manual` |
| `REFRESH_INTERVAL` | `86400` | Polling interval in seconds (24h default) |
| `FAILSAFE_REFRESH_INTERVAL` | `86400` | Failsafe refresh for webhook mode |

### Webhook Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_PUBLIC_URL` | - | Public URL (required for webhook mode) |
| `WEBHOOK_AUTO_SETUP` | `true` | Auto-create webhook on startup |
| `WEBHOOK_RATE_LIMIT` | `30` | Min seconds between webhook processing |
| `WEBHOOK_TIMESTAMP_WINDOW` | `300` | Max age of webhook timestamp |
| `WEBHOOK_IDEMPOTENCY_TTL` | `86400` | Deduplication cache duration |

### Storage Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SQLITE_V1_PATH` | `data/airboost-v1.sqlite` | Primary database path |
| `SQLITE_V2_PATH` | `data/airboost-v2.sqlite` | Secondary database path |
| `SQLITE_METADATA_PATH` | `data/metadata.sqlite` | Metadata database path |
| `STORAGE_PATH` | `./data/attachments` | Attachment storage directory |
| `ENABLE_ATTACHMENT_DOWNLOAD` | `true` | Enable attachment downloads |

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CONSOLA_LEVEL` | `3` | Log level (0=silent, 3=info, 6=debug) |
| `CONSOLA_FANCY` | `true` | Enable colored output |

## Sync Modes Explained

### Polling Mode (Default)

Regular full cache refresh at a specified interval.

```bash
SYNC_MODE=polling
REFRESH_INTERVAL=86400  # 24 hours
```

**Best for:**
- Simple deployments
- Infrequently changing data
- Environments without public URLs

### Webhook Mode

Real-time incremental updates via Airtable webhooks.

```bash
SYNC_MODE=webhook
WEBHOOK_PUBLIC_URL=https://airboost.yourcompany.com
WEBHOOK_AUTO_SETUP=true
FAILSAFE_REFRESH_INTERVAL=86400
```

**Best for:**
- Low-latency requirements
- Frequently changing data
- Production environments

**Requirements:**
- Public HTTPS URL
- Airtable token with `webhook:manage` scope

### Manual Mode

No automatic refresh. Only refreshes via API call.

```bash
SYNC_MODE=manual
```

**Best for:**
- Full control over refresh timing
- Batch processing workflows
- Development and testing

Trigger refresh manually:
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://your-airboost.com/api/refresh
```

## Configuration Examples

### Development

```bash
# .env
AIRTABLE_PERSONAL_TOKEN=pat_dev_token
AIRTABLE_BASE_ID=app_dev_base
BEARER_TOKEN=dev-token

PORT=3000
SYNC_MODE=polling
REFRESH_INTERVAL=300  # 5 minutes for faster iteration

ENABLE_ATTACHMENT_DOWNLOAD=false  # Skip downloads for speed
CONSOLA_LEVEL=5  # Verbose logging
```

### Production (Polling)

```bash
# .env
AIRTABLE_PERSONAL_TOKEN=pat_prod_token
AIRTABLE_BASE_ID=app_prod_base
BEARER_TOKEN=secure-production-token-generated-with-openssl

PORT=3000
SYNC_MODE=polling
REFRESH_INTERVAL=86400  # 24 hours

ENABLE_ATTACHMENT_DOWNLOAD=true
STORAGE_PATH=/var/lib/airboost/attachments
CONSOLA_LEVEL=3  # Info level
CONSOLA_FANCY=false  # Plain logs for production
```

### Production (Webhook)

```bash
# .env
AIRTABLE_PERSONAL_TOKEN=pat_prod_token
AIRTABLE_BASE_ID=app_prod_base
BEARER_TOKEN=secure-production-token

PORT=3000
SYNC_MODE=webhook
WEBHOOK_PUBLIC_URL=https://airboost.yourcompany.com
WEBHOOK_AUTO_SETUP=true
FAILSAFE_REFRESH_INTERVAL=86400

ENABLE_ATTACHMENT_DOWNLOAD=true
```

### Railway Deployment

```bash
# Set in Railway dashboard
AIRTABLE_PERSONAL_TOKEN=pat_xxx
AIRTABLE_BASE_ID=appxxx
BEARER_TOKEN=secure-token

SYNC_MODE=webhook
WEBHOOK_PUBLIC_URL=${{RAILWAY_PUBLIC_DOMAIN}}
WEBHOOK_AUTO_SETUP=true
```

## Airtable Token Configuration

### Required Scopes

| Scope | Required For |
|-------|--------------|
| `data.records:read` | Reading table data |
| `schema.bases:read` | Type generation |
| `webhook:manage` | Webhook mode only |

### Creating Your Token

1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Click "Create new token"
3. Name: `Airboost Production` (or similar)
4. Add required scopes
5. Add your base to the access list
6. Create and securely store the token

## Security Best Practices

### Generate Secure Tokens

```bash
# Generate a secure BEARER_TOKEN
openssl rand -hex 32
```

### File Permissions

```bash
# Secure your .env file
chmod 600 .env

# Secure data directory
chmod 750 data/
```

### Network Security

- Always use HTTPS in production
- Consider IP whitelisting for the API
- Use a reverse proxy (nginx, Cloudflare) for rate limiting

## Validation

Verify your configuration:

```bash
# Check environment variables are loaded
bun -e "console.log(process.env.AIRTABLE_BASE_ID)"

# Test the health endpoint
curl http://localhost:3000/health

# Test authenticated endpoint
curl -H "Authorization: Bearer $BEARER_TOKEN" \
  http://localhost:3000/api/stats
```

## Troubleshooting

### Missing Environment Variables

```
Error: Missing required environment variables
```

Ensure all required variables are set in your `.env` file or environment.

### Invalid Sync Mode

```
Error: Invalid SYNC_MODE: xyz
```

`SYNC_MODE` must be one of: `polling`, `webhook`, `manual`

### Webhook URL Required

```
Error: WEBHOOK_PUBLIC_URL is required when SYNC_MODE=webhook
```

Set `WEBHOOK_PUBLIC_URL` to your public HTTPS URL, or switch to `polling` mode.

### Permission Denied

```
Error: EACCES: permission denied
```

Check file system permissions for storage paths:

```bash
mkdir -p data
chmod 755 data
```
