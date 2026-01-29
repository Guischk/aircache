# Security Guidelines

Best practices for securing your Airboost deployment.

## Sensitive Information

Airboost may handle production Airtable data. The following information should be **kept confidential**:

### Never Expose

- Real Airtable table names in public code/docs
- Business schema structure
- Exact record counts
- Specific field names
- Actual data content
- API tokens and secrets

### Acceptable to Share

- Order of magnitude (~5, ~50, ~500 records)
- Table types (Small, Medium, Large)
- Anonymized performance metrics
- Generic technical architecture

## Protected Files

### Automatically Git-Ignored

```
# Configuration
.env
.env.*

# Airtable sensitive
**/airtable/schema.ts
**/airtable/config.ts
**/airtable/mappings.json

# Data
data/
*.db

# Reports with potential data
*-report.md
```

### Files Requiring Attention

- **Unit tests**: Use dynamic table references
- **Documentation**: Generic examples only
- **Benchmarks**: Anonymize table names
- **Logs**: No business data

## Authentication

### API Bearer Token

All `/api/*` endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer your_token" \
  https://your-airboost.com/api/tables
```

**Best practices:**
- Generate with `openssl rand -hex 32`
- Use different tokens per environment
- Rotate periodically (every 90 days recommended)

### Webhook HMAC Validation

Webhook endpoints use HMAC-SHA256 signature validation:

1. Airtable signs payload with shared secret
2. Airboost validates signature
3. Timestamp checked to prevent replay attacks

The webhook secret is automatically managed and stored in the metadata database.

## Environment Security

### File Permissions

```bash
# Secure .env file
chmod 600 .env
chown $(whoami):$(whoami) .env

# Secure data directory
chmod 750 data/
chmod 640 data/*.sqlite
```

### Production Environment

```bash
# Never commit .env to version control
# Use environment variables or secret management

# Railway
# Set via dashboard or CLI: railway variables set

# Docker
docker run -e BEARER_TOKEN=xxx ...

# Kubernetes
kubectl create secret generic airboost-secrets ...
```

## Network Security

### HTTPS Only

Always use HTTPS in production:

```bash
# Reverse proxy example (nginx)
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### Rate Limiting

Webhook rate limiting is built-in:

```bash
WEBHOOK_RATE_LIMIT=30  # Min seconds between processing
```

For API rate limiting, use a reverse proxy:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:3000;
}
```

### Firewall

```bash
# Allow only necessary ports
ufw allow ssh
ufw allow 443/tcp
ufw deny 3000/tcp  # Block direct access
ufw enable
```

## Code Security

### Dynamic Table References

```typescript
// DANGEROUS - Hardcoded
const result = await apiRequest("/api/tables/Users");

// SECURE - Dynamic
const tables = await apiRequest("/api/tables");
const firstTable = tables.data.tables[0];
const result = await apiRequest(`/api/tables/${firstTable}`);
```

### Anonymous Metrics

```typescript
// DANGEROUS
console.log(`Table Users has 1,247 records`);

// SECURE
console.log(`Table has ~1000 records`);
```

### Report Anonymization

```markdown
<!-- DANGEROUS -->
| Table    | Records |
| Users    | 37      |
| Products | 142     |

<!-- SECURE -->
| Type   | Records |
| Small  | ~10     |
| Medium | ~50     |
```

## Pre-Commit Checklist

Before each commit:

- [ ] No table names in code
- [ ] Tests use dynamic references
- [ ] Documentation has generic examples
- [ ] Reports are git-ignored
- [ ] Secrets only in .env

## Security Verification

```bash
# Check for exposed table names
grep -r "YourRealTableName" . --exclude-dir=node_modules

# Check for hardcoded secrets
grep -r "pat_" . --exclude-dir=node_modules --exclude=.env

# Verify git-ignore is working
git status --porcelain | grep -E "\.env|schema\.ts|data/"
```

## Incident Response

If sensitive data is accidentally exposed:

1. **Immediate**: Remove the content
2. **Git history**: Rewrite if committed
3. **Tokens**: Regenerate any exposed tokens
4. **Documentation**: Update with generic examples
5. **Tests**: Convert to dynamic references

```bash
# Rewrite git history (last commit)
git reset --soft HEAD~1
# Remove sensitive file
git add --all
git commit -m "Clean commit"

# For older commits
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/file' \
  --prune-empty --tag-name-filter cat -- --all
```

## Regular Security Tasks

| Frequency | Task |
|-----------|------|
| Weekly | Review logs for anomalies |
| Monthly | Update dependencies |
| Quarterly | Rotate API tokens |
| Annually | Full security audit |

## Dependencies

Keep dependencies updated:

```bash
# Check for updates
bun outdated

# Update all
bun update

# Audit for vulnerabilities
bun audit
```
