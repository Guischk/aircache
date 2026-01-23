# 🚀 Scripts Guide - Aircache

Guide des scripts npm disponibles dans le projet.

## 📋 Scripts de développement

### `bun run start`

Démarre le service complet en mode production

```bash
bun run start
# Équivalent à: bun index.ts
```

### `bun run dev`

Démarre en mode développement avec hot reload

```bash
bun run dev
# Équivalent à: bun --hot index.ts
```

### `bun run build`

Build le projet pour la production

```bash
bun run build
# Génère: dist/index.js
```

## 🧪 Scripts de test

### `bun run test`

Lance tous les tests avec Bun test

```bash
bun run test
# Teste tous les fichiers dans tests/
```

### `bun run test:watch`

Lance les tests en mode veille (watch mode)

```bash
bun run test:watch
# Relance les tests à chaque modification
```

### `bun run benchmark`

Benchmark de performances comparatif (SQLite vs Airtable)

```bash
bun run benchmark
# Génère un rapport de performance dans la console
```

## 🛠️ Scripts utilitaires

### `bun run demo`

Démonstration rapide du système

```bash
bun run demo
# Test rapide de connectivité et fonctionnalités
```

### `bun run airtable:types`

Génère les types TypeScript depuis Airtable

```bash
bun run airtable:types
# Génère: src/lib/airtable/schema.ts
```

### `bun run clean`

Nettoie les fichiers générés

```bash
bun run clean
# Supprime: dist/, *.md, rapports de test
```

## 🏃 Workflow typique

### Développement quotidien

```bash
# Démarrer en mode dev
bun run dev

# Dans un autre terminal, tester
bun run test:api

# Générer les types si schéma Airtable modifié
bun run airtable:types
```

### Avant commit

```bash
# Tester tout
bun run test:all

# Build pour vérifier
bun run build

# Nettoyer
bun run clean
```

### Démo/présentation

```bash
# Démarrer le service
bun run start

# Dans un autre terminal, démo
bun run demo
```

## 📊 Rapports générés

Les scripts de test génèrent automatiquement :

- `integration-report.md` - Rapport tests d'intégration
- `performance-report.md` - Benchmark performances
- `dist/` - Build de production

## 💡 Tips

- Utilise `bun run dev` pendant le développement pour le hot reload
- Lance `bun run test:all` avant chaque commit
- `bun run demo` est parfait pour vérifier que tout fonctionne
- `bun run clean` pour nettoyer avant un build propre
