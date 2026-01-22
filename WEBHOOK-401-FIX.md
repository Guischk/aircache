# Résolution du problème de webhook 401

## Problème
Les webhooks Airtable retournaient une erreur 401 (Unauthorized) sur Railway.

## Cause racine
Le `WEBHOOK_SECRET` configuré dans Railway ne correspondait pas au secret utilisé lors de la création du webhook dans Airtable.

## Solution

### 1. Vérifier le secret actuel

Exécutez localement :
```bash
bun run scripts/show-webhook-secret.ts
```

Cela affichera le secret hex utilisé et sa version base64.

### 2. Configurer le secret dans Railway

Dans Railway, assurez-vous que la variable d'environnement est configurée :

```
WEBHOOK_SECRET=9dd93c96be8587a5cec344c03676e2951dcf56b1fd5810296ae6949281e93fd8
```

⚠️ **Important** : Utilisez la version HEX (64 caractères), PAS la version base64.

### 3. Tester le webhook

```bash
# Tester en local
bun run scripts/manage-webhooks.ts test

# Tester en production
bun run scripts/manage-webhooks.ts test https://aircache-production.up.railway.app
```

### 4. Recréer le webhook si nécessaire

Si vous avez changé le secret, vous devez recréer le webhook Airtable :

```bash
# 1. Supprimer l'ancien webhook
bun run scripts/manage-webhooks.ts list
bun run scripts/manage-webhooks.ts delete <webhook-id>

# 2. Créer un nouveau webhook
bun run scripts/manage-webhooks.ts setup https://aircache-production.up.railway.app
```

## Diagnostic avec logs détaillés

Les logs détaillés ont été ajoutés au middleware d'authentification webhook :

- Affiche tous les headers reçus
- Vérifie la présence du header `X-Airtable-Content-MAC`
- Compare les signatures (attendue vs reçue)
- Valide le timestamp

Pour activer les logs en production, configurez dans Railway :
```
CONSOLA_LEVEL=4  # debug level
```

## Scripts disponibles

| Script | Description |
|--------|-------------|
| `bun run scripts/diagnose-webhook.ts` | Diagnostic complet de la configuration |
| `bun run scripts/show-webhook-secret.ts` | Affiche le secret à configurer |
| `bun run scripts/manage-webhooks.ts list` | Liste les webhooks Airtable |
| `bun run scripts/manage-webhooks.ts test <url>` | Teste un webhook |
| `bun run scripts/manage-webhooks.ts setup <url>` | Configure un nouveau webhook |

## Vérification finale

Une fois le secret configuré dans Railway, vérifiez que :

1. ✅ Le secret hex est bien dans Railway : `WEBHOOK_SECRET=9dd93c96be8587a5cec344c03676e2951dcf56b1fd5810296ae6949281e93fd8`
2. ✅ Le webhook existe dans Airtable : `bun run scripts/manage-webhooks.ts list`
3. ✅ Le test réussit : `bun run scripts/manage-webhooks.ts test https://aircache-production.up.railway.app`
4. ✅ Les logs Railway montrent `200` au lieu de `401`

## Format des logs attendus

Avant (❌) :
```
<-- POST /webhooks/airtable/refresh
--> POST /webhooks/airtable/refresh 401 2ms
```

Après (✅) :
```
<-- POST /webhooks/airtable/refresh
--> POST /webhooks/airtable/refresh 200 45ms
```
