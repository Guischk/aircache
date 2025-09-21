# 🧪 Batterie de Tests Aircache

Cette suite de tests complète garantit la qualité, la sécurité et les performances du projet Aircache avant sa publication.

## 📋 Vue d'ensemble

La batterie de tests couvre tous les aspects critiques du projet :

- **Tests API** : Fonctionnalités de base et endpoints
- **Tests d'intégration** : Workflows complets end-to-end
- **Tests de sécurité** : Vulnérabilités et protections
- **Tests de performance** : Benchmarks et charge
- **Tests de validation** : Cohérence des données

## 🚀 Utilisation

### Exécution complète
```bash
# Tous les tests dans l'ordre
bun run test:all

# Tests avec validation de sécurité
bun run validate

# Tests avant publication
bun run publish:check
```

### Tests individuels
```bash
# Tests API uniquement
bun run test:api

# Tests d'intégration
bun run test:integration

# Tests de sécurité
bun run test:security

# Tests de performance
bun run test:performance
```

### Mode développement
```bash
# Tests en mode watch
bun run test:watch

# Tests avec coverage
bun run test:coverage
```

## 📁 Structure des Tests

```
tests/
├── README.md              # Cette documentation
├── test-config.ts         # Configuration partagée
├── api.test.ts            # Tests API (unitaires + fonctionnels)
├── integration.test.ts    # Tests d'intégration E2E
├── security.test.ts       # Tests de sécurité
├── performance.test.ts    # Tests de performance
└── unit/                  # Tests unitaires (futur)
    └── ...
```

## 🏗️ Configuration

### Variables d'environnement
```bash
# Token d'authentification pour les tests
BEARER_TOKEN=test-token

# Activer/désactiver certains types de tests
ENABLE_PERFORMANCE_TESTS=true
ENABLE_INTEGRATION_TESTS=true
ENABLE_SECURITY_TESTS=true

# Concurrence des tests
TEST_CONCURRENCY=5
```

### Configuration des tests
Voir `tests/test-config.ts` pour la configuration détaillée :

- Timeout des tests
- Nombre de tentatives
- Limites de performance
- Paramètres de sécurité

## 📊 Tests Inclus

### 1. Tests API (`api.test.ts`)

#### ✅ Couverture :
- **Health Check** : Statut du service
- **Refresh Endpoint** : Tests complets du refresh manuel
- **Authentication** : Tokens valides/invalides
- **Tables Endpoint** : Liste et validation des tables
- **Stats Endpoint** : Statistiques du cache
- **Records Endpoint** : Accès aux données
- **CORS Headers** : Configuration des headers
- **Error Handling** : Gestion des erreurs

#### ✅ Méthodes testées :
- GET, POST, OPTIONS
- Authentification Bearer
- Paramètres de requête
- Pagination et filtrage

### 2. Tests d'Intégration (`integration.test.ts`)

#### ✅ Workflows testés :
- **Workflow complet** : Health → Tables → Stats → Records
- **Cohérence des données** : Entre différents endpoints
- **Pagination** : Gestion des pages de résultats
- **Filtrage des champs** : Projection des données
- **Performance** : Temps de réponse acceptables
- **Récupération d'erreurs** : Robustesse du service

### 3. Tests de Sécurité (`security.test.ts`)

#### ✅ Vulnérabilités testées :
- **SQL Injection** : Injection dans les paramètres
- **XSS Protection** : Échappement HTML
- **Authentication Bypass** : Contournement de l'auth
- **Rate Limiting** : Limitation du trafic
- **HTTP Methods** : Méthodes autorisées
- **Information Disclosure** : Fuite d'informations
- **Input Validation** : Validation des paramètres
- **CORS Security** : Configuration des origines

### 4. Tests de Performance (`performance.test.ts`)

#### ✅ Benchmarks :
- **Temps de réponse** : < 100ms pour health, < 500ms pour tables
- **Débit** : > 10 RPS minimum, > 20 RPS sous charge
- **Charge** : Support de 20 utilisateurs simultanés
- **Stress** : Récupération après charge élevée
- **Mémoire** : Pas de fuite mémoire
- **Concurrency** : Gestion des requêtes parallèles

## 🎯 Critères de Réussite

### Tests requis (doivent passer)
- ✅ Tous les tests API
- ✅ Tous les tests d'intégration
- ✅ Tous les tests de sécurité

### Tests optionnels (recommandés)
- ✅ Tests de performance (si activés)

### Scores de qualité
- **Score global** : > 95% de réussite
- **Score sécurité** : 100% de réussite
- **Score performance** : > 80% de réussite

## 📈 Métriques de Performance

### Temps de réponse cibles
| Endpoint | 95th percentile | Moyenne |
|----------|----------------|---------|
| `/health` | < 200ms | < 100ms |
| `/api/tables` | < 1s | < 500ms |
| `/api/stats` | < 500ms | < 300ms |
| `/api/refresh` | < 3s | < 2s |

### Charge supportée
- **Utilisateurs simultanés** : 50+
- **Requêtes par seconde** : 20+ RPS soutenu
- **Taux de succès** : > 95% sous charge

## 🛡️ Tests de Sécurité

### Injection SQL
- ✅ Noms de tables malveillants
- ✅ IDs de records malveillants
- ✅ Paramètres de requête

### XSS
- ✅ Échappement HTML dans les réponses
- ✅ Validation des headers

### Authentification
- ✅ Tokens invalides rejetés
- ✅ Headers malformés rejetés
- ✅ Requêtes sans auth rejetées

### Rate Limiting
- ✅ Support de charge élevée
- ✅ Dégradation gracieuse

## 🔧 Résolution des Problèmes

### Tests échouent
1. Vérifier la configuration : `bun run test:api`
2. Vérifier les logs du serveur
3. Vérifier les variables d'environnement
4. Vérifier la base de données

### Performance dégradée
1. Vérifier les ressources système
2. Vérifier la base de données SQLite
3. Vérifier les connexions réseau
4. Redémarrer le serveur de test

### Tests de sécurité échouent
1. Vérifier la configuration d'auth
2. Vérifier les headers CORS
3. Vérifier la validation des entrées
4. Examiner les logs de sécurité

## 📝 Logs et Rapports

### Logs de test
Les logs détaillés sont affichés pendant l'exécution :
```bash
bun run test:all
```

### Rapports
- **JUnit** : `test-results.xml` (pour CI/CD)
- **Coverage** : Disponible avec `bun run test:coverage`
- **Performance** : Logs dans la console

## 🚀 CI/CD Integration

### GitHub Actions
```yaml
- name: Run Tests
  run: bun run test:all

- name: Security Check
  run: bun run security-check

- name: Performance Test
  run: bun run test:performance
```

### Pré-publication
```bash
bun run publish:check  # Exécute tous les tests + sécurité
```

## 📚 Ressources Supplémentaires

- [Documentation API](../README.md)
- [Guide de déploiement](../docs/DEPLOYMENT.md)
- [Configuration de sécurité](../src/api/auth.ts)

---

**🎉 Prêt pour la publication** quand tous les tests passent !
