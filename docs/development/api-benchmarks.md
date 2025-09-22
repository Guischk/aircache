# 🏁 API de Benchmark en Production

Guide d'utilisation de la route `/api/benchmark` pour exécuter des tests de performance directement depuis l'API en production.

## 🎯 Objectif

Cette route permet d'exécuter des benchmarks de performance sur tous les endpoints de l'API directement depuis l'environnement de production, sans avoir besoin d'outils externes.

## 🚀 Utilisation

### Endpoint

```
GET /api/benchmark
```

### Authentification

Requiert un Bearer Token dans les headers :
```
Authorization: Bearer YOUR_BEARER_TOKEN
```

### Paramètres de requête

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `type` | string | "performance" | Type de benchmark (performance, load, stress) |
| `requests` | number | 100 | Nombre total de requêtes à exécuter |
| `concurrent` | number | 10 | Nombre de requêtes simultanées |
| `table` | string | première table | Nom de la table pour les tests spécifiques |

### Exemples d'utilisation

#### Benchmark basique
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-api.com/api/benchmark"
```

#### Benchmark avec paramètres personnalisés
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-api.com/api/benchmark?requests=200&concurrent=20&type=load"
```

#### Benchmark sur une table spécifique
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-api.com/api/benchmark?table=MyTable&requests=50&concurrent=5"
```

## 📊 Endpoints testés

Le benchmark teste automatiquement les endpoints suivants :

1. **`/health`** - Health check (sans authentification)
2. **`/api/tables`** - Liste des tables
3. **`/api/stats`** - Statistiques du cache
4. **`/api/tables/:tableName`** - Records d'une table spécifique

## 📈 Réponse

La réponse contient des métriques détaillées pour chaque endpoint :

```json
{
  "success": true,
  "data": {
    "type": "performance",
    "totalTime": 2340,
    "totalRequests": 400,
    "totalSuccess": 398,
    "totalErrors": 2,
    "successRate": 99.5,
    "results": [
      {
        "endpoint": "/health",
        "name": "Health Check",
        "requests": 100,
        "successCount": 100,
        "errorCount": 0,
        "avgResponseTime": 12.5,
        "minResponseTime": 8,
        "maxResponseTime": 25,
        "p95ResponseTime": 18,
        "requestsPerSecond": 42.5,
        "errors": []
      }
      // ... autres endpoints
    ],
    "config": {
      "requests": 100,
      "concurrent": 10,
      "tableName": "MyTable",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:02.340Z",
    "namespace": "v1",
    "benchmarkType": "performance",
    "totalTime": 2340
  }
}
```

## 🔧 Métriques calculées

Pour chaque endpoint testé :

- **`requests`** - Nombre de requêtes envoyées
- **`successCount`** - Nombre de requêtes réussies
- **`errorCount`** - Nombre d'erreurs
- **`avgResponseTime`** - Temps de réponse moyen (ms)
- **`minResponseTime`** - Temps de réponse minimum (ms)
- **`maxResponseTime`** - Temps de réponse maximum (ms)
- **`p95ResponseTime`** - 95ème percentile des temps de réponse (ms)
- **`requestsPerSecond`** - Throughput (req/s)
- **`errors`** - Liste des erreurs rencontrées (max 10)

## ⚠️ Limitations et bonnes pratiques

### Limitations automatiques

- Les endpoints avec authentification sont limités à 50 requêtes maximum
- Les endpoints sans authentification sont limités à 200 requêtes maximum
- Maximum 20 requêtes simultanées pour les endpoints avec auth
- Maximum 50 requêtes simultanées pour les endpoints sans auth

### Bonnes pratiques

1. **Utilisez des paramètres raisonnables** pour éviter de surcharger le serveur
2. **Testez pendant les heures creuses** pour minimiser l'impact sur les utilisateurs
3. **Surveillez les logs** pour détecter d'éventuelles surcharges
4. **Limitez la fréquence** des benchmarks en production

### Exemples de configurations recommandées

#### Test rapide (30 secondes)
```bash
?requests=50&concurrent=5
```

#### Test de charge modérée (2-3 minutes)
```bash
?requests=200&concurrent=10
```

#### Test de stress (5+ minutes)
```bash
?requests=500&concurrent=20
```

## 🚨 Sécurité

- **Authentification requise** - Seuls les utilisateurs avec un token valide peuvent exécuter des benchmarks
- **Rate limiting** - Les paramètres sont limités pour éviter les abus
- **Logs détaillés** - Toutes les tentatives de benchmark sont loggées
- **Isolation** - Les benchmarks n'affectent pas les données réelles

## 🔍 Monitoring

Le benchmark génère des logs détaillés :

```
🏁 Starting benchmark: performance (100 requests, 10 concurrent)
✅ Benchmark completed in 2340ms - 398/400 successful (99.5%)
```

Ces logs peuvent être utilisés pour :
- Surveiller les performances en temps réel
- Détecter les dégradations de performance
- Planifier les optimisations
- Vérifier l'efficacité du cache Redis

## 🛠️ Intégration avec des outils de monitoring

La réponse JSON peut être facilement intégrée avec :

- **Grafana** - Pour des dashboards de performance
- **Prometheus** - Pour des métriques de monitoring
- **Datadog/New Relic** - Pour des alertes automatiques
- **Scripts personnalisés** - Pour des rapports automatisés

### Exemple d'intégration Prometheus

```bash
# Exécuter le benchmark et extraire les métriques
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/benchmark?requests=100" | \
  jq '.data.results[] | select(.endpoint=="/health") | 
      "health_response_time_avg \(.avgResponseTime)"'
```
