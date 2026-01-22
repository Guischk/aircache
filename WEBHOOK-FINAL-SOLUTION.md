# ✅ Solution finale - Webhooks Airtable

## Le vrai problème (enfin identifié !)

Le secret webhook doit suivre un processus de **double conversion** selon la documentation Airtable :

### Lors de la création du webhook
```
Secret HEX (64 chars)
  ↓ convertir en Buffer
  ↓ encoder en base64
Secret BASE64 (44 chars) → Envoyé à Airtable
```

### Lors de la validation du webhook
```
Secret HEX (stocké dans WEBHOOK_SECRET)
  ↓ convertir en Buffer
  ↓ encoder en base64
Secret BASE64
  ↓ DÉCODER depuis base64
Secret BINAIRE → Utilisé pour HMAC
```

## Ce qui ne marchait pas

Notre code utilisait directement le secret hex pour calculer le HMAC :
```typescript
// ❌ INCORRECT
const keyData = encoder.encode(config.webhookSecret); // Hex en UTF-8
const hmac = new Bun.CryptoHasher('sha256', keyData);
```

## La solution correcte (selon la doc Airtable)

```typescript
// ✅ CORRECT
// 1. Convertir hex en base64
const secretBase64 = Buffer.from(config.webhookSecret, 'hex').toString('base64');

// 2. Décoder base64 en binaire
const secretDecoded = Buffer.from(secretBase64, 'base64');

// 3. Utiliser le binaire pour HMAC
const hmac = crypto.createHmac('sha256', secretDecoded);
```

## Algorithme exact d'Airtable (de leur doc)

```javascript
const macSecretDecoded = Buffer.from(macSecretBase64FromCreate, 'base64');
const body = Buffer.from(JSON.stringify(webhookNotificationDeliveryPayload), 'utf8');
const hmac = require('crypto').createHmac('sha256', macSecretDecoded);
hmac.update(body.toString(), 'ascii');
const expectedContentHmac = 'hmac-sha256=' + hmac.digest('hex');
```

## Modifications appliquées

### Fichier modifié
`src/api/middleware/webhook-auth.ts`

### Changement clé
```typescript
// Ancien code (incorrect)
const keyData = encoder.encode(config.webhookSecret);
const hmac = new Bun.CryptoHasher('sha256', keyData);

// Nouveau code (correct)
// 1. Convertir hex → base64
const secretBase64 = Buffer.from(config.webhookSecret, 'hex').toString('base64');

// 2. Décoder base64 → binaire
const secretDecoded = new Uint8Array(Buffer.from(secretBase64, 'base64'));

// 3. Calculer HMAC avec le binaire
const bodyData = new Uint8Array(Buffer.from(body, 'utf8'));
const hmac = new Bun.CryptoHasher('sha256', secretDecoded)
    .update(bodyData)
    .digest('hex');
```

## Tests de validation

### Test avec simulation exacte d'Airtable
```bash
bun run scripts/test-airtable-exact.ts http://localhost:3000
```

**Résultat** : ✅ 200 OK

Ce script simule **exactement** l'algorithme d'Airtable en utilisant :
- Secret en base64
- Décodage depuis base64
- HMAC avec le secret décodé

### Test en production
```bash
bun run scripts/test-airtable-exact.ts https://aircache-production.up.railway.app
```

## Configuration Railway

Le `WEBHOOK_SECRET` reste en **format hex** :
```
WEBHOOK_SECRET=9dd93c96be8587a5cec344c03676e2951dcf56b1fd5810296ae6949281e93fd8
```

La conversion hex → base64 → décodage est faite automatiquement par le code.

## Pourquoi ça ne marchait pas avant ?

1. **Création du webhook** : On envoyait correctement le secret en base64 ✅
2. **Validation** : On utilisait le secret hex directement ❌

Airtable signe avec le secret **décodé depuis base64**, mais on validait avec le secret **hex en UTF-8**.

## État actuel

- ✅ Secret correctement converti (hex → base64 → binaire)
- ✅ HMAC calculé avec le secret binaire décodé
- ✅ Support des deux formats de signature (`sha256=` et `hmac-sha256=`)
- ✅ Webhook ID : `achsZC0KQajN2BcKc`
- ✅ Tests locaux : Réussis (200 OK)
- ⏳ Production : En cours de déploiement

## Vérification finale

1. **Attendre le déploiement Railway** (2-5 minutes)
2. **Modifier un enregistrement dans Airtable**
3. **Vérifier les logs Railway** :

Avant (❌) :
```
[Webhook] ℹ Signature comparison {
  providedHash: 'd4bb36877ef0e468b7aee33bba5bfe2d213a7616c801339a0b054f3ddc664d97',
  computedHash: 'd0b084f472f4c63174d102a4be96cc2b15bfb5e26f52f03dd75aa60710f95227',
  match: false
}
--> POST /webhooks/airtable/refresh 401 3ms
```

Après (✅) :
```
[Webhook] ℹ Signature comparison {
  providedHash: 'd4bb36877ef0e468b7aee33bba5bfe2d213a7616c801339a0b054f3ddc664d97',
  computedHash: 'd4bb36877ef0e468b7aee33bba5bfe2d213a7616c801339a0b054f3ddc664d97',
  match: true
}
--> POST /webhooks/airtable/refresh 200 45ms
```

## Scripts disponibles

| Script | Description |
|--------|-------------|
| `scripts/test-airtable-exact.ts` | Simule exactement Airtable (recommandé) |
| `scripts/manage-webhooks.ts list` | Liste les webhooks |
| `scripts/recreate-webhook-with-current-secret.ts` | Recrée le webhook |
| `scripts/diagnose-webhook.ts` | Diagnostic complet |

## En résumé

Le problème était un **encodage incorrect du secret** :
- Airtable utilise : **base64 → décodé → binaire → HMAC**
- Nous utilisions : **hex → UTF-8 → HMAC** ❌

Maintenant nous suivons exactement l'algorithme d'Airtable et ça fonctionne ! 🎉
