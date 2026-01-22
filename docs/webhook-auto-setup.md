# 🚀 Webhook Auto-Setup Guide

Aircache peut **automatiquement créer et configurer** les webhooks Airtable au démarrage du serveur. Plus besoin de scripts curl complexes!

## ✨ Fonctionnalités

- ✅ Création automatique du webhook si inexistant
- ✅ Détection des webhooks existants (évite les doublons)
- ✅ Configuration automatique des notifications
- ✅ Support de la rotation des secrets
- ✅ Logs détaillés pour le debugging

---

## 🎯 Setup en 3 étapes

### 1. Générer un secret webhook

```bash
openssl rand -hex 32
```

Copiez le résultat (64 caractères hexadécimaux).

### 2. Configurer les variables d'environnement

Ajoutez dans votre `.env`:

```bash
# OBLIGATOIRE: URL publique de votre Aircache
WEBHOOK_PUBLIC_URL=https://aircache.yourcompany.com

# OBLIGATOIRE: Secret pour validation HMAC (celui généré à l'étape 1)
WEBHOOK_SECRET=8f7a3b2c1d9e8f7a6b5c4d3e2f1a9b8c7d6e5f4a3b2c1d9e8f7a6b5c4d3e2f1a

# OPTIONNEL: Active/désactive l'auto-setup (défaut: true)
WEBHOOK_AUTO_SETUP=true

# Configuration Airtable (déjà requise pour Aircache)
AIRTABLE_PERSONAL_TOKEN=pat_votre_token
AIRTABLE_BASE_ID=app_votre_base_id
```

### 3. Démarrer Aircache

```bash
bun index.ts
```

**C'est tout!** Le webhook sera créé automatiquement au démarrage.

---

## 📋 Logs de démarrage

### ✅ Succès - Nouveau webhook créé

```
🚀 Starting Aircache service (SQLite)
📊 Port: 3000
⏰ Refresh: 86400s
...
✅ SQLite databases initialized
🔗 Starting webhook auto-setup...
🔍 Checking for existing webhooks...
🔗 Creating Airtable webhook...
   URL: https://aircache.yourcompany.com/webhooks/airtable/refresh
   Secret: OGY3YTNiMm...
✅ Webhook created successfully
   ID: achw8xKJN2m3PqRst
   Expires: 2026-07-22T10:30:00.000Z
✅ Notifications enabled for webhook achw8xKJN2m3PqRst
✅ Webhook auto-setup complete (new webhook created)
   Webhook ID: achw8xKJN2m3PqRst
   Endpoint: https://aircache.yourcompany.com/webhooks/airtable/refresh
```

### ✅ Succès - Webhook existant trouvé

```
🔗 Starting webhook auto-setup...
🔍 Checking for existing webhooks...
✅ Webhook already exists: achw8xKJN2m3PqRst
   URL: https://aircache.yourcompany.com/webhooks/airtable/refresh
   Enabled: true
   Notifications: true
✅ Webhook auto-setup complete (existing webhook found)
   Webhook ID: achw8xKJN2m3PqRst
   Endpoint: https://aircache.yourcompany.com/webhooks/airtable/refresh
```

### ⚠️ Auto-setup désactivé

```
ℹ️  Webhook auto-setup disabled (WEBHOOK_AUTO_SETUP=false)
```

### ⚠️ URL publique manquante

```
⚠️  Webhook auto-setup skipped: WEBHOOK_PUBLIC_URL not configured
   Set WEBHOOK_PUBLIC_URL to enable automatic webhook creation
```

---

## 🔧 Configuration avancée

### Désactiver l'auto-setup

Si vous préférez créer les webhooks manuellement:

```bash
WEBHOOK_AUTO_SETUP=false
```

Puis suivez les instructions dans [`docs/webhooks.md`](./webhooks.md) pour la création manuelle.

### Utiliser plusieurs environnements

**Production:**
```bash
WEBHOOK_PUBLIC_URL=https://aircache.prod.com
WEBHOOK_SECRET=prod_secret_here
```

**Staging:**
```bash
WEBHOOK_PUBLIC_URL=https://aircache.staging.com
WEBHOOK_SECRET=staging_secret_here
```

Chaque environnement aura son propre webhook Airtable.

### Rotation du secret

1. Générer un nouveau secret:
   ```bash
   NEW_SECRET=$(openssl rand -hex 32)
   echo $NEW_SECRET
   ```

2. Mettre à jour `.env`:
   ```bash
   WEBHOOK_SECRET=nouveau_secret_ici
   ```

3. Redémarrer Aircache:
   ```bash
   bun index.ts
   ```

Le système détectera que l'URL existe déjà et **ne créera pas de doublon**. Par contre, vous devrez mettre à jour manuellement le secret du webhook existant via l'API Airtable si vous changez le secret.

---

## 🐛 Dépannage

### Erreur: `AIRTABLE_BASE_ID not configured`

