# Migration Redis → SQLite

## 🎯 Objectif

Migrer l'architecture de cache Redis vers SQLite pour :
- **Réduire les coûts Railway** de 15$/mois à ~2-3$/mois
- **Simplifier l'architecture** (une seule application)
- **Améliorer la persistance** des données
- **Intégrer le stockage des attachments** directement

## 💰 Économies prévues

| Composant | Avant (Redis) | Après (SQLite) | Économie |
|-----------|---------------|----------------|----------|
| Application | ~3$/mois | ~2-3$/mois | 0$ |
| Redis Service | ~10-12$/mois | 0$ | -12$/mois |
| Storage | Externe | Inclus Railway | Variable |
| **Total** | **~15$/mois** | **~2-3$/mois** | **~80% d'économie** |

## 🏗️ Architecture

### Avant (Redis)
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Application │───▶│ Redis Cache │───▶│   Airtable  │
│   (Bun)     │    │  External   │    │    API      │
└─────────────┘    └─────────────┘    └─────────────┘
      │                                      │
      ▼                                      ▼
┌─────────────┐                    ┌─────────────┐
│ Attachments │                    │  Periodic   │
│  External   │                    │   Refresh   │
└─────────────┘                    └─────────────┘
```

### Après (SQLite)
```
┌─────────────────────────────────┐    ┌─────────────┐
│          Application            │───▶│   Airtable  │
│  ┌─────────────┐ ┌─────────────┐│    │    API      │
│  │    API      │ │   SQLite    ││    └─────────────┘
│  │   Server    │ │   Cache     ││            │
│  └─────────────┘ └─────────────┘│            ▼
│  ┌─────────────┐ ┌─────────────┐│    ┌─────────────┐
│  │ Attachments │ │   Worker    ││    │   Daily     │
│  │   Storage   │ │  Refresh    ││    │  Refresh    │
│  └─────────────┘ └─────────────┘│    └─────────────┘
└─────────────────────────────────┘
```

## 📋 Migration étape par étape

### 1. Préparation

```bash
# Sauvegarde de l'environnement actuel
cp .env .env.redis.backup

# Mise à jour de la configuration
cp .env.example .env
# Éditer .env avec SQLITE_PATH et STORAGE_PATH
```

### 2. Test local

```bash
# Démarrer en mode SQLite
bun run start:sqlite

# OU en développement
bun run dev:sqlite

# Vérifier les endpoints
curl http://localhost:3000/health
curl -H "Authorization: Bearer $BEARER_TOKEN" http://localhost:3000/api/tables
```

### 3. Benchmark comparatif

```bash
# Comparer les performances
bun run benchmark:sqlite

# Résultats attendus :
# - SQLite plus rapide en local (pas de latence réseau)
# - Transactions plus robustes
# - Stockage persistent automatique
```

### 4. Déploiement Railway

#### Option A: Nouveau projet
```bash
# Créer un nouveau projet Railway
railway login
railway init
railway up
```

#### Option B: Migration du projet existant
```bash
# Supprimer le service Redis
# Dans Railway dashboard: Remove Redis service

# Déployer la nouvelle version
git add .
git commit -m "Migration vers SQLite - réduction des coûts"
git push origin main
```

### 5. Configuration Railway

```toml
# railway.toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "bun run start:sqlite"

[environments.production.variables]
SQLITE_V1_PATH = "/app/data/aircache-v1.sqlite"
SQLITE_V2_PATH = "/app/data/aircache-v2.sqlite"
SQLITE_METADATA_PATH = "/app/data/metadata.sqlite"
STORAGE_PATH = "/app/storage/attachments"
REFRESH_INTERVAL = "86400"
```

## 🔄 Scripts de migration

### Scripts package.json
```json
{
  "scripts": {
    "start:sqlite": "bun sqlite-index.ts",
    "dev:sqlite": "bun --hot sqlite-index.ts",
    "start:redis": "bun index.ts",
    "benchmark:sqlite": "bun tests/sqlite-vs-redis.benchmark.ts"
  }
}
```

### Variables d'environnement SQLite
```env
# SQLite configuration
SQLITE_V1_PATH=data/aircache-v1.sqlite
SQLITE_V2_PATH=data/aircache-v2.sqlite
SQLITE_METADATA_PATH=data/metadata.sqlite
CACHE_TTL=86400
REFRESH_INTERVAL=86400
STORAGE_PATH=./storage/attachments

