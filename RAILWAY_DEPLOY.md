# Déploiement Railway pour Aircache

Ce guide explique comment déployer Aircache sur Railway avec le nouveau système de build **Railpack**.

## Prérequis

1. Un compte Railway
2. Les clés API Airtable
3. Une base de données Redis (fournie par Railway ou externe)

## Système de Build : Railpack vs Nixpacks

Railway a introduit **Railpack** comme nouveau système de build pour remplacer Nixpacks :

### Avantages de Railpack :

- **Images 38-77% plus légères** (Node.js, Python, etc.)
- **Versionnement granulaire** des packages (major.minor.patch)
- **Meilleure mise en cache** avec BuildKit
- **Déploiements plus rapides**

### Configuration :

- **Recommandé** : Utiliser Railpack (configuré dans `railway.toml`)
- **Fallback** : Nixpacks toujours supporté (fichier `nixpacks.toml` fourni)

## Configuration

### Variables d'environnement

Configurez les variables d'environnement suivantes dans votre projet Railway :

**⚠️ Important** : Le schéma Airtable est généré automatiquement au démarrage du service, mais nécessite les clés API Airtable.

#### Obligatoires

- `AIRTABLE_API_KEY` : Votre clé API Airtable
- `AIRTABLE_BASE_ID` : L'ID de votre base Airtable

#### Optionnelles

- `PORT` : Port du serveur (défaut: 3000)
- `REFRESH_INTERVAL` : Intervalle de rafraîchissement en secondes (défaut: 5400)
- `CACHE_TTL` : Durée de vie du cache en secondes (défaut: 7200)
- `MAX_CACHE_SIZE` : Taille maximale du cache (défaut: 1000)
- `API_SECRET_KEY` : Clé secrète pour l'API
- `JWT_SECRET` : Secret pour les tokens JWT

#### Redis (si externe)

- `REDIS_URL` : URL complète de connexion Redis
- `REDIS_HOST` : Hôte Redis
- `REDIS_PORT` : Port Redis
- `REDIS_PASSWORD` : Mot de passe Redis
- `REDIS_DB` : Numéro de base de données Redis

## Déploiement

### Méthode 1 : Via GitHub (Recommandée)

1. Connectez votre repository GitHub à Railway
2. Railway détectera automatiquement la configuration avec **Railpack**
3. Ajoutez les variables d'environnement dans le dashboard Railway
4. Le déploiement se lancera automatiquement avec des images optimisées

**Note** : Si vous préférez utiliser Nixpacks, ajoutez la variable d'environnement `NIXPACKS_BUILDER=true` dans votre projet Railway.

### Méthode 2 : Via CLI Railway

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Initialiser le projet
railway init

# Ajouter les variables d'environnement
railway variables set AIRTABLE_API_KEY=your_key_here
railway variables set AIRTABLE_BASE_ID=your_base_id_here

# Déployer
railway up
```

## Services Redis

### Option 1 : Redis Railway (Recommandée)

Railway fournit un service Redis intégré :

1. Ajoutez un service Redis dans votre projet Railway
2. Railway configurera automatiquement `REDIS_URL`

### Option 2 : Redis externe

Si vous utilisez un Redis externe (Redis Cloud, AWS ElastiCache, etc.), configurez les variables Redis manuellement.

## Monitoring

Railway fournit :

- Logs en temps réel
- Métriques de performance
- Health checks automatiques
- **Nouveau** : Améliorations des métriques avec Railpack

## Migration de Nixpacks vers Railpack

Si vous migrez depuis Nixpacks :

1. **Railpack est activé par défaut** sur les nouveaux projets
2. **Pour forcer Railpack** : Supprimez `NIXPACKS_BUILDER=true` des variables d'environnement
3. **Pour revenir à Nixpacks** : Ajoutez `NIXPACKS_BUILDER=true` dans les variables d'environnement
4. **Fichiers de configuration** : Les deux systèmes sont supportés simultanément

## URLs

Une fois déployé, votre API sera accessible sur :

- `https://your-project.railway.app/health` - Health check
- `https://your-project.railway.app/api/tables` - Liste des tables
- `https://your-project.railway.app/api/stats` - Statistiques du cache

## Troubleshooting

### Erreurs courantes

1. **Erreur de connexion Redis** : Vérifiez `REDIS_URL`
2. **Erreur Airtable** : Vérifiez `AIRTABLE_API_KEY` et `AIRTABLE_BASE_ID`
3. **Schéma Airtable manquant** : Le service génère automatiquement le schéma au démarrage
4. **Port déjà utilisé** : Railway gère automatiquement le port via `PORT`

### Logs

Consultez les logs dans le dashboard Railway ou via CLI :

```bash
railway logs
```

## Sécurité

- Ne commitez jamais les clés API dans le code
- Utilisez les variables d'environnement Railway
- Activez l'authentification API si nécessaire
- Configurez les CORS appropriés pour votre domaine