**Solution:** Vérifiez que `AIRTABLE_BASE_ID` est défini dans votre `.env`.

### Erreur: `Failed to create webhook: 401`

**Causes possibles:**
- Token Airtable invalide ou expiré
- Token sans permissions suffisantes (nécessite `data.records:write`)

**Solution:**
1. Vérifier que `AIRTABLE_PERSONAL_TOKEN` est correct
2. Régénérer un token avec les bonnes permissions sur https://airtable.com/create/tokens

### Erreur: `Failed to create webhook: 422`

**Cause:** URL invalide ou inaccessible depuis Airtable

**Solution:**
1. Vérifier que `WEBHOOK_PUBLIC_URL` est une URL **publique** (pas localhost)
2. Vérifier que l'URL est accessible via HTTPS
3. Tester avec curl:
   ```bash
   curl -I https://aircache.yourcompany.com/health
   ```

### Warning: `Webhook auto-setup error: ...`

L'auto-setup échoue **sans bloquer le démarrage du serveur**. Aircache continuera de fonctionner normalement, mais les webhooks devront être créés manuellement.

---

## 📊 Vérification

### 1. Via les logs

Cherchez ces lignes dans les logs de démarrage:
```
✅ Webhook auto-setup complete
   Webhook ID: achw...
```

### 2. Via l'API Airtable

Lister les webhooks existants:
```bash
curl "https://api.airtable.com/v0/bases/$AIRTABLE_BASE_ID/webhooks" \
  -H "Authorization: Bearer $AIRTABLE_PERSONAL_TOKEN"
```

### 3. Tester le webhook

Créez/modifiez un record dans Airtable et vérifiez les logs Aircache:
```
🔗 [Webhook] Received Airtable webhook
   Timestamp: 2026-01-22T...
✅ [Webhook] Signature validated
🔄 [Webhook] Triggering incremental refresh (async)
```

---

## 🔐 Sécurité

### ✅ Bonnes pratiques

1. **URL publique HTTPS uniquement** - Jamais en HTTP
2. **Secret fort** - Minimum 32 caractères aléatoires (utilisez `openssl rand -hex 32`)
3. **Variables d'environnement** - Ne jamais commiter `.env` dans git
4. **Rotation périodique** - Changer le secret tous les 90 jours

### ⚠️ À éviter

- ❌ Utiliser `localhost` ou `127.0.0.1` dans `WEBHOOK_PUBLIC_URL`
- ❌ Utiliser HTTP au lieu de HTTPS
- ❌ Réutiliser le même secret entre environnements
- ❌ Commiter `.env` dans git

---

## 📚 Références

- [Airtable Webhooks API - List](https://airtable.com/developers/web/api/list-webhooks)
- [Airtable Webhooks API - Create](https://airtable.com/developers/web/api/create-a-webhook)
- [Aircache Webhook Documentation](./webhooks.md)
- [Aircache Configuration](../README.md#configuration)

---

## ❓ FAQ

### Q: L'auto-setup crée-t-il plusieurs webhooks à chaque redémarrage?

**R:** Non! Le système vérifie d'abord si un webhook existe déjà pour l'URL configurée. Il ne crée un nouveau webhook que si aucun n'existe.

### Q: Que se passe-t-il si je change `WEBHOOK_PUBLIC_URL`?

**R:** Un nouveau webhook sera créé pour la nouvelle URL. L'ancien webhook restera actif. Supprimez-le manuellement via l'API Airtable si nécessaire.

### Q: Puis-je utiliser l'auto-setup en développement local?

**R:** Oui, mais vous devez exposer votre serveur local via un tunnel (ngrok, cloudflared, etc.):

```bash
# Exemple avec cloudflared
cloudflared tunnel --url http://localhost:3000

# Puis configurez l'URL du tunnel
WEBHOOK_PUBLIC_URL=https://xyz.trycloudflare.com
```

### Q: Comment supprimer un webhook créé automatiquement?

**R:** Utilisez l'API Airtable:

```bash
WEBHOOK_ID="achw_votre_webhook_id"
curl -X DELETE \
  "https://api.airtable.com/v0/bases/$AIRTABLE_BASE_ID/webhooks/$WEBHOOK_ID" \
  -H "Authorization: Bearer $AIRTABLE_PERSONAL_TOKEN"
```

### Q: L'auto-setup fonctionne-t-il avec les proxies/reverse proxies?

**R:** Oui! Configurez `WEBHOOK_PUBLIC_URL` avec l'URL publique (celle vue par Airtable):

```bash
# Nginx reverse proxy example
WEBHOOK_PUBLIC_URL=https://api.yourcompany.com
```

---

**Besoin d'aide?**
- 📖 [Documentation complète](../README.md)
- 🐛 [Signaler un bug](https://github.com/guischk/aircache/issues)
- 💬 [Discussions](https://github.com/guischk/aircache/discussions)
