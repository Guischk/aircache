# 🔍 Webhook Implementation Validation

Analysis of Aircache webhook implementation against Airtable's official webhook specification.

## ✅ What's Correct

1. **HMAC SHA-256 Validation** - Using correct algorithm
2. **Timing-Safe Comparison** - Prevents timing attacks
3. **Timestamp Validation** - Prevents replay attacks
4. **Rate Limiting** - Prevents abuse
5. **Idempotency** - Prevents duplicate processing
6. **Async Refresh** - Non-blocking webhook responses

## ⚠️ Issues Found

### 🔴 CRITICAL: Payload Structure Mismatch

**Issue:** Airtable webhook notifications use a nested structure with `payloads` array, not a flat structure.

**Actual Airtable Format:**
```json
{
  "timestamp": "2021-01-01T00:00:00.000Z",
  "baseTransactionNumber": 123,
  "webhookId": "achwXYZ123",
  "payloads": [
    {
      "baseTransactionNumber": 123,
      "timestamp": "2021-01-01T00:00:00.000Z",
      "changedTablesById": {
        "tblXXX": {
          "createdRecordsById": { "recAAA": null },
          "changedRecordsById": { "recBBB": null },
          "destroyedRecordIds": ["recCCC"]
        }
      }
    }
  ]
}
```

**Our Current Structure:**
```typescript
interface AirtableWebhookPayload {
  baseTransactionNumber?: number;
  timestamp: string;
  webhookId?: string;
  changedTablesById?: { ... }  // ❌ Wrong - should be inside payloads array
}
```

**Impact:** Medium - Our implementation might work with test webhooks but will fail with real Airtable webhooks.

**Fix Required:** Update interface to match actual structure, iterate through `payloads` array.

---

### 🟡 MEDIUM: HMAC Header Name

**Issue:** Documentation is unclear whether Airtable uses `X-Airtable-Content-MAC` or `X-Airtable-Content-HMAC`.

**Current Implementation:** `X-Airtable-Content-MAC`

**Recommendation:** 
- Keep current implementation (MAC is correct per some docs)
- Add logging to capture actual header name from real webhooks
- Support both header names for compatibility

---

### 🟡 MEDIUM: Secret Format Confusion

**Issue:** Airtable provides `macSecretBase64` in webhook creation response, but our docs suggest using hex-encoded secrets.

**Current:** We generate secrets with `openssl rand -hex 32` (hex format)

**Airtable Provides:** Base64-encoded secret in `macSecretBase64` field

**Impact:** Setup confusion - users might not know which format to use.

**Recommendation:**
- Support both hex and base64 secret formats
- Detect format automatically (base64 contains `/+=`, hex only has 0-9a-f)
- Update documentation to clarify Airtable's `macSecretBase64` should be decoded

---

### 🟢 LOW: Duplicate Timing-Safe Comparison

**Issue:** Lines 71-74 in `webhook-auth.ts` duplicate the comparison already done in lines 60-64.

```typescript
// Lines 60-64: Manual timing-safe comparison
if (!isEqual) { ... }

// Lines 71-74: Duplicate using crypto.timingSafeEqual (will fail anyway)
if (!crypto.timingSafeEqual(providedBuffer, computedBuffer)) { ... }
```

**Impact:** Low - Redundant code, won't break functionality

**Fix:** Remove lines 71-74

---

### 🟢 LOW: Incomplete Incremental Refresh

**Issue:** `resolveTableNameFromId()` returns null, causing all incremental refreshes to fallback to full refresh.

**Impact:** Low - Functionality works but loses performance benefit until Phase 2 (Mapping Table) is implemented.

**Status:** Expected - documented as Phase 2 work

---

## 🎯 Recommended Fixes (Priority Order)

### 1. **HIGH PRIORITY: Update Payload Structure**

```typescript
interface AirtableWebhookNotification {
  timestamp: string;
  baseTransactionNumber?: number;
  webhookId?: string;
  payloads?: Array<{
    baseTransactionNumber: number;
    timestamp: string;
    changedTablesById?: {
      [tableId: string]: {
        createdRecordsById?: { [recordId: string]: null };
        changedRecordsById?: { [recordId: string]: null };
        destroyedRecordIds?: string[];
      };
    };
  }>;
}
```

Update handler to iterate through `payloads` array:
```typescript
const changedTables = payload.payloads?.[0]?.changedTablesById;
```

### 2. **MEDIUM PRIORITY: Support Base64 Secrets**

Add automatic secret format detection:
```typescript
function decodeWebhookSecret(secret: string): string {
  // If looks like base64, decode it
  if (/[+/=]/.test(secret) || secret.length % 4 === 0) {
    try {
      return Buffer.from(secret, 'base64').toString('utf-8');
    } catch {
      return secret; // Not base64, use as-is
    }
  }
  return secret; // Hex or plain string
}
```

### 3. **LOW PRIORITY: Remove Duplicate Code**

Remove lines 71-74 from `webhook-auth.ts`.

---

## 🧪 Testing Recommendations

### Before Production:
1. ✅ Test with actual Airtable webhook (not just curl simulation)
2. ✅ Verify header name sent by Airtable (`X-Airtable-Content-MAC` vs `X-Airtable-Content-HMAC`)
3. ✅ Test with real `macSecretBase64` from Airtable webhook creation response
4. ✅ Verify `payloads` array structure with real webhook notification
5. ✅ Test multiple payloads in single notification (if Airtable batches)

### Test Checklist:
- [ ] Create real Airtable webhook pointing to test endpoint
- [ ] Trigger webhook by modifying Airtable record
- [ ] Capture raw webhook payload in logs
- [ ] Verify signature validation works with real secret
- [ ] Confirm incremental refresh processes correctly
- [ ] Test rate limiting with rapid Airtable changes

---

## 📚 References

- [Airtable Webhooks API Docs](https://airtable.com/developers/web/api/webhooks-overview)
- [Airtable Webhook Notification Model](https://airtable.com/developers/web/api/model/webhooks-notification)
- [HMAC Authentication Spec](https://en.wikipedia.org/wiki/HMAC)

---

## ✅ Validation Status

- **Security:** ✅ Strong (HMAC + timing-safe + timestamp + rate limit)
- **Payload Structure:** ⚠️ Needs update for `payloads` array
- **Secret Handling:** ⚠️ Base64 support needed
- **Production Ready:** ⚠️ After fixing payload structure (30 min work)
