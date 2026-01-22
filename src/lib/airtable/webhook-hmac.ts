/**
 * Module partagé pour le calcul HMAC des webhooks Airtable
 * Garantit que le même algorithme est utilisé pour la création et la validation
 *
 * Référence: https://airtable.com/developers/web/api/webhooks-overview#hmac-validation
 */

import { createHmac } from "node:crypto";

/**
 * Calcule le HMAC SHA-256 pour un webhook Airtable
 * Utilise EXACTEMENT le même algorithme que dans la doc Airtable
 *
 * @param secretBase64 - Le secret du webhook en base64 (comme retourné par Airtable)
 * @param body - Le body JSON du webhook (string)
 * @returns Le hash HMAC en hex (sans préfixe)
 */
export function calculateWebhookHmac(
	secretBase64: string,
	body: string,
): string {
	// 1. Décoder le secret depuis base64 (obtenir le buffer binaire)
	const secretDecoded = Buffer.from(secretBase64, "base64");

	// 2. Convertir le body en Buffer UTF-8
	const bodyBuffer = Buffer.from(body, "utf8");

	// 3. Calculer le HMAC exactement comme Airtable
	const hmac = createHmac("sha256", new Uint8Array(secretDecoded));
	hmac.update(new Uint8Array(bodyBuffer));

	// 4. Retourner le hash en hex (sans préfixe)
	return hmac.digest("hex");
}
