# Migration Redis → SQLite

## 🎯 Objective

Migrate the Redis cache architecture to SQLite to:
- **Reduce Railway costs** from $15/month to ~$2-3/month
- **Simplify the architecture** (single application)
- **Improve data persistence**
- **Integrate attachment storage** directly

## 💰 Expected Savings

| Component | Before (Redis) | After (SQLite) | Savings |
|-----------|----------------|----------------|---------|
| Application | ~$3/month | ~$2-3/month | $0 |
| Redis Service | ~$10-12/month | $0 | -$12/month |
| Storage | External | Included Railway | Variable |
| **Total** | **~$15/month** | **~$2-3/month** | **~80% savings** |

## 🏗️ Architecture

### Before (Redis)
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Application │───▶│ Redis Cache │───▶│   Airtable  │
│   (Bun)     │    │  External   │    │    API      │
└─────────────┘    └─────────────┘    └─────────────┘
      │                                      │
      ▼                                      ▼
┌─────────────┐                    ┌─────────────┐
│ Attachments │                    │  Periodic   │
│  External   │                    │   Refresh   │
└─────────────┘                    └─────────────┘
```

### After (SQLite)
```
┌─────────────────────────────────┐    ┌─────────────┐
│          Application            │───▶│   Airtable  │
│  ┌─────────────┐ ┌─────────────┐│    │    API      │
│  │    API      │ │   SQLite    ││    └─────────────┘
│  │   Server    │ │   Cache     ││            │
│  └─────────────┘ └─────────────┘│            ▼
│  ┌─────────────┐ ┌─────────────┐│    ┌─────────────┐
│  │ Attachments │ │   Worker    ││    │   Daily     │
│  │   Storage   │ │  Refresh    ││    │  Refresh    │
│  └─────────────┘ └─────────────┘│    └─────────────┘
└─────────────────────────────────┘
```

## 📋 Step-by-step Migration

### 1. Preparation

```bash
# Backup current environment
cp .env .env.redis.backup

# Update configuration
cp .env.example .env
# Edit .env with SQLITE_PATH and STORAGE_PATH
```

### 2. Local Testing

```bash
# Start in SQLite mode
bun run start:sqlite

# OR in development
bun run dev:sqlite

# Verify endpoints
curl http://localhost:3000/health
curl -H "Authorization: Bearer $BEARER_TOKEN" http://localhost:3000/api/tables
```

### 3. Comparative Benchmark

```bash
# Compare performance
bun run benchmark:sqlite

# Expected results:
# - SQLite faster locally (no network latency)
# - More robust transactions
# - Automatic persistent storage
```

### 4. Railway Deployment

#### Option A: New project
```bash
# Create a new Railway project
railway login
railway init
railway up
```

#### Option B: Existing project migration
```bash
# Remove Redis service
# In Railway dashboard: Remove Redis service

# Deploy new version
git add .
git commit -m "Migration to SQLite - cost reduction"
git push origin main
```

### 5. Railway Configuration

```toml
# railway.toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "bun run start:sqlite"

[environments.production.variables]
SQLITE_V1_PATH = "/app/data/aircache-v1.sqlite"
SQLITE_V2_PATH = "/app/data/aircache-v2.sqlite"
SQLITE_METADATA_PATH = "/app/data/metadata.sqlite"
STORAGE_PATH = "/app/storage/attachments"
REFRESH_INTERVAL = "86400"
```

## 🔄 Migration Scripts

### package.json Scripts
```json
{
  "scripts": {
    "start:sqlite": "bun sqlite-index.ts",
    "dev:sqlite": "bun --hot sqlite-index.ts",
    "start:redis": "bun index.ts",
    "benchmark:sqlite": "bun tests/sqlite-vs-redis.benchmark.ts"
  }
}
```

### SQLite Environment Variables
```env
# SQLite configuration
SQLITE_V1_PATH=data/aircache-v1.sqlite
SQLITE_V2_PATH=data/aircache-v2.sqlite
SQLITE_METADATA_PATH=data/metadata.sqlite
CACHE_TTL=86400
REFRESH_INTERVAL=86400
STORAGE_PATH=./storage/attachments

# Legacy Redis (keep for rollback)
# REDIS_URL=redis://...
```

## 🆚 Feature Comparison

| Feature | Redis | SQLite | Advantage |
|---------|--------|--------|-----------|
| **Read Performance** | Very fast | Fast | Redis |
| **Write Performance** | Fast | Very fast | SQLite |
| **Transactions** | Limited | ACID | SQLite |
| **Persistence** | Configurable | Native | SQLite |
| **Latency** | Network | Local | SQLite |
| **Complexity** | External service | Embedded | SQLite |
| **Cost** | ~$12/month | $0 | SQLite |
| **Backup** | Manual | Automatic | SQLite |

## 📊 New Endpoints

### SQLite API (full compatibility)
```
GET  /health                    - Health check
GET  /api/tables               - List tables
GET  /api/tables/:table        - Records from a table
GET  /api/tables/:table/:id    - Specific record
GET  /api/stats                - Statistics
POST /api/refresh              - Manual refresh
GET  /api/attachments/:id      - Attached files ✨ NEW
```

### Attachment Management
```bash
# Attachments are automatically:
# - Detected in Airtable data
# - Downloaded during refresh
# - Stored locally in /storage/attachments
# - Served via /api/attachments/:id
```

## 🚀 Migration Benefits

### ✅ Technical
- **Guaranteed persistence**: No data loss on restart
- **ACID transactions**: Data integrity
- **Integrated attachments**: No need for external service
- **Local performance**: No network latency
- **Simple backup**: Single SQLite file

### ✅ Economic
- **-80% cost reduction** on Railway
- **Simplified architecture**: Fewer components to maintain
- **Predictable scaling**: Costs tied only to traffic

### ✅ Operational
- **Simplified deployment**: Single application
- **Easier debugging**: Everything in one process
- **Unified monitoring**: Only one application to monitor

## ⚠️ Considerations

### SQLite Limitations
- **Concurrent writes**: SQLite handles concurrent reads but serializes writes
- **DB size**: Suitable up to several GB (more than sufficient for Airtable)
- **Network**: Optimal performance in local only

### Migration Risks
- **Downtime**: ~5-10 minutes during Railway migration
- **In-flight data**: Redis cache data will be lost (automatically reloaded)
- **Rollback**: Plan for rollback if necessary

## 🔙 Rollback Procedure

If issues with SQLite:

```bash
# 1. Restore old configuration
cp .env.redis.backup .env

# 2. Redeploy Redis version
git revert HEAD
git push origin main

# 3. Recreate Redis service on Railway
# Via Railway dashboard: Add Redis service
```

## 📈 Post-migration Monitoring

### Metrics to Monitor
- **API response time**: Should be ≤ Redis
- **SQLite DB size**: Normal growth
- **Disk space**: Attachment storage
- **Refresh duration**: Airtable sync time

### Health Checks
```bash
# Check SQLite health
curl http://localhost:3000/health

# Detailed stats
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/stats
```

## ✅ Migration Checklist

- [ ] Backup current environment
- [ ] SQLite local tests successful
- [ ] SQLite vs Redis benchmark validated
- [ ] Railway configuration updated
- [ ] Environment variables configured
- [ ] SQLite deployment successful
- [ ] Post-deployment API tests
- [ ] Redis service removal
- [ ] 24h monitoring without issues
- [ ] Team documentation updated

---

**🎯 Expected Result**: Simplified architecture, 80% cost reduction, equivalent or better performance, and integrated attachment storage.