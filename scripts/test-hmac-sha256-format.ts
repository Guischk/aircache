#!/usr/bin/env bun
/**
 * Test webhook avec le format hmac-sha256= utilisé par Airtable
 */

import { config } from "../src/config";

const targetUrl = process.argv[2] || "http://localhost:3000";
const webhookEndpoint = `${targetUrl}/webhooks/airtable/refresh`;

console.log("🧪 Testing webhook with hmac-sha256= format (Airtable format)\n");
console.log(`Target: ${webhookEndpoint}`);

// Créer un payload de test
const timestamp = new Date().toISOString();
const payload = {
	timestamp,
	baseTransactionNumber: 123,
	webhookId: `test-${Date.now()}`,
};

const payloadString = JSON.stringify(payload);

// Calculer la signature HMAC
const encoder = new TextEncoder();
const keyData = encoder.encode(config.webhookSecret);
const bodyData = encoder.encode(payloadString);

const hmac = new Bun.CryptoHasher("sha256", keyData)
	.update(bodyData)
	.digest("hex");

// Utiliser le format hmac-sha256= comme Airtable
const signature = `hmac-sha256=${hmac}`;

console.log(`Signature: ${signature}\n`);

try {
	const response = await fetch(webhookEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Airtable-Content-MAC": signature,
		},
		body: payloadString,
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
			"\nThe hmac-sha256= format is correctly supported (Airtable format)",
		);
	} else {
		console.log(`❌ Test failed with status ${response.status}`);
	}
} catch (error) {
	console.error("\n❌ Request failed:");
	console.error(error instanceof Error ? error.message : String(error));
}
