# 🔍 Guide de diagnostic Webhook Airtable

## Problème : Pas de réception de webhooks sur Railway

### ✅ Checklist de diagnostic

#### 1️⃣ Vérifier que le service tourne

```bash
# Tester le health check
curl https://votre-app.railway.app/health
```

**Réponse attendue :**
```json
{
  "status": "healthy",
  "backend": "sqlite",
  "timestamp": "2026-01-22T..."
}
```

❌ Si ça ne fonctionne pas → Le service ne tourne pas correctement

---

#### 2️⃣ Vérifier les variables d'environnement Railway

Dans Railway → Variables → Vérifier :

| Variable | Obligatoire | Description | Exemple |
|----------|-------------|-------------|---------|
| `AIRTABLE_PERSONAL_TOKEN` | ✅ Oui | Token Airtable | `patXXXXXXXXXXXXXX` |
| `AIRTABLE_BASE_ID` | ✅ Oui | ID de la base | `appXXXXXXXXXXXXXX` |
| `BEARER_TOKEN` | ✅ Oui | Token API Aircache | `votre-secret-token` |
| `WEBHOOK_SECRET` | ✅ **CRUCIAL** | Secret pour HMAC (hex) | `a1b2c3d4e5f6...` (64 chars hex) |
| `WEBHOOK_PUBLIC_URL` | ✅ Oui | URL publique | `https://aircache.railway.app` |
| `WEBHOOK_AUTO_SETUP` | ⚠️ Recommandé | Auto-création webhook | `true` |
| `PORT` | 📌 Auto | Port du serveur | `3000` (Railway gère) |

**⚠️ IMPORTANT :** Le `WEBHOOK_SECRET` doit être en format **hexadécimal** (64 caractères). 

Pour générer un secret valide :
```bash
# Sur votre machine locale
openssl rand -hex 32
# Output : a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

---

#### 3️⃣ Consulter les logs Railway

Dans Railway → Deployments → Logs → Chercher :

**✅ Messages de succès :**
```
✅ Webhook auto-setup complete (new webhook created)
   webhookId: achXXXXXXXXXXXXXX
   endpoint: https://votre-app.railway.app/webhooks/airtable/refresh

✅ Notifications enabled for webhook
```

**❌ Messages d'erreur possibles :**

| Message | Cause | Solution |
|---------|-------|----------|
| `Set WEBHOOK_PUBLIC_URL to enable automatic webhook creation` | Variable manquante | Ajouter `WEBHOOK_PUBLIC_URL` |
| `WEBHOOK_SECRET must be set` | Secret manquant | Ajouter `WEBHOOK_SECRET` (hex 64 chars) |
| `Invalid webhook signature` | Secret incorrect | Vérifier que le secret Airtable = Railway |
| `Failed to verify webhook endpoint` | Airtable ne peut pas atteindre l'URL | Vérifier que l'app Railway est publique |
| `Rate limit: webhook too soon` | Trop de webhooks | Normal, protection anti-spam |

---

#### 4️⃣ Vérifier le webhook dans Airtable

**Option A : Via l'interface Airtable**
1. Aller dans votre base Airtable
2. Automation → Web hooks
3. Vérifier qu'un webhook existe pointant vers `https://votre-app.railway.app/webhooks/airtable/refresh`
4. Vérifier que les notifications sont **activées** (enable notifications)

**Option B : Via le script de gestion**
```bash
# Lister les webhooks existants
bun run scripts/manage-webhooks.ts list

# Créer un webhook manuellement
bun run scripts/manage-webhooks.ts create https://votre-app.railway.app/webhooks/airtable/refresh

# Supprimer un webhook
bun run scripts/manage-webhooks.ts delete achXXXXXXXXXXXXXX
```

---

#### 5️⃣ Tester le webhook manuellement

```bash
# Export des variables
export WEBHOOK_SECRET="votre_secret_hex_64_chars"

# Tester contre Railway
./test-webhook.sh https://votre-app.railway.app

# Ou tester en local
./test-webhook.sh http://localhost:3000
```

