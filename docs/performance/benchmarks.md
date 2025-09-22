# Performance Benchmarks

## Overview

This document contains performance comparison data between SQLite cache and direct Airtable API access, along with benchmark methodology improvements.

## Latest Benchmark Results (September 22, 2025)

**Executive Summary:**
- **Average performance:** SQLite is 242.5x faster than Airtable
- **Latency reduction:** 99.4% on average
- **Reliability:** 0 failures on 1,615 SQLite queries
- **Tables tested:** 19
- **Scenarios:** 4

### Detailed Results

| Table   | Scenario      | SQLite (ms) | Airtable (ms) | Factor  | Reduction |
|---------|---------------|-------------|---------------|---------|-----------|
| table_A | single_record | 0.5         | 288.0         | 540.9x  | 99.8%     |
| table_A | small_batch   | 2.2         | 272.3         | 124.1x  | 99.2%     |
| table_A | medium_batch  | 2.3         | 302.0         | 129.2x  | 99.2%     |
| table_A | table_scan    | 1.1         | 296.1         | 277.9x  | 99.6%     |
| table_B | single_record | 1.2         | 275.4         | 238.3x  | 99.6%     |
| table_B | small_batch   | 1.9         | 258.4         | 139.3x  | 99.3%     |
| table_B | medium_batch  | 2.1         | 268.6         | 126.2x  | 99.2%     |
| table_B | table_scan    | 1.9         | 272.3         | 141.2x  | 99.3%     |
| table_C | single_record | 1.1         | 295.7         | 257.2x  | 99.6%     |
| table_C | small_batch   | 1.2         | 323.6         | 268.3x  | 99.6%     |
| table_C | medium_batch  | 1.1         | 972.2         | 895.3x  | 99.9%     |
| table_C | table_scan    | 2.8         | 7900.7        | 2776.0x | 100.0%    |

*[Results continue for tables D through S...]*

## Business Impact

### Avoided Airtable Costs
- **Rate limits:** 5 requests/second maximum
- **Quotas:** Limits per pricing plan
- **Network latency:** 100-500ms per request

### SQLite Benefits
- **Performance:** 242.5x faster on average
- **Availability:** 100% (no external dependency)
- **Scalability:** Unlimited locally
- **Simplicity:** Unified architecture

## Benchmark Methodology Improvements

### Problem Solved

The benchmark `sqlite-vs-airtable.benchmark.ts` had **inconsistent validation logic** that caused misleading results, particularly for the "single record" scenario.

### Issues Identified

**Before correction:**

| Scenario        | SQLite                               | Airtable                        | Success Criteria                    |
|-----------------|--------------------------------------|---------------------------------|-------------------------------------|
| `single_record` | ❌ Checks `data.records.length > 0` | ❌ Checks `records.length > 0` | **STRICT**: Data required           |
| `small_batch`   | ✅ Checks `response.ok`             | ✅ No verification              | **PERMISSIVE**: API success only    |
| `medium_batch`  | ✅ Checks `response.ok`             | ✅ No verification              | **PERMISSIVE**: API success only    |
| `table_scan`    | ✅ Checks `response.ok`             | ✅ No verification              | **PERMISSIVE**: API success only    |

**Consequence:** If a table was empty: `single_record` = 0% success, others = 100% success, resulting in artificial "Infinityx faster" metrics.

### Solution Implemented

**Unified Logic - Permissive Approach:**

| Scenario        | SQLite                   | Airtable            | Success Criteria          |
|-----------------|--------------------------|---------------------|---------------------------|
| `single_record` | ✅ Checks `response.ok` | ✅ No exception     | **PERMISSIVE**: API success |
| `small_batch`   | ✅ Checks `response.ok` | ✅ No exception     | **PERMISSIVE**: API success |
| `medium_batch`  | ✅ Checks `response.ok` | ✅ No exception     | **PERMISSIVE**: API success |
| `table_scan`    | ✅ Checks `response.ok` | ✅ No exception     | **PERMISSIVE**: API success |

### Code Changes

#### 1. Utility Method Added
```typescript
/**
 * Unified validation logic: All scenarios consider successful API calls as success,
 * regardless of whether data is returned. This ensures consistent performance measurement
 * across all scenarios, including cases with empty tables.
 */
private isValidResponse(response: Response): boolean {
  return response.ok;
}
```

#### 2. SQLite `single_record` Unified

**Before:**
```typescript
if (response.ok) {
  const data = (await response.json()) as { records?: any[] };
  if (data.records && data.records.length > 0) {
    responseTimes.push(performance.now() - requestStart);
  } else {
    errors++;
  }
}
```

**After:**
```typescript
if (this.isValidResponse(response)) {
  responseTimes.push(performance.now() - requestStart);
} else {
  errors++;
}
```

#### 3. Airtable `single_record` Unified

**Before:**
```typescript
const records = await base(tableName).select({ maxRecords: 1 }).firstPage();
if (records.length > 0) {
  responseTimes.push(performance.now() - requestStart);
} else {
  errors++;
}
```

**After:**
```typescript
await base(tableName).select({ maxRecords: 1 }).firstPage();
responseTimes.push(performance.now() - requestStart);
```

## Usage

Run benchmarks with:
```bash
bun tests/sqlite-vs-airtable.benchmark.ts
```

The unified benchmark now provides **reliable and consistent** metrics for:
- Evaluating real API performance
- Comparing SQLite cache vs direct Airtable access
- Measuring system optimization impact
- Identifying performance bottlenecks

**Note:** This approach measures system performance, not data richness. For specific business tests requiring data, dedicated benchmarks can be created separately.