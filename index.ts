/**
 * Point d'entrée principal du service Aircache
 * Détecte automatiquement le backend (Redis/SQLite) et démarre le serveur approprié
 */

import { startServer } from "./src/server/index";

// Démarrage du serveur avec détection automatique du backend
await startServer();