#!/usr/bin/env bun

/**
 * Script de vérification de sécurité
 * Détecte les potentielles fuites de données de production
 */

import { AIRTABLE_TABLE_NAMES } from "./src/lib/airtable/schema";

const DANGEROUS_PATTERNS = [
  // Mots-clés qui pourraient indiquer des données business
  /\b(users|customers|clients|orders|products|companies|employees)\b/i,
  // Nombres spécifiques qui pourraient révéler des tailles de production
  /\b(37|716|142|1247)\s+(records?|enregistrements?)\b/i,
  // Patterns d'API hardcodés
  /\/api\/tables\/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/,
];

const FILES_TO_CHECK = [
  "README.md",
  "BENCHMARK.md",
  "SCRIPTS.md",
  "tests/api.test.ts",
  "tests/integration.test.ts",
  "tests/performance.test.ts",
  "tests/redis-vs-airtable.benchmark.ts",
  "src/api/routes.ts",
  "demo.ts"
];

interface SecurityIssue {
  file: string;
  line: number;
  content: string;
  pattern: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

async function checkFile(filePath: string): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];

  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Vérifier les patterns dangereux
      DANGEROUS_PATTERNS.forEach((pattern, patternIndex) => {
        if (pattern.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            pattern: pattern.toString(),
            severity: patternIndex === 0 ? "HIGH" : "MEDIUM"
          });
        }
      });

      // Vérifier les références aux vraies tables
      AIRTABLE_TABLE_NAMES.forEach(tableName => {
        if (line.includes(`"${tableName}"`) || line.includes(`'${tableName}'`) || line.includes(`\`${tableName}\``)) {
          // Exception pour les imports du schema
          if (!line.includes('AIRTABLE_TABLE_NAMES') && !filePath.includes('schema.ts')) {
            issues.push({
              file: filePath,
              line: index + 1,
              content: line.trim(),
              pattern: `Hardcoded table name: ${tableName}`,
              severity: "HIGH"
            });
          }
        }
      });
    });

  } catch (error) {
    console.warn(`⚠️ Could not check ${filePath}: ${error}`);
  }

  return issues;
}

async function runSecurityCheck(): Promise<void> {
  console.log("🔒 Security Check - Airtable Cacher");
  console.log("===================================");

  const allIssues: SecurityIssue[] = [];

  // Vérifier chaque fichier
  for (const filePath of FILES_TO_CHECK) {
    console.log(`🔍 Checking ${filePath}...`);
    const issues = await checkFile(filePath);
    allIssues.push(...issues);
  }

  // Afficher les résultats
  console.log("\n📊 Security Check Results");
  console.log("========================");

  if (allIssues.length === 0) {
    console.log("✅ No security issues found!");
    console.log("🛡️ All production data appears to be properly protected.");
    return;
  }

  // Grouper par sévérité
  const highIssues = allIssues.filter(i => i.severity === "HIGH");
  const mediumIssues = allIssues.filter(i => i.severity === "MEDIUM");
  const lowIssues = allIssues.filter(i => i.severity === "LOW");

  console.log(`❌ Found ${allIssues.length} potential security issues:`);
  console.log(`   🔴 High: ${highIssues.length}`);
  console.log(`   🟡 Medium: ${mediumIssues.length}`);
  console.log(`   🟢 Low: ${lowIssues.length}\n`);

  // Afficher les problèmes critiques
  if (highIssues.length > 0) {
    console.log("🔴 HIGH SEVERITY ISSUES:");
    highIssues.forEach(issue => {
      console.log(`   📁 ${issue.file}:${issue.line}`);
      console.log(`   📝 ${issue.content}`);
      console.log(`   🎯 ${issue.pattern}\n`);
    });
  }

  // Afficher les problèmes moyens
  if (mediumIssues.length > 0) {
    console.log("🟡 MEDIUM SEVERITY ISSUES:");
    mediumIssues.forEach(issue => {
      console.log(`   📁 ${issue.file}:${issue.line}`);
      console.log(`   📝 ${issue.content}`);
      console.log(`   🎯 ${issue.pattern}\n`);
    });
  }

  // Recommandations
  console.log("🛠️ RECOMMENDATIONS:");
  console.log("   1. Replace hardcoded table names with dynamic references");
  console.log("   2. Use generic examples (Small Table, Medium Table, etc.)");
  console.log("   3. Remove specific record counts from documentation");
  console.log("   4. Use AIRTABLE_TABLE_NAMES for dynamic table selection");

  console.log("\n📖 See SECURITY.md for detailed guidelines");

  // Exit avec code d'erreur si problèmes critiques
  if (highIssues.length > 0) {
    process.exit(1);
  }
}

// Exécution si appelé directement
if (import.meta.main) {
  await runSecurityCheck();
}

export { runSecurityCheck };