# Legacy Redis (keep for rollback)
# REDIS_URL=redis://...
```

## 🆚 Comparaison des features

| Feature | Redis | SQLite | Avantage |
|---------|--------|--------|----------|
| **Performance lectures** | Très rapide | Rapide | Redis |
| **Performance écritures** | Rapide | Très rapide | SQLite |
| **Transactions** | Limited | ACID | SQLite |
| **Persistance** | Configurable | Native | SQLite |
| **Latence** | Réseau | Local | SQLite |
| **Complexité** | Service externe | Embedded | SQLite |
| **Coût** | ~12$/mois | 0$ | SQLite |
| **Backup** | Manuel | Automatique | SQLite |

## 📊 Nouveaux endpoints

### API SQLite (compatibilité complète)
```
GET  /health                    - Health check
GET  /api/tables               - Liste des tables
GET  /api/tables/:table        - Records d'une table
GET  /api/tables/:table/:id    - Record spécifique
GET  /api/stats                - Statistiques
POST /api/refresh              - Refresh manuel
GET  /api/attachments/:id      - Fichiers attachés ✨ NOUVEAU
```

### Gestion des attachments
```bash
# Les attachments sont automatiquement :
# - Détectés dans les données Airtable
# - Téléchargés lors du refresh
# - Stockés localement dans /storage/attachments
# - Servis via /api/attachments/:id
```

## 🚀 Avantages de la migration

### ✅ Techniques
- **Persistance garantie** : Pas de perte de données en cas de redémarrage
- **Transactions ACID** : Intégrité des données
- **Attachments intégrés** : Plus besoin de service externe
- **Performance locale** : Pas de latence réseau
- **Backup simple** : Un seul fichier SQLite

### ✅ Économiques
- **-80% de coûts** sur Railway
- **Architecture simplifiée** : Moins de composants à maintenir
- **Scaling prévisible** : Coûts liés uniquement au trafic

### ✅ Opérationnels
- **Déploiement simplifié** : Une seule application
- **Debugging facilité** : Tout dans un seul process
- **Monitoring unifié** : Une seule application à surveiller

## ⚠️ Points d'attention

### Limitations SQLite
- **Concurrent writes** : SQLite gère les lectures concurrentes mais serialise les écritures
- **Taille de DB** : Convient jusqu'à plusieurs GB (largement suffisant pour Airtable)
- **Réseau** : Performance optimale en local uniquement

### Migration risks
- **Temps d'arrêt** : ~5-10 minutes pendant la migration Railway
- **Données en vol** : Les données en cache Redis seront perdues (rechargées automatiquement)
- **Rollback** : Prévoir le retour en arrière si nécessaire

## 🔙 Procédure de rollback

Si problème avec SQLite :

```bash
# 1. Restaurer l'ancienne configuration
cp .env.redis.backup .env

# 2. Redéployer la version Redis
git revert HEAD
git push origin main

# 3. Recréer le service Redis sur Railway
# Via dashboard Railway : Add Redis service
```

## 📈 Monitoring post-migration

### Métriques à surveiller
- **Temps de réponse API** : Doit être ≤ Redis
- **Taille base SQLite** : Croissance normale
- **Espace disque** : Storage attachments
- **Refresh duration** : Temps de sync Airtable

### Health checks
```bash
# Vérifier la santé SQLite
curl http://localhost:3000/health

# Stats détaillées
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/stats
```

## ✅ Checklist de migration

- [ ] Backup de l'environnement actuel
- [ ] Tests locaux SQLite réussis
- [ ] Benchmark SQLite vs Redis validé
- [ ] Configuration Railway mise à jour
- [ ] Variables d'environnement configurées
- [ ] Déploiement SQLite réussi
- [ ] Tests API post-déploiement
- [ ] Suppression service Redis
- [ ] Monitoring 24h sans problème
- [ ] Documentation équipe mise à jour

---

**🎯 Résultat attendu** : Architecture simplifiée, coûts réduits de 80%, performances équivalentes ou meilleures, et stockage des attachments intégré.