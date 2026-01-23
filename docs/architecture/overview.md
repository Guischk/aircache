# Architecture Overview

## System Overview

Aircache is a high-performance caching layer that syncs data from Airtable to local SQLite databases. It uses a dual-database strategy for zero-downtime updates and provides a REST API that's **240x faster** than direct Airtable API calls.

```
                                    ┌─────────────────────────────────┐
                                    │          Aircache               │
┌─────────────┐                     │  ┌─────────────────────────┐   │
│   Client    │ ───── REST API ──── │  │       Hono Server       │   │
│ Application │                     │  └───────────┬─────────────┘   │
└─────────────┘                     │              │                  │
                                    │  ┌───────────┴─────────────┐   │
                                    │  │    SQLite Databases     │   │
                                    │  │   ┌─────┐    ┌─────┐    │   │
                                    │  │   │ v1  │◄──►│ v2  │    │   │
                                    │  │   └─────┘    └─────┘    │   │
                                    │  └─────────────────────────┘   │
                                    │              ▲                  │
┌─────────────┐                     │              │                  │
│  Airtable   │ ◄─── Sync Worker ── │  ┌──────────┴──────────┐      │
│    API      │                     │  │   Background Worker   │      │
└─────────────┘                     │  └─────────────────────┘      │
                                    └─────────────────────────────────┘
```

## Core Components

### 1. HTTP Server (`src/server/index.ts`)

- Built with [Hono](https://hono.dev) framework on Bun.serve()
- Handles all API requests
- Bearer token authentication
- CORS support for cross-origin access

### 2. SQLite Service (`src/lib/sqlite/index.ts`)

- Manages dual SQLite databases
- Handles read/write operations
- Provides atomic database switching
- Stores attachments metadata

### 3. Background Worker (`src/worker/index.ts`)

- Runs data sync in background
- Fetches data from Airtable API
- Downloads attachments
- Manages refresh scheduling

### 4. Airtable Client (`src/lib/airtable/index.ts`)

- Configured Airtable base connection
- Handles API authentication
- Rate limiting compliance
- Type-safe data access via Zod schemas

## Dual-Database Strategy

The key innovation in Aircache is the dual-database strategy that enables zero-downtime updates.

### How It Works

```
┌─────────────┐    ┌─────────────┐
│   Active    │    │  Inactive   │
│ Database v1 │    │ Database v2 │
│             │    │             │
│  Serves     │    │   Being     │
│  Current    │    │  Updated    │
│  Requests   │    │  with Fresh │
│             │    │    Data     │
└─────────────┘    └─────────────┘
       │                  │
       └────────┬─────────┘
                │
         Atomic Switch
                │
                ▼
┌─────────────┐    ┌─────────────┐
│  Inactive   │    │   Active    │
│ Database v1 │    │ Database v2 │
│             │    │             │
│  Ready for  │    │   Serves    │
│  Next Sync  │    │   Fresh     │
│             │    │    Data     │
└─────────────┘    └─────────────┘
```

### Benefits

1. **Zero Downtime** - API never returns stale or partial data
2. **Atomic Updates** - Database pointer switches instantly
3. **Consistency** - All requests see the same data version
4. **Rollback Ready** - Previous database available if needed

## Sync Modes

### Polling Mode

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Timer     │───▶│   Worker    │───▶│  Airtable   │
│  Interval   │    │             │    │    API      │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   Update    │
                   │  Inactive   │
                   │    DB       │
                   └─────────────┘
```

- Full refresh at configured interval
- Default: every 24 hours
- Simple and reliable

### Webhook Mode

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Airtable   │───▶│  Webhook    │───▶│   Worker    │
│  Webhook    │    │  Handler    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ Incremental │
                   │   Update    │
                   └─────────────┘
```

- Real-time updates (~500ms latency)
- HMAC signature validation
- Automatic webhook setup
- Failsafe full refresh

### Manual Mode

- No automatic sync
- Trigger via `POST /api/refresh`
- Full control over timing

## Data Flow

### Initial Startup

1. Server starts and initializes SQLite databases
2. Worker begins initial sync
3. All tables fetched from Airtable
4. Data stored in inactive database
5. Attachments downloaded (if enabled)
6. Database pointer switched to make data active
7. API ready to serve requests

### Ongoing Sync (Polling)

1. Timer triggers at configured interval
2. Worker acquires lock (prevents concurrent syncs)
3. Fresh data fetched from Airtable
4. Inactive database cleared and populated
5. Attachments updated (smart deduplication)
6. Atomic switch to new data
7. Old database prepared for next cycle

### Webhook Sync

1. Airtable sends webhook notification
2. HMAC signature validated
3. Rate limiting applied
4. Changed records identified
5. Incremental update applied
6. Failsafe timer reset

## API Architecture

### Route Structure

```
/
├── /health                          # Public health check
├── /webhooks/airtable/refresh       # Webhook endpoint (HMAC auth)
└── /api/                            # Bearer token protected
    ├── /tables                      # List tables
    ├── /tables/:table               # Get records
    ├── /tables/:table/:id           # Get single record
    ├── /stats                       # Cache statistics
    ├── /refresh                     # Trigger refresh
    ├── /attachments/...             # Serve attachments
    ├── /mappings                    # Field mappings
    └── /types                       # TypeScript types
```

### Middleware Stack

1. **Logger** - Request logging
2. **CORS** - Cross-origin support
3. **Bearer Auth** - Token validation (except /health)
4. **Route Handlers** - Business logic

## Performance Optimizations

### Database

- **Batch Processing** - Records inserted in chunks of 50
- **Prepared Statements** - Reused within transactions
- **Strategic Indexes** - On frequently queried fields
- **WAL Mode** - For concurrent read/write

### Attachments

- **Deterministic Naming** - URL hash prevents duplicates
- **Existence Checks** - Skip already downloaded files
- **Size Validation** - Re-download if size mismatch
- **Connection Pool** - Limit concurrent downloads (5 max)

### API

- **Response Caching** - Static responses cached
- **Efficient Queries** - Optimized SQL generation
- **Minimal Overhead** - Hono's lightweight design

## Security Model

### Authentication

- Bearer token required for `/api/*` endpoints
- HMAC-SHA256 for webhook validation
- No auth required for `/health`

### Data Protection

- Sensitive files git-ignored
- No secrets in logs
- Environment variable configuration

### Network

- HTTPS recommended in production
- CORS configurable
- Rate limiting via webhooks

## Scalability

### Horizontal

- Multiple instances share file storage
- File-based locking prevents conflicts
- Stateless API design

### Vertical

- Memory scales with dataset size
- CPU optimized via batch processing
- SSD recommended for large datasets

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh) |
| Database | SQLite via `bun:sqlite` |
| Web Framework | [Hono](https://hono.dev) |
| Validation | [Zod](https://zod.dev) |
| Airtable Client | [airtable](https://npmjs.com/package/airtable) |
| Type Generation | [airtable-types-gen](https://npmjs.com/package/airtable-types-gen) |
