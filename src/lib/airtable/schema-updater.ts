/**
 * Updater simple pour le schéma Airtable
 * Exécute la commande airtable-types-gen avec gestion d'erreurs basique
 */

/**
 * Met à jour le schéma Airtable en exécutant airtable-types-gen
 * @returns Promise<boolean> - true si succès, false si échec
 */
export async function updateAirtableSchema(): Promise<boolean> {
  try {
    console.log("🔄 Début mise à jour du schéma Airtable...");

    // Exécution de la commande airtable-types-gen
    const result = await Bun.$`bun run airtable:types`.quiet();

    if (result.exitCode === 0) {
      console.log("✅ Schéma Airtable mis à jour avec succès");
      return true;
    } else {
      console.error("❌ Échec de la mise à jour du schéma Airtable");
      console.error("Stdout:", result.stdout.toString());
      console.error("Stderr:", result.stderr.toString());
      return false;
    }

  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du schéma:", error);
    return false;
  }
}

/**
 * Met à jour le schéma de manière conditionnelle avec retry
 * @param maxRetries - Nombre maximum de tentatives (défaut: 2)
 * @returns Promise<boolean> - true si succès, false si échec définitif
 */
export async function updateSchemaWithRetry(maxRetries: number = 2): Promise<boolean> {
  let attempts = 0;

  while (attempts < maxRetries) {
    attempts++;

    console.log(`📡 Tentative ${attempts}/${maxRetries} de mise à jour du schéma`);

    const success = await updateAirtableSchema();

    if (success) {
      return true;
    }

    if (attempts < maxRetries) {
      console.log(`⏸️ Attente 3s avant retry...`);
      await Bun.sleep(3000);
    }
  }

  console.error(`❌ Échec définitif après ${maxRetries} tentatives`);
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
    console.log("✅ Schéma Airtable validé");
    return true;
  } catch (error) {
    console.error("❌ Erreur de validation du schéma:", error);
    return false;
  }
}