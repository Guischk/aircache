# ✅ Webhooks Airtable - Problème résolu !

## Résumé du problème

Les webhooks Airtable retournaient **401 Unauthorized** pour deux raisons :

1. **Format de signature incorrect** : Airtable utilise `hmac-sha256=` mais notre code s'attendait à `sha256=`
2. **Secret désynchronisé** : Le webhook Airtable avait été créé avec un secret différent de celui configuré dans Railway

## Solutions appliquées

### 1. Support des deux formats de signature ✅

Modification de `src/api/middleware/webhook-auth.ts` pour accepter :
- `sha256=...` (format de test)
- `hmac-sha256=...` (format Airtable production)

**Résultat** : Le code peut maintenant valider les signatures Airtable.

### 2. Recréation du webhook avec le bon secret ✅

Le webhook a été supprimé et recréé avec le secret actuel de Railway :

- **Ancien webhook ID** : `achXj7NGgCSsLEsua` (secret incorrect)
- **Nouveau webhook ID** : `achsZC0KQajN2BcKc` (secret correct)
- **Secret utilisé** : `9dd93c96be8587a5cec344c03676e2951dcf56b1fd5810296ae6949281e93fd8`

**Résultat** : Les signatures sont maintenant validées correctement.

## Test de validation

```bash
bun run scripts/test-hmac-sha256-format.ts https://aircache-production.up.railway.app
```

**Résultat** : ✅ 200 OK

## Configuration Railway requise

Assurez-vous que cette variable d'environnement est configurée :

```
WEBHOOK_SECRET=9dd93c96be8587a5cec344c03676e2951dcf56b1fd5810296ae6949281e93fd8
```

## Vérification finale

Pour confirmer que tout fonctionne :

1. **Modifier un enregistrement dans Airtable**
2. **Vérifier les logs Railway** - vous devriez voir :
   ```
   <-- POST /webhooks/airtable/refresh
   --> POST /webhooks/airtable/refresh 200 45ms
   ```
3. **Vérifier que le cache est rafraîchi** (si configuré pour refresh incrémental)

## Scripts disponibles

| Script | Usage |
|--------|-------|
| `bun run scripts/manage-webhooks.ts list` | Liste les webhooks Airtable |
| `bun run scripts/test-hmac-sha256-format.ts <url>` | Test avec format Airtable |
| `bun run scripts/recreate-webhook-with-current-secret.ts` | Recrée le webhook si problème |
| `bun run scripts/diagnose-webhook.ts` | Diagnostic complet |

## Désactiver les logs verbeux (optionnel)

Une fois que tout fonctionne, vous pouvez réduire les logs détaillés.

### Option 1 : Via variable d'environnement Railway

```
CONSOLA_LEVEL=3  # info level au lieu de debug (4)
```

### Option 2 : Supprimer les logs du code

Éditez `src/api/middleware/webhook-auth.ts` et supprimez ou commentez :
- Les logs "Webhook request received" avec tous les headers
- Les logs "Signature comparison" avec les hashes

Gardez uniquement les logs d'erreur (`logger.error` et `logger.warn`).

## En cas de problème futur

Si vous voyez à nouveau des 401 :

1. **Vérifiez que le secret Railway n'a pas changé** :
   ```bash
   bun run scripts/diagnose-webhook.ts
   ```

2. **Testez manuellement** :
   ```bash
   bun run scripts/test-hmac-sha256-format.ts https://aircache-production.up.railway.app
   ```

3. **Si le test échoue, recréez le webhook** :
   ```bash
   bun run scripts/recreate-webhook-with-current-secret.ts
   ```

## Statut actuel

- ✅ Format de signature : Supporte `sha256=` et `hmac-sha256=`
- ✅ Secret synchronisé : Railway et Airtable utilisent le même secret
- ✅ Webhook créé : ID `achsZC0KQajN2BcKc`
- ✅ Notifications activées : Oui
- ✅ Tests manuels : Réussis (200 OK)
- ⏳ Tests réels Airtable : À vérifier en modifiant un enregistrement

## Prochaines étapes

1. Modifier un enregistrement dans votre base Airtable
2. Vérifier que les logs Railway montrent `200 OK`
3. Vérifier que le cache est bien rafraîchi
4. (Optionnel) Réduire les logs verbeux
