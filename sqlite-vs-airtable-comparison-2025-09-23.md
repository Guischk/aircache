# SQLite vs Airtable Performance Benchmark

**Date:** 9/23/2025
**Tables tested:** 19
**Scenarios:** 4

## 🎯 Executive Summary

- **Average performance:** SQLite is 3.0x faster than Airtable
- **Latency reduction:** 64.8% on average
- **Reliability:** 0 failures on 1615 SQLite queries

## 📊 Detailed Results

| Table | Scenario | SQLite (ms) | Airtable (ms) | Factor | Reduction |
|-------|----------|-------------|---------------|---------|----------|
| table_A | single_record | 94.8 | 282.8 | 3.0x | 66.5% |
| table_A | small_batch | 110.9 | 275.5 | 2.5x | 59.8% |
| table_A | medium_batch | 88.7 | 281.3 | 3.2x | 68.5% |
| table_A | table_scan | 80.3 | 270.6 | 3.4x | 70.3% |
| table_B | single_record | 86.9 | 264.8 | 3.0x | 67.2% |
| table_B | small_batch | 93.1 | 274.2 | 2.9x | 66.1% |
| table_B | medium_batch | 97.0 | 283.1 | 2.9x | 65.7% |
| table_B | table_scan | 104.5 | 293.2 | 2.8x | 64.4% |
| table_C | single_record | 97.9 | 281.5 | 2.9x | 65.2% |
| table_C | small_batch | 109.3 | 442.4 | 4.0x | 75.3% |
| table_C | medium_batch | 161.3 | 815.4 | 5.1x | 80.2% |
| table_C | table_scan | 727.0 | 8259.5 | 11.4x | 91.2% |
| table_D | single_record | 98.0 | 263.4 | 2.7x | 62.8% |
| table_D | small_batch | 125.6 | 266.9 | 2.1x | 52.9% |
| table_D | medium_batch | 94.9 | 340.3 | 3.6x | 72.1% |
| table_D | table_scan | 126.4 | 295.5 | 2.3x | 57.2% |
| table_E | single_record | 118.5 | 312.9 | 2.6x | 62.1% |
| table_E | small_batch | 133.3 | 297.5 | 2.2x | 55.2% |
| table_E | medium_batch | 182.1 | 310.9 | 1.7x | 41.4% |
| table_E | table_scan | 116.8 | 351.8 | 3.0x | 66.8% |
| table_F | single_record | 114.3 | 273.7 | 2.4x | 58.2% |
| table_F | small_batch | 91.2 | 263.8 | 2.9x | 65.4% |
| table_F | medium_batch | 103.3 | 265.9 | 2.6x | 61.2% |
| table_F | table_scan | 77.8 | 254.9 | 3.3x | 69.5% |
| table_G | single_record | 83.8 | 268.0 | 3.2x | 68.7% |
| table_G | small_batch | 91.3 | 283.1 | 3.1x | 67.8% |
| table_G | medium_batch | 90.9 | 267.5 | 2.9x | 66.0% |
| table_G | table_scan | 87.6 | 275.7 | 3.1x | 68.2% |
| table_H | single_record | 94.8 | 272.1 | 2.9x | 65.1% |
| table_H | small_batch | 107.3 | 271.6 | 2.5x | 60.5% |
| table_H | medium_batch | 102.6 | 256.5 | 2.5x | 60.0% |
| table_H | table_scan | 92.4 | 263.4 | 2.9x | 64.9% |
| table_I | single_record | 87.6 | 264.9 | 3.0x | 66.9% |
| table_I | small_batch | 113.1 | 282.1 | 2.5x | 59.9% |
| table_I | medium_batch | 114.7 | 449.0 | 3.9x | 74.5% |
| table_I | table_scan | 124.6 | 377.9 | 3.0x | 67.0% |
| table_J | single_record | 85.1 | 269.0 | 3.2x | 68.4% |
| table_J | small_batch | 149.6 | 279.6 | 1.9x | 46.5% |
| table_J | medium_batch | 142.6 | 559.8 | 3.9x | 74.5% |
| table_J | table_scan | 95.5 | 463.2 | 4.9x | 79.4% |
| table_K | single_record | 85.2 | 253.3 | 3.0x | 66.4% |
| table_K | small_batch | 89.3 | 245.9 | 2.8x | 63.7% |
| table_K | medium_batch | 88.4 | 262.7 | 3.0x | 66.3% |
| table_K | table_scan | 95.7 | 233.9 | 2.4x | 59.1% |
| table_L | single_record | 90.8 | 259.1 | 2.9x | 65.0% |
| table_L | small_batch | 103.3 | 251.8 | 2.4x | 59.0% |
| table_L | medium_batch | 119.7 | 256.8 | 2.1x | 53.4% |
| table_L | table_scan | 76.3 | 268.1 | 3.5x | 71.5% |
| table_M | single_record | 85.9 | 270.3 | 3.1x | 68.2% |
| table_M | small_batch | 101.2 | 257.7 | 2.5x | 60.7% |
| table_M | medium_batch | 72.7 | 255.7 | 3.5x | 71.6% |
| table_M | table_scan | 75.2 | 269.0 | 3.6x | 72.0% |
| table_N | single_record | 92.6 | 269.3 | 2.9x | 65.6% |
| table_N | small_batch | 90.1 | 268.7 | 3.0x | 66.5% |
| table_N | medium_batch | 109.9 | 267.2 | 2.4x | 58.8% |
| table_N | table_scan | 100.4 | 256.4 | 2.6x | 60.8% |
| table_O | single_record | 93.2 | 267.2 | 2.9x | 65.1% |
| table_O | small_batch | 123.9 | 255.4 | 2.1x | 51.5% |
| table_O | medium_batch | 91.9 | 255.0 | 2.8x | 63.9% |
| table_O | table_scan | 87.7 | 257.2 | 2.9x | 65.9% |
| table_P | single_record | 86.9 | 268.3 | 3.1x | 67.6% |
| table_P | small_batch | 94.7 | 257.2 | 2.7x | 63.2% |
| table_P | medium_batch | 83.7 | 244.9 | 2.9x | 65.8% |
| table_P | table_scan | 89.6 | 235.3 | 2.6x | 61.9% |
| table_Q | single_record | 93.4 | 284.9 | 3.1x | 67.2% |
| table_Q | small_batch | 107.3 | 249.9 | 2.3x | 57.1% |
| table_Q | medium_batch | 83.1 | 260.1 | 3.1x | 68.0% |
| table_Q | table_scan | 79.9 | 245.1 | 3.1x | 67.4% |
| table_R | single_record | 86.4 | 238.3 | 2.8x | 63.7% |
| table_R | small_batch | 102.8 | 281.1 | 2.7x | 63.4% |
| table_R | medium_batch | 146.0 | 237.9 | 1.6x | 38.6% |
| table_R | table_scan | 83.5 | 256.5 | 3.1x | 67.4% |
| table_S | single_record | 88.1 | 253.7 | 2.9x | 65.3% |
| table_S | small_batch | 83.6 | 257.4 | 3.1x | 67.5% |
| table_S | medium_batch | 74.3 | 262.1 | 3.5x | 71.7% |
| table_S | table_scan | 79.4 | 244.6 | 3.1x | 67.5% |

## 💰 Business Impact

### Avoided Airtable costs
- **Rate limits:** 5 requests/second maximum
- **Quotas:** Limits per pricing plan
- **Network latency:** 100-500ms per request

### SQLite benefits
- **Performance:** 3.0x faster
- **Availability:** 100% (no external dependency)
- **Scalability:** Unlimited locally
- **Simplicity:** Unified architecture

