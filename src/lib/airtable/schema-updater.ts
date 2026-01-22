/**
 * Updater simple pour le schéma Airtable
 * Exécute la commande airtable-types-gen avec gestion d'erreurs basique
 */

import { loggers } from "../logger";

const logger = loggers.schema;

/**
 * Met à jour le schéma Airtable en exécutant airtable-types-gen
 * @returns Promise<boolean> - true si succès, false si échec
 */
export async function updateAirtableSchema(): Promise<boolean> {
	try {
		logger.start("Début mise à jour du schéma Airtable...");

		// Exécution de la commande airtable-types-gen
		const result = await Bun.$`bun run airtable:types`.quiet();

		if (result.exitCode === 0) {
			logger.success("Schéma Airtable mis à jour avec succès");
			return true;
		}

		logger.error("Échec de la mise à jour du schéma Airtable", {
			stdout: result.stdout.toString(),
			stderr: result.stderr.toString(),
		});
		return false;
	} catch (error) {
		logger.error("Erreur lors de la mise à jour du schéma:", error);
		return false;
	}
}

/**
 * Met à jour le schéma de manière conditionnelle avec retry
 * @param maxRetries - Nombre maximum de tentatives (défaut: 2)
 * @returns Promise<boolean> - true si succès, false si échec définitif
 */
export async function updateSchemaWithRetry(maxRetries = 2): Promise<boolean> {
	let attempts = 0;

	while (attempts < maxRetries) {
		attempts++;

		logger.info("Tentative de mise à jour du schéma", {
			attempt: attempts,
			maxRetries,
		});

		const success = await updateAirtableSchema();

		if (success) {
			return true;
		}

		if (attempts < maxRetries) {
			logger.info("Attente 3s avant retry...");
			await Bun.sleep(3000);
		}
	}

	logger.error("Échec définitif après tentatives", { maxRetries });
	return false;
}

/**
 * Vérifie si le schéma existe et est accessible
 * @returns Promise<boolean> - true si le schéma est OK
 */
export async function validateSchema(): Promise<boolean> {
	try {
		// Tentative d'import du schéma pour vérifier qu'il est valide
		await import("./schema.ts");
		logger.success("Schéma Airtable validé");
		return true;
	} catch (error) {
		logger.error("Erreur de validation du schéma:", error);
		return false;
	}
}
