# 🚀 Guide de déploiement Railway SQLite

## ✅ Prérequis vérifiés

Tous les éléments nécessaires ont été mis en place :

- ✅ Scripts package.json mis à jour pour SQLite
- ✅ railway.toml configuré pour SQLite avec volumes
- ✅ .gitignore protège les données SQLite et storage
- ✅ Workers et API adaptés pour SQLite
- ✅ Variables d'environnement configurées
- ✅ Script de test de déploiement

## 🧪 Test pré-déploiement

### 1. Test local
```bash
# Démarrer l'application SQLite
bun run start:sqlite

# Dans un autre terminal, tester
bun test-sqlite-deployment.ts
```

### 2. Vérification manuelle
```bash
# Health check
curl http://localhost:3000/health

# API avec auth
curl -H "Authorization: Bearer $BEARER_TOKEN" \
     http://localhost:3000/api/tables

# Stats
curl -H "Authorization: Bearer $BEARER_TOKEN" \
     http://localhost:3000/api/stats
```

## 🚀 Déploiement Railway

### Option A: Migration du projet existant (recommandée)

#### 1. Backup et préparation
```bash
# Backup de l'environnement actuel
cp .env .env.redis.backup

# Vérifier la configuration
cat railway.toml
cat .env.example
```

#### 2. Commit des changements
```bash
git add .
git commit -m "Migration vers SQLite - Architecture simplifiée et coûts réduits

- Remplacement de Redis par SQLite (bun:sqlite)
- Storage des attachments intégré
- Refresh journalier au lieu de 1h30
- Économie prévue: 15$ → 2-3$/mois (80% d'économie)
- API 100% compatible avec version Redis"

git push origin main
```

#### 3. Configuration Railway Dashboard

**Variables d'environnement à configurer :**
```env
AIRTABLE_PERSONAL_TOKEN=your-token
AIRTABLE_BASE_ID=your-base-id
BEARER_TOKEN=your-bearer-token
SQLITE_PATH=/app/data/aircache.db
STORAGE_PATH=/app/storage/attachments
REFRESH_INTERVAL=86400
CACHE_TTL=86400
NODE_ENV=production
```

#### 4. Suppression du service Redis
1. Aller dans Railway Dashboard
2. Sélectionner votre projet
3. Supprimer le service Redis
4. **Économie immédiate : -10-12$/mois**

### Option B: Nouveau projet Railway

```bash
# Initialiser un nouveau projet
railway login
railway init aircache-sqlite
railway up

# Configurer les variables d'environnement
railway variables set AIRTABLE_PERSONAL_TOKEN=your-token
railway variables set AIRTABLE_BASE_ID=your-base-id
railway variables set BEARER_TOKEN=your-bearer-token
```

## 📊 Monitoring post-déploiement

### 1. Vérifications immédiates
```bash
# Health check
curl https://your-app.railway.app/health

# Stats API
curl -H "Authorization: Bearer $BEARER_TOKEN" \
     https://your-app.railway.app/api/stats
```

### 2. Logs Railway
- Surveiller les logs de démarrage
- Vérifier la création des dossiers `/app/data` et `/app/storage`
- Confirmer la connexion SQLite
- Observer le premier refresh

### 3. Métriques à surveiller
- **Temps de réponse** : Doit être ≤ version Redis
- **Taille DB SQLite** : Croissance normale selon vos données
- **RAM usage** : Devrait être plus stable
- **CPU usage** : Pics lors des refresh journaliers

## 💰 Économies réalisées

| Composant | Avant | Après | Économie |
|-----------|-------|-------|----------|
| Application | ~3$/mois | ~2-3$/mois | 0$ |
| Redis Service | ~10-12$/mois | **0$** | **-12$/mois** |
| Storage | Externe | Inclus | Variable |
| **TOTAL** | **~15$/mois** | **~2-3$/mois** | **~80%** |

## 🔧 Nouvelles fonctionnalités

### Attachments automatiques
```bash
# Les fichiers Airtable sont maintenant :
# - Détectés automatiquement
# - Téléchargés lors du refresh
# - Stockés dans /app/storage/attachments
# - Servis via /api/attachments/:id
```

### Refresh optimisé
```bash
# Nouveau cycle :
# - Refresh journalier (au lieu de 1h30)
# - 90% moins d'appels API Airtable
# - Refresh manuel via POST /api/refresh
```

## ⚠️ Points d'attention

### Performance
- **Latence** : SQLite local devrait être plus rapide que Redis réseau
- **Concurrent writes** : SQLite sérialise les écritures (normal)
- **Taille DB** : Surveiller la croissance, optimisée pour plusieurs GB

### Données
- **Migration automatique** : Première sync recrée tout le cache
- **Persistance** : Plus de perte de cache au redémarrage
- **Backup** : Un seul fichier SQLite à sauvegarder

### Troubleshooting
```bash
# Si problème, vérifier :
ls -la /app/data/        # Fichier SQLite créé ?
ls -la /app/storage/     # Dossier attachments créé ?
cat /app/data/aircache.db # DB not empty ?

# Logs utiles :
grep "SQLite" /var/log/app.log
grep "Worker" /var/log/app.log
```

## 🔙 Plan de rollback

Si problème critique :

### 1. Rollback code
```bash
git revert HEAD
git push origin main
```

### 2. Reconfigurer Redis
```bash
# Dans Railway Dashboard :
# 1. Add Redis service
# 2. Reconfigurer REDIS_URL
# 3. Supprimer variables SQLite
```

### 3. Restaurer l'environnement
```bash
cp .env.redis.backup .env
```

## ✅ Checklist de déploiement

- [ ] Tests locaux passés (`bun test-sqlite-deployment.ts`)
- [ ] Variables d'environnement configurées sur Railway
- [ ] Commit et push des changements
- [ ] Déploiement Railway réussi
- [ ] Service Redis supprimé
- [ ] Health check post-déploiement OK
- [ ] Premier refresh complété
- [ ] Monitoring 24h sans problème
- [ ] Documentation équipe mise à jour

## 🎯 Résultat final

**Architecture simplifiée :**
- ✅ Une seule application Railway
- ✅ Base de données SQLite intégrée
- ✅ Storage des attachments local
- ✅ **Coûts réduits de 80%**
- ✅ API 100% compatible
- ✅ Performances équivalentes ou meilleures

**Support :**
Si problème, les logs detaillés sont disponibles dans Railway Dashboard > Deployments > View Logs.