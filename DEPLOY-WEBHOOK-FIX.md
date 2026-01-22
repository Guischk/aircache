# Fix pour l'erreur 401 - Format de signature

## Problème identifié

Airtable envoie le header `X-Airtable-Content-MAC` avec le préfixe `hmac-sha256=` :
```
hmac-sha256=4dc41ae0fb2b9d2141b5b77af51e428d64cc644ad2d4ae82d82ad1bf5d5a40af
```

Mais notre code s'attendait au préfixe `sha256=` :
```
sha256=...
```

## Solution appliquée

Le middleware `src/api/middleware/webhook-auth.ts` a été modifié pour accepter les deux formats :
- `sha256=...` (format de test)
- `hmac-sha256=...` (format Airtable production)

### Changements apportés

1. **Validation du préfixe** : Accepte maintenant `sha256=` OU `hmac-sha256=`
2. **Extraction du hash** : Utilise une regex pour enlever n'importe quel préfixe
3. **Logs détaillés** : Affiche tous les headers et les étapes de validation

## Déploiement

### 1. Commiter et pousser les changements

```bash
git add src/api/middleware/webhook-auth.ts
git commit -m "fix: support both sha256= and hmac-sha256= signature formats for Airtable webhooks"
git push
```

### 2. Railway déploiera automatiquement

Railway détectera le push et déploiera automatiquement.

### 3. Vérifier le déploiement

Attendez que Railway indique "Deployed" puis testez :

```bash
bun run scripts/test-hmac-sha256-format.ts https://aircache-production.up.railway.app
```

### 4. Vérifier les webhooks Airtable

Une fois déployé, les webhooks Airtable devraient fonctionner. Vérifiez dans Railway que les logs montrent :

```
✅ AVANT (erreur) :
--> POST /webhooks/airtable/refresh 401 3ms

✅ APRÈS (succès) :
--> POST /webhooks/airtable/refresh 200 45ms
```

## Tests disponibles

| Script | Format testé | Description |
|--------|--------------|-------------|
| `bun run scripts/manage-webhooks.ts test` | `sha256=` | Format de test standard |
| `bun run scripts/test-hmac-sha256-format.ts` | `hmac-sha256=` | Format Airtable production |

## Vérification complète

1. ✅ Les deux formats de signature sont supportés
2. ✅ Logs détaillés pour debugging
3. ✅ Tests locaux réussis
4. ⏳ Déploiement sur Railway nécessaire
5. ⏳ Vérification des webhooks Airtable réels

## Configuration requise dans Railway

Assurez-vous que cette variable est toujours configurée :

```
WEBHOOK_SECRET=9dd93c96be8587a5cec344c03676e2951dcf56b1fd5810296ae6949281e93fd8
```

## Désactiver les logs verbeux (optionnel)

Une fois que tout fonctionne, vous pouvez réduire les logs en production en ajustant :

```
CONSOLA_LEVEL=3  # info level (au lieu de 4 = debug)
```

Ou en modifiant le code pour supprimer les logs détaillés du middleware webhook.
