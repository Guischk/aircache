# 🔗 Configuration des Webhooks Airtable

Guide pour configurer les webhooks Airtable afin de mettre à jour automatiquement votre cache Aircache.

## Vue d'ensemble

Les webhooks Airtable permettent à votre base de notifier Aircache lorsque des données changent. Aircache met ensuite à jour son cache de manière **incrémentale** (seulement les records modifiés) pour une latence minimale.

**Avantages:**
- ⚡ **Temps réel:** Cache mis à jour en ~500ms après modification Airtable
- 💰 **Économie API:** Refresh incrémental consomme moins de quota
- 🔄 **Automatique:** Plus besoin de déclencher manuellement les refreshs

**Mode de refresh:**
- **Incrémental (par défaut):** Met à jour uniquement les records créés/modifiés/supprimés
- **Complet (fallback):** Si le format webhook est inconnu, refresh complet de la base

---

## Prérequis

1. ✅ Aircache déployé et accessible via une URL publique
2. ✅ Accès à l'API Airtable avec un Personal Access Token
3. ✅ Droits admin sur la base Airtable

---

## Configuration Aircache

### 1. Générer un secret webhook

```bash
# Générer un secret aléatoire sécurisé (minimum 32 caractères)
openssl rand -hex 32
```

### 2. Configurer les variables d'environnement

Ajouter dans votre `.env`:

```bash
# OBLIGATOIRE: Secret pour validation HMAC des webhooks
WEBHOOK_SECRET=8f7a3b2c1d9e8f7a6b5c4d3e2f1a9b8c7d6e5f4a3b2c1d9e8f7a6b5c4d3e2f1a

# OPTIONNEL: Temps minimum entre deux refreshs (secondes)
WEBHOOK_RATE_LIMIT=30

# OPTIONNEL: Fenêtre de temps pour accepter un webhook (secondes)
WEBHOOK_TIMESTAMP_WINDOW=300

# OPTIONNEL: Durée de rétention des webhooks traités (secondes)
WEBHOOK_IDEMPOTENCY_TTL=86400
```

### 3. Redémarrer Aircache

```bash
bun index.ts
```

Vérifier dans les logs:
```
✅ Server started on http://localhost:3000
🔗 Webhook endpoint available at /webhooks/airtable/refresh
```

---

## Configuration Airtable

### Via l'API Airtable

Utilisez ce script pour créer le webhook:

```bash
#!/bin/bash

# Configuration
AIRTABLE_TOKEN="pat_votre_token"
BASE_ID="app_votre_base_id"
AIRCACHE_URL="https://aircache.votre-domaine.com"
WEBHOOK_SECRET="8f7a3b2c1d9e8f7a6b5c4d3e2f1a9b8c7d6e5f4a3b2c1d9e8f7a6b5c4d3e2f1a"

# Créer le webhook
curl -X POST "https://api.airtable.com/v0/bases/${BASE_ID}/webhooks" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"notificationUrl\": \"${AIRCACHE_URL}/webhooks/airtable/refresh\",
    \"specification\": {
      \"options\": {
        \"filters\": {
          \"dataTypes\": [\"tableData\"]
        },
        \"includes\": {
          \"includeCellValuesInFieldIds\": \"all\",
          \"includePreviousCellValues\": false,
          \"includePreviousFieldDefinitions\": false
        }
      }
    }
  }"
```

**Réponse attendue:**
```json
{
  "id": "ach...",
  "macSecretBase64": "...",
  "expirationTime": "2026-..."
}
```

---

## Vérification

### 1. Tester la connexion webhook

Créer un record de test dans votre base Airtable et vérifier les logs Aircache:

```
🔗 [Webhook] Received Airtable webhook
   Timestamp: 2026-01-22T...
   Transaction: 12345
✅ [Webhook] Signature validated
🔄 [SQLite] Using incremental refresh
   📥 Fetching 1 records...
   ✅ 1 records updated in cache
✅ [Webhook] incremental refresh completed
```

### 2. Test manuel du endpoint

```bash
# Générer un payload de test avec signature HMAC
WEBHOOK_SECRET="votre-secret"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PAYLOAD="{\"timestamp\":\"$TIMESTAMP\",\"webhookId\":\"test-$(date +%s)\"}"
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d' ' -f2)"

# Appeler le webhook
curl -X POST "https://aircache.votre-domaine.com/webhooks/airtable/refresh" \
  -H "Content-Type: application/json" \
  -H "X-Airtable-Content-MAC: $SIGNATURE" \
  -d "$PAYLOAD"
```

---

## Dépannage

### Erreur: "Missing or invalid signature header"

**Solution:**
1. Vérifier que Airtable envoie bien le header
2. Vérifier que le `WEBHOOK_SECRET` est identique partout
3. Régénérer le webhook dans Airtable

### Erreur: "Invalid signature"

**Solution:**
1. Vérifier que `WEBHOOK_SECRET` est exactement le même
2. Pas d'espaces ou caractères cachés dans le secret
3. Utiliser la même encoding (hex)

### Erreur: "Webhook timestamp expired"

**Solution:**
1. Vérifier la latence réseau
2. Augmenter `WEBHOOK_TIMESTAMP_WINDOW`
3. Vérifier que l'horloge du serveur est synchronisée (NTP)

### Erreur: "Rate limit exceeded"

**Solution:**
1. Vérifier qu'il n'y a pas de boucle infinie
2. Augmenter `WEBHOOK_RATE_LIMIT` si nécessaire

---

## Sécurité

### Meilleures pratiques

1. ✅ **Secret fort:** Minimum 32 caractères aléatoires
2. ✅ **HTTPS uniquement:** Ne jamais exposer le webhook en HTTP
3. ✅ **Rate limiting:** Activer pour éviter les abus
4. ✅ **Logging:** Monitor les webhooks rejetés
5. ✅ **Rotation du secret:** Changer le secret périodiquement

### Rotation du secret

```bash
# 1. Générer nouveau secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Mettre à jour Aircache .env
# WEBHOOK_SECRET=$NEW_SECRET
# Redémarrer Aircache

# 3. Mettre à jour le webhook Airtable
curl -X PATCH "https://api.airtable.com/v0/bases/${BASE_ID}/webhooks/${WEBHOOK_ID}" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"macSecretBase64\": \"$(echo -n $NEW_SECRET | base64)\"}"
```

---

## Références

- [Airtable Webhooks API](https://airtable.com/developers/web/api/webhooks-overview)
- [HMAC Authentication](https://en.wikipedia.org/wiki/HMAC)
- [Aircache Documentation](../README.md)

---

## Support

Besoin d'aide ? 
- 📖 [Documentation complète](../README.md)
- 🐛 [Signaler un bug](https://github.com/guischk/aircache/issues)
- 💬 [Discussions](https://github.com/guischk/aircache/discussions)
