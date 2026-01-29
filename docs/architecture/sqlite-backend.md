# SQLite Backend

Airboost uses SQLite as its caching backend, providing a simple, performant, and cost-effective solution.

## Why SQLite?

| Feature | SQLite | Alternative (Redis) |
|---------|--------|---------------------|
| **Performance** | ~1ms queries | ~5-10ms (network) |
| **Cost** | Free (embedded) | $10-15/month |
| **Persistence** | Native | Configurable |
| **Transactions** | Full ACID | Limited |
| **Latency** | Local disk | Network hop |
| **Complexity** | Embedded | External service |
| **Backup** | Single file | Manual setup |

## Database Structure

### Dual Database System

Airboost maintains two SQLite databases:

```
data/
├── airboost-v1.sqlite    # Database version 1
├── airboost-v2.sqlite    # Database version 2
└── metadata.sqlite       # System metadata
```

At any time, one is **active** (serving requests) and one is **inactive** (receiving updates).

### Database Schema

Each cache database contains:

```sql
-- Table: records
-- Stores all Airtable records
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  data TEXT NOT NULL,           -- JSON string of fields
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_records_table ON records(table_name);

-- Table: attachments
-- Stores attachment metadata
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_url TEXT NOT NULL,
  local_path TEXT,
  filename TEXT NOT NULL,
  size INTEGER,
  mime_type TEXT,
  downloaded_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attachments_record ON attachments(record_id);
CREATE INDEX idx_attachments_url ON attachments(original_url);
```

### Metadata Database

```sql
-- Table: metadata
-- Stores system state
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Key entries:
-- 'active_version' -> '1' or '2'
-- 'last_refresh' -> ISO timestamp
-- 'webhook_id' -> Airtable webhook ID
-- 'webhook_secret' -> HMAC secret (base64)
```

## Operations

### Reading Data

```typescript
// Get all records from a table
const records = sqliteService.getRecords("users");

// Get a single record
const record = sqliteService.getRecord("users", "recXXXXXX");

// Get table list
const tables = sqliteService.getTables();
```

### Writing Data (During Refresh)

```typescript
// Write to inactive database
sqliteService.setRecordsBatch("users", records, true);

// After sync complete, switch active database
sqliteService.switchActiveDatabase();
```

### Atomic Switch

```typescript
// In metadata.sqlite
UPDATE metadata SET value = '2' WHERE key = 'active_version';

// All subsequent reads use v2 database
```

## Performance Characteristics

### Query Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Single record by ID | <1ms | Primary key lookup |
| Table scan (100 records) | 1-3ms | Index scan |
| Table scan (1000 records) | 5-15ms | Full table |
| List tables | <1ms | Metadata query |

### Write Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Insert single record | <1ms | Prepared statement |
| Insert batch (50) | 5-10ms | Single transaction |
| Full table refresh | 100ms-5s | Depends on size |

### Storage

- **Typical size**: 1-10MB per 1000 records
- **With attachments**: Varies by file sizes
- **Compression**: Not enabled (fast access priority)

## Configuration

### Database Paths

```bash
SQLITE_V1_PATH=data/airboost-v1.sqlite
SQLITE_V2_PATH=data/airboost-v2.sqlite
SQLITE_METADATA_PATH=data/metadata.sqlite
```

### Storage Path

```bash
STORAGE_PATH=./data/attachments
```

## Maintenance

### Database Health Check

```bash
# Check database integrity
sqlite3 data/airboost-v1.sqlite "PRAGMA integrity_check"

# Check database size
ls -lh data/*.sqlite
```

### Optimization

```bash
# Vacuum database (reclaim space)
sqlite3 data/airboost-v1.sqlite "VACUUM"

# Update statistics
sqlite3 data/airboost-v1.sqlite "ANALYZE"
```

### Backup

```bash
# Simple file copy (when service is stopped)
cp data/airboost-v1.sqlite backup/

# Hot backup (with service running)
sqlite3 data/airboost-v1.sqlite ".backup backup/airboost.sqlite"
```

## Troubleshooting

### Database Locked

```
Error: SQLITE_BUSY: database is locked
```

**Cause**: Concurrent write operations
**Solution**: Airboost handles this with retry logic; if persistent, restart the service

### Database Corrupted

```
Error: database disk image is malformed
```

**Solution**:
1. Stop the service
2. Delete corrupted database
3. Restart (will rebuild from Airtable)

```bash
rm data/airboost-v1.sqlite
bun run start
```

### Out of Disk Space

**Prevention**:
- Monitor disk usage
- Set up alerts at 80% capacity
- Consider limiting attachment downloads

```bash
ENABLE_ATTACHMENT_DOWNLOAD=false
```

## Best Practices

1. **Use SSD storage** for best performance
2. **Monitor database size** growth over time
3. **Regular backups** of metadata.sqlite (contains webhook config)
4. **Don't modify databases** directly while service is running
5. **Use WAL mode** (enabled by default) for concurrent access
