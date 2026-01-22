# Webhook Troubleshooting Guide

## Error 422: "Invalid request: parameter validation failed"

This error occurs when calling Airtable's `enableNotifications` endpoint. Here's what's happening and how to fix it.

### What Airtable Does When Enabling Notifications

When you call `POST /bases/{baseId}/webhooks/{webhookId}/enableNotifications`, Airtable:

1. **Sends a test ping** to your webhook URL
2. **Waits for a valid response** (typically 200, 400, 401, or 403)
3. **Times out after a few seconds** if no response
4. **Returns 422 if the endpoint is unreachable** or doesn't respond correctly

### Common Causes on Railway (but not local)

| Issue | Why it happens on Railway | How to diagnose |
|-------|--------------------------|-----------------|
| **Cold start timing** | Railway may take longer to start the server | Check logs for timing between "Server started" and webhook setup |
| **Incorrect WEBHOOK_PUBLIC_URL** | URL doesn't match actual Railway URL | Verify `WEBHOOK_PUBLIC_URL` matches your Railway domain |
| **SSL certificate issues** | Railway URL not using valid HTTPS | Ensure your Railway app is using HTTPS (it should by default) |
| **Server not fully ready** | Routes registered after webhook setup starts | Check that app initialization completes before webhook setup |
| **Network/firewall** | Railway's outbound IP might be different | Unlikely but possible if you have IP restrictions |

### How to Diagnose

#### 1. Check Logs for Timing

Look for this sequence in your Railway logs:

```
✅ SQLite service fully started!
🔗 Starting webhook auto-setup...
🔍 Checking for existing webhooks...
🔗 Creating Airtable webhook...
✅ Webhook created successfully
🔍 Verifying webhook endpoint is accessible...
```

If you see the error before "Verifying webhook endpoint", the timing fix isn't working.

#### 2. Verify WEBHOOK_PUBLIC_URL

In Railway, check your environment variables:

```bash
# Should match your Railway app URL
WEBHOOK_PUBLIC_URL=https://your-app.railway.app
```

#### 3. Test Webhook Endpoint Manually

```bash
# From your local machine, test if the endpoint responds
curl -X POST https://your-app.railway.app/webhooks/airtable/refresh \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Expected: 400, 401, or 403 (missing auth is OK)
# Bad: Timeout, connection refused, or 5xx errors
```

#### 4. Check Server Startup Order

In `src/server/index.ts`, verify this order:

1. ✅ SQLite initialization
2. ✅ API server start (with webhook routes)
3. ✅ Webhook auto-setup (should be AFTER API server is listening)
4. ✅ Initial data refresh

### Solutions Implemented

The codebase now includes several fixes:

#### 1. Retry Logic with Exponential Backoff

`enableNotifications()` now retries up to 3 times with increasing delays:
- Attempt 1: immediate
- Attempt 2: wait 2s
- Attempt 3: wait 4s

#### 2. Pre-Verification Check

Before calling `enableNotifications`, we verify the endpoint is accessible:

```typescript
const isAccessible = await this.verifyWebhookEndpoint(notificationUrl);
if (!isAccessible) {
  console.warn("⚠️  Webhook endpoint may not be accessible");
}
```

#### 3. Startup Delay

After creating a new webhook, we wait 2 seconds before enabling notifications to ensure the server is fully ready.

#### 4. Better Error Messages

Detailed logging helps identify the exact failure point:

```
🔔 Enabling notifications for webhook whkXXX (attempt 1/3)...
⚠️  Webhook endpoint verification failed (attempt 1/3)
   This usually means Airtable couldn't reach or verify the webhook URL
   Error: {"error":{"type":"INVALID_REQUEST_UNKNOWN",...}}
   Retrying in 2000ms...
```

### Manual Workaround

If auto-setup still fails, you can:

#### Option 1: Disable Auto-Setup and Create Manually

```bash
# In Railway environment variables
WEBHOOK_AUTO_SETUP=false
```

Then create the webhook manually via Airtable API or UI.

#### Option 2: Create Webhook in Two Steps

1. Let the server start fully
2. Call the setup endpoint manually after a delay:

```bash
# Wait for server to be fully ready (check logs)
# Then manually trigger webhook setup via API
curl -X POST https://your-app.railway.app/api/webhooks/setup \
  -H "Authorization: Bearer $BEARER_TOKEN"
```

(Note: You'd need to add this endpoint if it doesn't exist)

### Understanding the Error Response

When you see:

```
error: Failed to enable notifications: 422 - {
  "error": {
    "type": "INVALID_REQUEST_UNKNOWN",
    "message": "Invalid request: parameter validation failed. Check your request data."
  }
}
```

This means:
- ✅ Your Airtable token is valid (or you'd get 401)
- ✅ The webhook was created successfully (or you'd get 404)
- ❌ Airtable couldn't verify your webhook endpoint

### Recommended Configuration for Railway

```bash
# Required
WEBHOOK_PUBLIC_URL=https://your-app.railway.app
WEBHOOK_SECRET=<generated-with-openssl-rand-hex-32>

# Optional (defaults shown)
WEBHOOK_AUTO_SETUP=true
WEBHOOK_RATE_LIMIT=30
WEBHOOK_TIMESTAMP_WINDOW=300
```

### Testing Your Fix

After implementing the fixes:

1. Deploy to Railway
2. Watch the logs for the full webhook setup sequence
3. Verify you see:
   ```
   ✅ Webhook endpoint is accessible (status: 401)
   ⏳ Waiting 2s for server to be fully ready...
   🔔 Enabling notifications for webhook whkXXX (attempt 1/3)...
   ✅ Notifications enabled for webhook whkXXX
   ```

If it still fails after 3 retries, the issue is likely:
- Incorrect `WEBHOOK_PUBLIC_URL`
- Network/firewall blocking Airtable's IP
- Server not responding fast enough (increase retry delay)

### Getting More Help

If the issue persists:

1. Enable verbose logging
2. Test the webhook URL manually from outside Railway
3. Check Railway logs for any startup errors
4. Verify the webhook route is registered (`GET /health` should list it)
5. Contact Railway support if you suspect network/infrastructure issues
