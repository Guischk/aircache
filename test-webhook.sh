#!/bin/bash

# Script de test webhook Airtable
# Usage: ./test-webhook.sh [URL]
# 
# Exemples:
#   ./test-webhook.sh                                    # Test en local
#   ./test-webhook.sh https://votre-app.railway.app      # Test sur Railway

set -e

# Configuration
WEBHOOK_URL="${1:-http://localhost:3000}"
WEBHOOK_ENDPOINT="${WEBHOOK_URL}/webhooks/airtable/refresh"

# Charger WEBHOOK_SECRET depuis .env si disponible
if [ -f .env ] && [ -z "$WEBHOOK_SECRET" ]; then
    export $(grep WEBHOOK_SECRET .env | xargs)
fi

if [ -z "$WEBHOOK_SECRET" ]; then
    echo "❌ WEBHOOK_SECRET non défini"
    echo ""
    echo "Générez un secret avec:"
    echo "  openssl rand -hex 32"
    echo ""
    echo "Puis lancez le script avec:"
    echo "  WEBHOOK_SECRET=votre_secret ./test-webhook.sh"
    echo ""
    echo "Ou ajoutez-le à votre .env:"
    echo "  WEBHOOK_SECRET=votre_secret"
    exit 1
fi

# Payload de test (format Airtable)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
PAYLOAD=$(cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "baseTransactionNumber": 123,
  "webhookId": "test-webhook-$(date +%s)",
  "payloads": [{
    "baseTransactionNumber": 123,
    "timestamp": "$TIMESTAMP",
    "changedTablesById": {
      "tblXXXXXXXXXXXXXX": {
        "changedRecordsById": {
          "recXXXXXXXXXXXXXX": null
        }
      }
    }
  }]
}
EOF
)

echo "🔗 Test du webhook Airtable"
echo ""
echo "URL: $WEBHOOK_ENDPOINT"
echo "Secret: ${WEBHOOK_SECRET:0:10}... (${#WEBHOOK_SECRET} chars)"
echo ""

# Calculer la signature HMAC-SHA256
# IMPORTANT: Le secret doit être en hex, on le convertit en binaire pour HMAC
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

echo "📝 Payload:"
echo "$PAYLOAD" | head -c 200
echo "..."
echo ""
echo "🔐 Signature HMAC: sha256=$SIGNATURE"
echo ""
echo "📡 Envoi de la requête..."
echo ""

# Envoyer la requête
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/webhook-response.txt \
  -X POST "$WEBHOOK_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Airtable-Content-MAC: sha256=$SIGNATURE" \
  -d "$PAYLOAD")

echo "📥 Réponse HTTP: $HTTP_CODE"
echo ""

# Afficher la réponse
if [ -f /tmp/webhook-response.txt ]; then
    echo "📄 Réponse:"
    cat /tmp/webhook-response.txt | jq '.' 2>/dev/null || cat /tmp/webhook-response.txt
    echo ""
    rm /tmp/webhook-response.txt
fi

# Interpréter le code HTTP
case $HTTP_CODE in
    200)
        echo "✅ Webhook accepté avec succès!"
        echo ""
        echo "Vérifiez les logs de votre serveur pour voir le refresh en cours."
        ;;
    401)
        echo "❌ Erreur d'authentification (401)"
        echo ""
        echo "Causes possibles:"
        echo "  - Le WEBHOOK_SECRET est différent entre le script et le serveur"
        echo "  - La signature HMAC est incorrecte"
        echo ""
        echo "Vérifiez que le serveur a le même WEBHOOK_SECRET."
        ;;
    429)
        echo "⚠️  Rate limit (429)"
        echo ""
        echo "Trop de webhooks envoyés récemment. Attendez 30 secondes et réessayez."
        ;;
    404)
        echo "❌ Endpoint non trouvé (404)"
        echo ""
        echo "Vérifiez que le serveur est démarré et que l'URL est correcte."
        ;;
    500)
        echo "❌ Erreur serveur (500)"
        echo ""
        echo "Consultez les logs du serveur pour plus de détails."
        ;;
    *)
        echo "❌ Code HTTP inattendu: $HTTP_CODE"
        ;;
esac

echo ""
