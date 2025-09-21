# Aircache

Un outil pour générer et mettre en cache des données Airtable.

## Configuration

### 1. Variables d'environnement

Copiez le fichier `env.example` vers `.env` et configurez vos variables :

```bash
cp env.example .env
```

Remplissez les valeurs suivantes dans `.env` :
- `AIRTABLE_API_KEY` : Votre clé API Airtable
- `AIRTABLE_BASE_ID` : L'ID de votre base Airtable
- `AIRTABLE_WORKSPACE_ID` : L'ID de votre workspace (optionnel)

### 2. Configuration Airtable

Copiez les fichiers de configuration :
```bash
cp src/airtable/config.example.ts src/airtable/config.ts
cp src/airtable/schema.example.ts src/airtable/schema.ts
```

Puis adaptez les fichiers selon vos besoins.

## Sécurité

⚠️ **Important** : Les fichiers suivants contiennent des informations sensibles et ne doivent PAS être commités :

- `.env`
- `src/airtable/config.ts`
- `src/airtable/schema.ts`
- `src/airtable/secrets.ts`
- `airtable-config.json`
- `airtable-schema.json`
- Dossier `cache/`

Ces fichiers sont automatiquement exclus par le `.gitignore`.

## Structure recommandée

```
src/airtable/
├── config.example.ts    # Template de configuration
├── config.ts           # Configuration réelle (gitignoré)
├── schema.example.ts   # Template de schéma
├── schema.ts          # Schéma réel (gitignoré)
├── client.ts          # Client Airtable
├── cache.ts           # Logique de cache
└── types.ts           # Types TypeScript
```

## Développement

1. Installez les dépendances
2. Configurez vos variables d'environnement
3. Copiez et adaptez les fichiers de configuration
4. Lancez le développement