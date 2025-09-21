#!/bin/bash

# Script pour tester les logs API SQLite

echo "🧪 Test des logs API SQLite"
echo "============================"

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
bun run dev:sqlite &
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
echo "🧪 Lancement du test des logs API..."
echo "===================================="
echo ""

# Lancer le test des logs API
bun run test-api-logs.ts

echo ""
echo "💡 Vérifiez les logs du serveur API ci-dessus pour voir les messages de logging."
echo "   Les logs devraient inclure:"
echo "   - < GET /health (SQLite)"
echo "   - ✅ Auth success - GET /api/tables"
echo "   - 📋 Tables list requested (SQLite)"
echo "   - etc."

# Nettoyer
cleanup
