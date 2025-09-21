# 🔒 Sécurité des Données - Aircache

Guide des bonnes pratiques de sécurité pour protéger les données de production.

## 🚨 Informations Sensibles

Ce projet utilise des données Airtable de production. Les informations suivantes sont **strictement confidentielles** :

### ❌ À NE JAMAIS exposer

- **Noms de tables Airtable** réels
- **Structure du schéma** business
- **Nombres d'enregistrements** exacts
- **Noms de champs** spécifiques
- **Données de contenu** réelles

### ✅ Informations acceptables

- **Ordres de grandeur** (~5, ~50, ~500 records)
- **Types de tables** (Small, Medium, Large)
- **Métriques de performance** anonymisées
- **Architecture technique** générique

## 📁 Fichiers Protégés

### Automatiquement git-ignorés

```
# Configuration sensible
.env
src/lib/airtable/schema.ts
src/lib/airtable/config.ts

# Rapports contenant des données réelles
*-report.md
*-comparison.md
redis-vs-airtable-comparison.md
```

### ⚠️ Attention particulière

- **Tests unitaires** : Utiliser des références dynamiques
- **Documentation** : Exemples génériques uniquement
- **Benchmarks** : Noms de tables anonymisés
- **Logs** : Pas de données business

## 🛡️ Mesures de Protection

### 1. Anonymisation Automatique

Les benchmarks utilisent automatiquement des aliases :

- `Table réelle` → `Small Table`
- `Autre table` → `Medium Table`
- `Grande table` → `Large Table`

### 2. Tests Dynamiques

```typescript
// ❌ Hardcodé - DANGEREUX
const result = await apiRequest("/api/tables/Users");

// ✅ Dynamique - SÉCURISÉ
const tables = await apiRequest("/api/tables");
const firstTable = tables.data.tables[0];
const result = await apiRequest(`/api/tables/${firstTable}`);
```

### 3. Rapports Anonymes

Tous les rapports générés incluent :

- Avertissement de sécurité en en-tête
- Noms de tables anonymisés
- Métriques sans contexte business

## 🔍 Vérification de Sécurité

### Avant chaque commit

```bash
# Vérifier qu'aucune donnée sensible n'est exposée
grep -r "VotreTableReelle" . --exclude-dir=node_modules
grep -r "NomChampSensible" . --exclude-dir=node_modules

# Nettoyer les rapports générés
bun run clean
```

### Checklist pré-commit

- [ ] Aucun nom de table business dans le code
- [ ] Tests utilisant des références dynamiques
- [ ] Documentation avec exemples génériques
- [ ] Rapports exclus du git
- [ ] Variables sensibles dans .env uniquement

## 🧪 Tests Sécurisés

### Principe général

```typescript
// Récupérer les tables dynamiquement
const availableTables = AIRTABLE_TABLE_NAMES;

// Utiliser des indexes plutôt que des noms
const smallTable = availableTables[0]; // Table la plus petite
const mediumTable = availableTables[1]; // Table moyenne
const largeTable = availableTables[2]; // Table la plus grande
```

### Métriques autorisées

- **Temps de réponse** (ms)
- **Throughput** (req/s)
- **Taux de succès** (%)
- **Ordres de grandeur** (~10, ~100, ~1000)

### Métriques interdites

- **Nombres exacts** d'enregistrements
- **Noms de champs** spécifiques
- **Valeurs de données** réelles
- **Structure de schéma** détaillée

## 📊 Exemple de Rapport Sécurisé

### ✅ Correct

```markdown
| Table Type | Records | Response Time |
| ---------- | ------- | ------------- |
| Small      | ~10     | 25ms          |
| Medium     | ~50     | 45ms          |
| Large      | ~500    | 89ms          |
```

### ❌ Dangereux

```markdown
| Table    | Records | Response Time |
| -------- | ------- | ------------- |
| Users    | 37      | 25ms          |
| Products | 142     | 45ms          |
| Orders   | 1,247   | 89ms          |
```

## 🚀 Mode Production

### Variables d'environnement

```bash
# Mode anonyme activé par défaut
ANONYMIZE_REPORTS=true
MASK_TABLE_NAMES=true

# En développement uniquement
DEBUG_SHOW_REAL_NAMES=false
```

### Déploiement

1. Vérifier que tous les rapports sont git-ignorés
2. S'assurer que seules les métriques anonymes sont exposées
3. Confirmer que les logs ne contiennent pas de données business
4. Valider que les tests n'utilisent pas de noms hardcodés

## 📞 En cas de Fuite

Si des données sensibles sont accidentellement exposées :

1. **Immédiat** : Supprimer le contenu sensible
2. **Git** : Réecrire l'historique si nécessaire
3. **Documentation** : Mettre à jour avec des exemples génériques
4. **Tests** : Convertir en références dynamiques
5. **Rapports** : Régénérer avec anonymisation

## 🎯 Objectif

**Permettre de démontrer les performances du cache Redis sans jamais exposer d'informations business de production.**

Le code doit être :

- ✅ **Réutilisable** sur n'importe quelle base Airtable
- ✅ **Sécurisé** sans données de production exposées
- ✅ **Professionnel** avec des exemples génériques
- ✅ **Démonstratif** des gains de performance
