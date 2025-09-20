# 🏁 Benchmark Redis vs Airtable

Guide d'utilisation du benchmark comparatif entre le cache Redis et l'API Airtable directe.

## 🎯 Objectif

Ce benchmark démontre la valeur ajoutée du cache Redis en comparant :

- **Performance** : Temps de réponse et throughput
- **Fiabilité** : Taux de succès et gestion d'erreurs
- **Scalabilité** : Capacité à gérer la charge

## 🚀 Lancement du benchmark

### Prérequis

1. **Serveur démarré**

```bash
bun run start
# Ou en mode dev: bun run dev
```

2. **Variables d'environnement configurées**

```bash
# .env requis :
AIRTABLE_PERSONAL_TOKEN=your-token
AIRTABLE_BASE_ID=your-base-id
REDIS_URL=redis://localhost:6379
BEARER_TOKEN=your-bearer-token
```

### Exécution

```bash
# Benchmark complet Redis vs Airtable
bun run benchmark:redis-vs-airtable

# Alternative directe
bun tests/redis-vs-airtable.benchmark.ts
```

## 📊 Tests effectués

### Tables testées

- **Small Table** (~5-10 records) - Tests de base
- **Medium Table** (~30-50 records) - Performance normale
- **Large Table** (~500+ records) - Tests de charge

### Scénarios

1. **Full Table** - Récupération complète d'une table
2. **Single Record** - Accès à un record spécifique

### Métriques comparées

- ⚡ **Temps de réponse moyen**
- 📈 **Throughput** (requests/sec)
- 🎯 **Latence P95** (percentile 95)
- 🛡️ **Taux de succès**
- ❌ **Nombre d'erreurs**

## 📈 Résultats typiques

### Avantages Redis Cache

- **20-50x plus rapide** sur les gros volumes
- **Pas de rate limiting** (vs 5 req/sec Airtable)
- **Latence stable** et prévisible
- **Haute disponibilité** (pas de dépendance réseau Airtable)

### Cas où Airtable peut être équivalent

- **Très petites tables** (<10 records)
- **Accès très peu fréquent**
- **Données ultra-fraîches requises**

## 📄 Rapport généré

Le benchmark génère automatiquement :

```
redis-vs-airtable-comparison.md
```

### Contenu du rapport

1. **Résumé exécutif** avec facteurs d'amélioration
2. **Tableau comparatif** détaillé
3. **Métriques par test** (Redis vs Airtable)
4. **Recommandations** d'usage
5. **Considérations techniques**

### Exemple de rapport

```markdown
## Performance Comparison Table

| Table Type | Scenario   | Redis Avg (ms) | Airtable Avg (ms) | Speed Factor |
| ---------- | ---------- | -------------- | ----------------- | ------------ |
| Medium     | full-table | 45.2           | 1,204.5           | 26.7x        |
| Large      | full-table | 89.1           | 2,847.2           | 31.9x        |
```

## 🔧 Configuration avancée

### Personnaliser les tests

Modifier le fichier `tests/redis-vs-airtable.benchmark.ts` :

```typescript
// Changer le nombre de requêtes
const redisRequests = 100; // Plus de requêtes pour Redis
const airtableRequests = 20; // Moins pour respecter rate limit

// Tables sélectionnées automatiquement depuis le schéma
const testTables = AIRTABLE_TABLE_NAMES.slice(0, 3);
```

### Rate limiting Airtable

Le benchmark respecte automatiquement :

- **Limite Airtable** : 5 req/sec max
- **Délai entre requêtes** : 250ms minimum
- **Moins de requêtes** pour Airtable (15-20 vs 50 pour Redis)

## 🐛 Dépannage

### "API server not available"

```bash
# Vérifier que le serveur tourne
curl http://localhost:3000/health

# Redémarrer si nécessaire
bun run start
```

### "Table not found in schema"

```bash
# Mettre à jour le schéma Airtable
bun run airtable:types

# Vérifier les tables disponibles
curl -H "Authorization: Bearer your-token" \\
     http://localhost:3000/api/tables
```

### Erreurs Airtable

- Vérifier `AIRTABLE_PERSONAL_TOKEN`
- Vérifier `AIRTABLE_BASE_ID`
- Vérifier les permissions sur la base

## 💡 Conseils d'utilisation

### Pour une démo

```bash
# Benchmark rapide (résultats en ~2 minutes)
bun run benchmark:redis-vs-airtable
```

### Pour un benchmark détaillé

- Modifier le nombre de requêtes dans le code
- Tester avec différentes tailles de tables
- Exécuter plusieurs fois pour moyenner

### Intégration CI/CD

```bash
# Dans un pipeline
bun run start &
sleep 10
bun run benchmark:redis-vs-airtable
kill $!
```

## 📊 Interprétation des résultats

### Facteurs de performance Redis

- **Cache hit** : Données déjà en mémoire Redis
- **Pas de réseau** : Pas d'appel API externe
- **Optimisations** : Structures de données optimisées

### Cas d'usage recommandés

- ✅ **Applications temps réel** → Redis
- ✅ **APIs publiques** → Redis
- ✅ **Dashboards** → Redis
- ⚠️ **Admin tools** → Airtable direct possible
- ⚠️ **Batch jobs** → Airtable direct possible

Le benchmark démontre clairement l'intérêt du cache Redis pour des applications nécessitant de bonnes performances et une haute disponibilité.
