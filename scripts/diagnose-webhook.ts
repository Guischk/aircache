#!/usr/bin/env bun
/**
 * Script pour diagnostiquer les webhooks Airtable
 * Vérifie la configuration et affiche des informations de debug
 */

import { config } from "../src/config";

console.log("🔍 Diagnostic des webhooks Airtable\n");

console.log("Configuration actuelle:");
console.log("=".repeat(50));

console.log("\n✓ Variables d'environnement requises:");
console.log(
	`  AIRTABLE_PERSONAL_TOKEN: ${config.airtableToken ? "✓ Défini" : "✗ Manquant"}`,
);
console.log(`  AIRTABLE_BASE_ID: ${config.airtableBaseId || "✗ Manquant"}`);
console.log(
	`  BEARER_TOKEN: ${config.bearerToken ? "✓ Défini" : "✗ Manquant"}`,
);

console.log("\n🔐 Configuration webhook:");
console.log(
	`  WEBHOOK_SECRET: ${config.webhookSecret ? `✓ Défini (${config.webhookSecret.length} caractères)` : "✗ MANQUANT - REQUIS POUR LES WEBHOOKS"}`,
);
console.log(
	`  WEBHOOK_PUBLIC_URL: ${config.webhookPublicUrl || "✗ Non défini"}`,
);
console.log(`  WEBHOOK_RATE_LIMIT: ${config.webhookRateLimit}s`);
console.log(`  WEBHOOK_TIMESTAMP_WINDOW: ${config.webhookTimestampWindow}s`);
console.log(`  WEBHOOK_AUTO_SETUP: ${config.webhookAutoSetup}`);

console.log("\n⚙️  Configuration serveur:");
console.log(`  PORT: ${config.port}`);
console.log(`  REFRESH_INTERVAL: ${config.refreshInterval}s`);
console.log(`  LOG_LEVEL: ${config.logLevel}`);

console.log(`\n${"=".repeat(50)}`);

if (!config.webhookSecret) {
	console.error("\n❌ ERREUR CRITIQUE:");
	console.error("   Le WEBHOOK_SECRET n'est pas configuré !");
	console.error(
		"\n   Sans ce secret, les webhooks Airtable seront rejetés avec un 401.",
	);
	console.error("\n   Pour corriger:");
	console.error("   1. Générer un secret: openssl rand -hex 32");
	console.error(
		"   2. L'ajouter à vos variables Railway: WEBHOOK_SECRET=<votre-secret>",
	);
	console.error("   3. Recréer le webhook Airtable avec ce secret");
	process.exit(1);
}

if (!config.webhookPublicUrl) {
	console.warn("\n⚠️  AVERTISSEMENT:");
	console.warn("   WEBHOOK_PUBLIC_URL n'est pas défini.");
	console.warn("   L'auto-configuration des webhooks ne fonctionnera pas.");
	console.warn("\n   Pour corriger:");
	console.warn(
		"   Ajouter à Railway: WEBHOOK_PUBLIC_URL=https://votre-app.railway.app",
	);
}

console.log("\n✅ Configuration valide pour les webhooks");
console.log("\n📝 Pour tester un webhook localement:");
console.log("   chmod +x debug-webhook.sh");
console.log("   ./debug-webhook.sh http://localhost:3000");
console.log("\n📝 Pour tester un webhook en production:");
console.log(
	`   ./debug-webhook.sh ${config.webhookPublicUrl || "https://votre-app.railway.app"}`,
);
