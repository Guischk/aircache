#!/usr/bin/env bun
/**
 * Script pour afficher le secret webhook à utiliser dans Railway
 * Compare le secret configuré localement avec celui attendu par Airtable
 */

import { config } from "../src/config";

console.log("🔐 Secret webhook - Configuration\n");
console.log("=".repeat(60));

if (!config.webhookSecret) {
	console.error("\n❌ WEBHOOK_SECRET n'est pas configuré !");
	console.error("\nPour créer un nouveau secret :");
	console.error("  openssl rand -hex 32\n");
	process.exit(1);
}

const secret = config.webhookSecret;

console.log("\n📝 Secret actuel (WEBHOOK_SECRET):");
console.log(`   Format: ${/^[0-9a-f]+$/i.test(secret) ? "Hex" : "String"}`);
console.log(`   Longueur: ${secret.length} caractères`);
console.log(`   Valeur: ${secret}`);

// Convert to base64 (ce qu'Airtable va utiliser)
let secretBase64: string;
if (/^[0-9a-f]+$/i.test(secret)) {
	// Hex format - convert to buffer then base64
	const buffer = Buffer.from(secret, "hex");
	secretBase64 = buffer.toString("base64");
} else {
	// Plain string - convert directly to base64
	secretBase64 = Buffer.from(secret, "utf-8").toString("base64");
}

console.log("\n🔄 Version base64 (utilisée par Airtable):");
console.log(`   Valeur: ${secretBase64}`);

console.log(`\n${"=".repeat(60)}`);
console.log("\n✅ Configuration correcte pour Railway :");
console.log("\n   Ajouter cette variable d'environnement :");
console.log(`   WEBHOOK_SECRET=${secret}`);
console.log("\n   ⚠️  Utilisez la version HEX, PAS la version base64 !");

console.log(`\n${"=".repeat(60)}`);
console.log("\n🧪 Pour tester le webhook :");
console.log(
	"   bun run scripts/manage-webhooks.ts test https://aircache-production.up.railway.app",
);
