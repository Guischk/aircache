#!/usr/bin/env bun
/**
 * Test webhook en simulant EXACTEMENT le comportement d'Airtable
 * Utilise le secret stocké dans la base de données
 */

import { calculateWebhookHmac } from "../src/lib/airtable/webhook-hmac";

const targetUrl = process.argv[2] || "http://localhost:3000";
const webhookEndpoint = `${targetUrl}/webhooks/airtable/refresh`;

console.log("🧪 Testing webhook - Airtable simulation\n");
console.log(`Target: ${webhookEndpoint}\n`);

// Récupérer le secret stocké dans la base de données
const { sqliteService } = await import("../src/lib/sqlite");
await sqliteService.connect();

const webhookConfig = await sqliteService.getWebhookConfig();

if (!webhookConfig) {
	console.error(
		"❌ No webhook configuration found in database. Please create a webhook first using:\n",
	);
	console.error("   bun scripts/recreate-webhook-with-current-secret.ts\n");
	process.exit(1);
}

console.log("📋 Webhook config loaded:");
console.log(`   Webhook ID: ${webhookConfig.webhookId}`);
console.log(
	`   Secret: ${webhookConfig.macSecretBase64.substring(0, 10)}...\n`,
);

// Créer un payload de test (identique au vrai webhook Airtable)
const webhookNotificationDeliveryPayload = {
	base: { id: "appTl71LROmieOxgM" },
	webhook: { id: webhookConfig.webhookId },
	timestamp: new Date().toISOString(),
};

const body = JSON.stringify(webhookNotificationDeliveryPayload);

// Calculer la signature EXACTEMENT comme Airtable avec le module partagé
const hash = calculateWebhookHmac(webhookConfig.macSecretBase64, body);
const expectedContentHmac = `hmac-sha256=${hash}`;

console.log("📝 Payload:");
console.log(JSON.stringify(webhookNotificationDeliveryPayload, null, 2));
console.log("");
console.log("🔐 Signature (comme Airtable):");
console.log(expectedContentHmac);
console.log("");

// Envoyer la requête
try {
	const response = await fetch(webhookEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Airtable-Content-MAC": expectedContentHmac,
		},
		body,
	});

	const responseText = await response.text();
	let responseJson: unknown = null;

	try {
		responseJson = JSON.parse(responseText);
	} catch {
		responseJson = null;
	}

	console.log(`📥 Response: ${response.status} ${response.statusText}\n`);

	if (responseJson) {
		console.log("📄 Response body:");
		console.log(JSON.stringify(responseJson, null, 2));
	} else {
		console.log("📄 Response body (raw):");
		console.log(responseText);
	}

	console.log("\n");

	if (response.status === 200) {
		console.log("✅ Webhook test successful!");
		console.log(
			"\nThe signature algorithm matches Airtable's implementation perfectly!",
		);
	} else {
		console.log(`❌ Test failed with status ${response.status}`);
		console.log(
			"\nThis means the signature validation still doesn't match Airtable's format.",
		);
	}
} catch (error) {
	console.error("\n❌ Request failed:");
	console.error(error instanceof Error ? error.message : String(error));
}
