#!/usr/bin/env bun
/**
 * Test webhook en simulant EXACTEMENT le comportement d'Airtable
 * Utilise le même algorithme que la doc Airtable
 */

import { createHmac } from "node:crypto";
import { config } from "../src/config";

const targetUrl = process.argv[2] || "http://localhost:3000";
const webhookEndpoint = `${targetUrl}/webhooks/airtable/refresh`;

console.log("🧪 Testing webhook - Airtable simulation\n");
console.log(`Target: ${webhookEndpoint}\n`);

// Convertir le secret hex en base64 (comme on fait lors de la création)
let macSecretBase64: string;
if (/^[0-9a-f]+$/i.test(config.webhookSecret)) {
	const buffer = Buffer.from(config.webhookSecret, "hex");
	macSecretBase64 = buffer.toString("base64");
} else {
	macSecretBase64 = Buffer.from(config.webhookSecret, "utf-8").toString(
		"base64",
	);
}

console.log("Secret (base64):", macSecretBase64);
console.log("");

// Créer un payload de test (identique au vrai webhook Airtable)
const webhookNotificationDeliveryPayload = {
	base: { id: "appTl71LROmieOxgM" },
	webhook: { id: "achsZC0KQajN2BcKc" },
	timestamp: new Date().toISOString(),
};

// Calculer la signature EXACTEMENT comme Airtable (selon leur doc)
const macSecretDecoded = Buffer.from(macSecretBase64, "base64");
const body = Buffer.from(
	JSON.stringify(webhookNotificationDeliveryPayload),
	"utf8",
);
const hmac = createHmac("sha256", macSecretDecoded);
hmac.update(body.toString(), "ascii");
const expectedContentHmac = `hmac-sha256=${hmac.digest("hex")}`;

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
		body: JSON.stringify(webhookNotificationDeliveryPayload),
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
