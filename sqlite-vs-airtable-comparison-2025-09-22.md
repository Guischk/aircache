# SQLite vs Airtable Performance Benchmark

**Date:** 9/22/2025
**Tables tested:** 19
**Scenarios:** 4

## 🎯 Executive Summary

- **Average performance:** SQLite is 3.2x faster than Airtable
- **Latency reduction:** 63.6% on average
- **Reliability:** 0 failures on 1615 SQLite queries

## 📊 Detailed Results

| Table | Scenario | SQLite (ms) | Airtable (ms) | Factor | Reduction |
|-------|----------|-------------|---------------|---------|----------|
| table_A | single_record | 108.2 | 276.2 | 2.6x | 60.8% |
| table_A | small_batch | 103.0 | 276.6 | 2.7x | 62.8% |
| table_A | medium_batch | 110.7 | 274.4 | 2.5x | 59.6% |
| table_A | table_scan | 107.1 | 267.4 | 2.5x | 59.9% |
| table_B | single_record | 100.6 | 249.1 | 2.5x | 59.6% |
| table_B | small_batch | 86.7 | 258.9 | 3.0x | 66.5% |
| table_B | medium_batch | 98.5 | 255.2 | 2.6x | 61.4% |
| table_B | table_scan | 91.0 | 245.9 | 2.7x | 63.0% |
| table_C | single_record | 92.8 | 278.3 | 3.0x | 66.6% |
| table_C | small_batch | 107.3 | 312.1 | 2.9x | 65.6% |
| table_C | medium_batch | 107.6 | 377.8 | 3.5x | 71.5% |
| table_C | table_scan | 110.6 | 4023.0 | 36.4x | 97.3% |
| table_D | single_record | 104.5 | 250.2 | 2.4x | 58.2% |
| table_D | small_batch | 86.0 | 248.3 | 2.9x | 65.4% |
| table_D | medium_batch | 95.7 | 258.3 | 2.7x | 63.0% |
| table_D | table_scan | 92.0 | 243.4 | 2.6x | 62.2% |
| table_E | single_record | 95.5 | 254.0 | 2.7x | 62.4% |
| table_E | small_batch | 92.7 | 270.9 | 2.9x | 65.8% |
| table_E | medium_batch | 97.7 | 277.7 | 2.8x | 64.8% |
| table_E | table_scan | 96.4 | 286.8 | 3.0x | 66.4% |
| table_F | single_record | 97.1 | 269.5 | 2.8x | 64.0% |
| table_F | small_batch | 125.3 | 286.0 | 2.3x | 56.2% |
| table_F | medium_batch | 102.0 | 267.9 | 2.6x | 61.9% |
| table_F | table_scan | 102.1 | 276.1 | 2.7x | 63.0% |
| table_G | single_record | 98.9 | 260.8 | 2.6x | 62.1% |
| table_G | small_batch | 95.5 | 256.8 | 2.7x | 62.8% |
| table_G | medium_batch | 96.6 | 280.3 | 2.9x | 65.5% |
| table_G | table_scan | 145.9 | 315.9 | 2.2x | 53.8% |
| table_H | single_record | 150.2 | 282.6 | 1.9x | 46.8% |
| table_H | small_batch | 116.6 | 277.9 | 2.4x | 58.0% |
| table_H | medium_batch | 96.2 | 256.1 | 2.7x | 62.4% |
| table_H | table_scan | 99.9 | 273.8 | 2.7x | 63.5% |
| table_I | single_record | 91.6 | 261.9 | 2.9x | 65.0% |
| table_I | small_batch | 102.1 | 277.8 | 2.7x | 63.3% |
| table_I | medium_batch | 99.3 | 280.9 | 2.8x | 64.7% |
| table_I | table_scan | 98.4 | 268.6 | 2.7x | 63.4% |
| table_J | single_record | 92.7 | 248.0 | 2.7x | 62.6% |
| table_J | small_batch | 90.9 | 255.2 | 2.8x | 64.4% |
| table_J | medium_batch | 90.1 | 291.9 | 3.2x | 69.1% |
| table_J | table_scan | 90.4 | 313.5 | 3.5x | 71.2% |
| table_K | single_record | 101.3 | 257.6 | 2.5x | 60.7% |
| table_K | small_batch | 85.7 | 247.5 | 2.9x | 65.4% |
| table_K | medium_batch | 86.6 | 249.0 | 2.9x | 65.2% |
| table_K | table_scan | 89.4 | 266.5 | 3.0x | 66.4% |
| table_L | single_record | 93.6 | 259.9 | 2.8x | 64.0% |
| table_L | small_batch | 102.2 | 250.3 | 2.5x | 59.2% |
| table_L | medium_batch | 94.2 | 252.4 | 2.7x | 62.7% |
| table_L | table_scan | 94.8 | 250.0 | 2.6x | 62.1% |
| table_M | single_record | 91.9 | 237.2 | 2.6x | 61.3% |
| table_M | small_batch | 87.8 | 245.7 | 2.8x | 64.2% |
| table_M | medium_batch | 84.0 | 243.7 | 2.9x | 65.5% |
| table_M | table_scan | 85.6 | 241.7 | 2.8x | 64.6% |
| table_N | single_record | 87.8 | 241.9 | 2.8x | 63.7% |
| table_N | small_batch | 90.2 | 251.6 | 2.8x | 64.2% |
| table_N | medium_batch | 95.1 | 235.9 | 2.5x | 59.7% |
| table_N | table_scan | 92.1 | 263.7 | 2.9x | 65.1% |
| table_O | single_record | 97.1 | 252.9 | 2.6x | 61.6% |
| table_O | small_batch | 91.0 | 258.6 | 2.8x | 64.8% |
| table_O | medium_batch | 144.4 | 283.4 | 2.0x | 49.0% |
| table_O | table_scan | 93.6 | 254.6 | 2.7x | 63.3% |
| table_P | single_record | 85.7 | 251.7 | 2.9x | 66.0% |
| table_P | small_batch | 90.0 | 247.5 | 2.7x | 63.6% |
| table_P | medium_batch | 91.9 | 246.4 | 2.7x | 62.7% |
| table_P | table_scan | 80.9 | 242.0 | 3.0x | 66.6% |
| table_Q | single_record | 86.0 | 241.6 | 2.8x | 64.4% |
| table_Q | small_batch | 84.7 | 252.7 | 3.0x | 66.5% |
| table_Q | medium_batch | 86.4 | 303.0 | 3.5x | 71.5% |
| table_Q | table_scan | 89.8 | 252.2 | 2.8x | 64.4% |
| table_R | single_record | 99.6 | 247.0 | 2.5x | 59.7% |
| table_R | small_batch | 86.8 | 244.0 | 2.8x | 64.4% |
| table_R | medium_batch | 89.1 | 245.6 | 2.8x | 63.7% |
| table_R | table_scan | 96.7 | 252.9 | 2.6x | 61.8% |
| table_S | single_record | 95.9 | 257.5 | 2.7x | 62.8% |
| table_S | small_batch | 87.2 | 248.1 | 2.8x | 64.8% |
| table_S | medium_batch | 84.9 | 233.7 | 2.8x | 63.7% |
| table_S | table_scan | 87.7 | 246.2 | 2.8x | 64.4% |

## 💰 Business Impact

### Avoided Airtable costs
- **Rate limits:** 5 requests/second maximum
- **Quotas:** Limits per pricing plan
- **Network latency:** 100-500ms per request

### SQLite benefits
- **Performance:** 3.2x faster
- **Availability:** 100% (no external dependency)
- **Scalability:** Unlimited locally
- **Simplicity:** Unified architecture

