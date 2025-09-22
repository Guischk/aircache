# Configuration Guide

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AIRTABLE_PERSONAL_TOKEN` | Airtable API token | `patAbc123...` |
| `AIRTABLE_BASE_ID` | Airtable base identifier | `appXyz789...` |
| `BEARER_TOKEN` | API authentication token | `your-secret-token` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REFRESH_INTERVAL` | `86400` | Cache refresh interval (seconds) |
| `STORAGE_PATH` | `./data/attachments` | Attachments storage directory |
| `SQLITE_PATH` | `./data` | SQLite database directory |
| `ENABLE_ATTACHMENT_DOWNLOAD` | `true` | Enable attachment downloads |

## Configuration Examples

### Development Environment
```bash
# .env.development
AIRTABLE_PERSONAL_TOKEN=patDev123...
AIRTABLE_BASE_ID=appDev789...
BEARER_TOKEN=dev-token
PORT=3000
REFRESH_INTERVAL=3600
ENABLE_ATTACHMENT_DOWNLOAD=false
STORAGE_PATH=./dev-data/attachments
SQLITE_PATH=./dev-data
```

### Production Environment
```bash
# .env.production
AIRTABLE_PERSONAL_TOKEN=patProd123...
AIRTABLE_BASE_ID=appProd789...
BEARER_TOKEN=secure-production-token
PORT=3000
REFRESH_INTERVAL=86400
ENABLE_ATTACHMENT_DOWNLOAD=true
STORAGE_PATH=/var/lib/aircache/attachments
SQLITE_PATH=/var/lib/aircache/db
```

### Testing Environment
```bash
# .env.test
AIRTABLE_PERSONAL_TOKEN=patTest123...
AIRTABLE_BASE_ID=appTest789...
BEARER_TOKEN=test-token
PORT=3001
REFRESH_INTERVAL=300
ENABLE_ATTACHMENT_DOWNLOAD=false
STORAGE_PATH=./test-data/attachments
SQLITE_PATH=./test-data
```

## Airtable Configuration

### Getting Your API Token

1. Go to https://airtable.com/create/tokens
2. Click "Create new token"
3. Give it a descriptive name (e.g., "Aircache Production")
4. Set appropriate scopes:
   - `data.records:read` (required)
   - `data.recordComments:read` (if using comments)
   - `schema.bases:read` (for schema introspection)

### Finding Your Base ID

1. Go to https://airtable.com/api
2. Select your base
3. The base ID is shown in the URL and documentation (starts with `app`)

### Base Requirements

Your Airtable base should have:
- At least one table with data
- Consistent field naming (avoid special characters)
- Proper field types configured

## Performance Tuning

### Refresh Interval

Choose based on your use case:
- **Real-time needs**: 300-900 seconds (5-15 minutes)
- **Regular updates**: 3600-7200 seconds (1-2 hours)
- **Daily refresh**: 86400 seconds (24 hours)
- **Weekly refresh**: 604800 seconds (7 days)

### Attachment Downloads

Disable for better performance in development:
```bash
ENABLE_ATTACHMENT_DOWNLOAD=false
```

Keep enabled in production if you need file access:
```bash
ENABLE_ATTACHMENT_DOWNLOAD=true
```

### Storage Paths

#### Development
Use relative paths for easy cleanup:
```bash
STORAGE_PATH=./data/attachments
SQLITE_PATH=./data
```

#### Production
Use absolute paths with proper permissions:
```bash
STORAGE_PATH=/var/lib/aircache/attachments
SQLITE_PATH=/var/lib/aircache/db
```

## Security Configuration

### API Authentication

The `BEARER_TOKEN` secures your API endpoints. Use a strong, unique token:

```bash
# Generate a secure token
openssl rand -hex 32
```

### File Permissions

Ensure proper file system permissions:
```bash
# Create directories with correct permissions
mkdir -p /var/lib/aircache/{db,attachments}
chmod 750 /var/lib/aircache
chmod 750 /var/lib/aircache/db
chmod 750 /var/lib/aircache/attachments

# Set ownership (if running as specific user)
chown -R aircache:aircache /var/lib/aircache
```

### Network Security

For production deployment:
- Use HTTPS reverse proxy (nginx, Cloudflare)
- Implement rate limiting
- Consider IP whitelisting for admin endpoints

## Validation

Verify your configuration:

```bash
# Check environment variables
bun -e "console.log(process.env.AIRTABLE_BASE_ID)"

# Test Airtable connection
curl -H "Authorization: Bearer $BEARER_TOKEN" \
     http://localhost:3000/health

# Verify data directory permissions
ls -la data/
```

## Troubleshooting

### Common Configuration Issues

1. **Invalid Airtable Token**
   ```
   Error: Invalid API token
   ```
   Solution: Verify token permissions and base access

2. **Base Not Found**
   ```
   Error: Base not found
   ```
   Solution: Check `AIRTABLE_BASE_ID` format (should start with `app`)

3. **Permission Denied**
   ```
   Error: EACCES: permission denied
   ```
   Solution: Check file system permissions for storage paths

4. **Port In Use**
   ```
   Error: EADDRINUSE: port already in use
   ```
   Solution: Change `PORT` or stop conflicting service