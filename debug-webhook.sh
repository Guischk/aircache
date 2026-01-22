#!/bin/bash
# Script de diagnostic pour tester le webhook Airtable avec signature HMAC

# Charger les variables d'environnement
source .env 2>/dev/null || true

WEBHOOK_URL="${1:-http://localhost:3000}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}"

if [ -z "$WEBHOOK_SECRET" ]; then
    echo "❌ WEBHOOK_SECRET not set in .env"
    exit 1
fi

# Créer un payload de test
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
PAYLOAD="{\"timestamp\":\"$TIMESTAMP\",\"baseId\":\"test\",\"webhookId\":\"test\"}"

echo "📦 Payload:"
echo "$PAYLOAD"
echo ""

# Calculer la signature HMAC
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')
FULL_SIGNATURE="sha256=$SIGNATURE"

echo "🔐 Signature:"
echo "$FULL_SIGNATURE"
echo ""

# Envoyer la requête
echo "🚀 Sending webhook to $WEBHOOK_URL/webhooks/airtable/refresh"
echo ""

curl -v -X POST "$WEBHOOK_URL/webhooks/airtable/refresh" \
  -H "Content-Type: application/json" \
  -H "X-Airtable-Content-MAC: $FULL_SIGNATURE" \
  -d "$PAYLOAD"

echo ""
echo "✅ Done"