**Réponse attendue :**
```json
{
  "status": "success",
  "refreshType": "incremental",
  "message": "incremental refresh triggered",
  "timestamp": "2026-01-22T..."
}
```

---

#### 6️⃣ Vérifier la configuration du webhook Airtable

Le webhook Airtable doit avoir :
- **URL** : `https://votre-app.railway.app/webhooks/airtable/refresh`
- **Secret** : Le même que `WEBHOOK_SECRET` (mais encodé en base64 par Airtable)
- **Notifications** : Activées ✅
- **Specification** : Inclure les changements (changedTablesById)

---

## 🐛 Problèmes courants

### Problème 1 : Webhook créé mais notifications désactivées

**Symptôme :** Le webhook existe dans Airtable mais n'envoie rien.

**Solution :**
1. Dans Airtable, vérifier que "Enable notifications" est coché
2. Airtable doit pouvoir "ping" votre endpoint pour l'activer
3. Si l'activation échoue, vérifier que l'URL est accessible publiquement

### Problème 2 : "Invalid webhook signature"

**Symptôme :** Les webhooks arrivent mais sont rejetés (400/401).

**Solution :**
1. Vérifier que `WEBHOOK_SECRET` sur Railway = secret du webhook Airtable
2. Le secret doit être **exactement** le même (hex 64 chars)
3. Régénérer un nouveau secret et recréer le webhook

### Problème 3 : Airtable ne peut pas vérifier l'endpoint

**Symptôme :** Erreur 422 lors de l'activation des notifications.

**Solution :**
1. Vérifier que l'app Railway est déployée et accessible
2. Tester manuellement : `curl https://votre-app.railway.app/health`
3. Vérifier qu'il n'y a pas de restrictions réseau (firewall, IP whitelist)

### Problème 4 : Aucun log dans Railway

**Symptôme :** Aucune trace de webhook dans les logs.

**Cela signifie :**
- Airtable n'envoie rien → Vérifier que le webhook existe et que les notifications sont activées
- Ou les requêtes n'arrivent pas → Vérifier l'URL et la configuration réseau

**Solution :**
1. Tester l'endpoint avec curl/Postman
2. Vérifier les logs Airtable (si disponibles)
3. Recréer le webhook avec le script

---

## 🔧 Commandes utiles

### Redémarrer le service Railway
```bash
# Trigger un redéploiement
git commit --allow-empty -m "Trigger redeploy"
git push railway main
```

### Voir les logs en temps réel
```bash
# Si vous avez railway CLI
railway logs
```

### Tester en local avant Railway
```bash
# 1. Configurer .env
cp .env.example .env
# Éditer .env avec vos valeurs

# 2. Lancer le serveur
bun --hot index.ts

# 3. Tester le webhook
./test-webhook.sh http://localhost:3000
```

---

## 📊 Métriques à surveiller

Une fois que les webhooks fonctionnent, vous pouvez vérifier :

```bash
# Endpoint de stats webhooks
curl -H "Authorization: Bearer VOTRE_TOKEN" \
  https://votre-app.railway.app/api/webhooks/stats
```

Vous verrez :
- Nombre de webhooks reçus
- Nombre de refresh incrémentaux vs complets
- Derniers webhooks traités
- Webhooks en erreur

---

## 🎯 Prochain pas

1. ✅ Vérifier le health check
2. ✅ Vérifier les variables d'environnement
3. ✅ Consulter les logs Railway
4. ✅ Tester manuellement avec test-webhook.sh
5. ✅ Vérifier le webhook dans Airtable
6. ✅ Faire un changement dans Airtable pour tester

Si après tout ça ça ne fonctionne toujours pas, partagez :
- Les logs Railway complets au démarrage
- Le résultat de `./test-webhook.sh`
- Le résultat de `bun run scripts/manage-webhooks.ts list`
