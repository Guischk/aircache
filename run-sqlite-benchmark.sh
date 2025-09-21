#!/bin/bash

# Script pour démarrer le serveur API SQLite et lancer le benchmark avec logs

echo "🚀 Démarrage du benchmark SQLite avec logs API"
echo "=============================================="

# Vérifier que bun est installé
if ! command -v bun &> /dev/null; then
    echo "❌ Bun n'est pas installé. Veuillez installer Bun d'abord."
    exit 1
fi

# Variables d'environnement
export API_BASE="http://localhost:3000/"
export BEARER_TOKEN="${BEARER_TOKEN:-test-token}"

echo "📋 Configuration:"
echo "   API_BASE: $API_BASE"
echo "   BEARER_TOKEN: ${BEARER_TOKEN:0:10}..."
echo ""

# Fonction pour nettoyer les processus en arrière-plan
cleanup() {
    echo ""
    echo "🧹 Nettoyage des processus..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        echo "✅ Serveur API arrêté"
    fi
    exit 0
}

# Capturer Ctrl+C pour nettoyer
trap cleanup INT

echo "🔄 Démarrage du serveur API SQLite en arrière-plan..."
bun run dev &
SERVER_PID=$!

# Attendre que le serveur démarre
echo "⏳ Attente du démarrage du serveur..."
sleep 3

# Vérifier que le serveur répond
echo "🔍 Vérification de la disponibilité de l'API..."
for i in {1..10}; do
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "✅ Serveur API disponible"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Serveur API non disponible après 10 tentatives"
        cleanup
        exit 1
    fi
    echo "   Tentative $i/10..."
    sleep 1
done

echo ""
echo "🏁 Lancement du benchmark SQLite vs Airtable..."
echo "==============================================="
echo ""

# Lancer le benchmark
bun run tests/sqlite-vs-airtable.benchmark.ts

# Nettoyer
cleanup
