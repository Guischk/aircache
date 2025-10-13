import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import unicorn from "eslint-plugin-unicorn";

export default tseslint.config(
	// Ignore patterns
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/data/**",
			"**/*.cache.json",
			".env*",
			"**/schema.ts", // Generated file
		],
	},

	// Base ESLint recommended rules
	eslint.configs.recommended,

	// TypeScript recommended rules
	...tseslint.configs.recommendedTypeChecked,
	...tseslint.configs.stylisticTypeChecked,

	// Main configuration
	{
		plugins: {
			"@stylistic": stylistic,
			unicorn,
		},

		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			globals: {
				Bun: "readonly",
				console: "readonly",
				process: "readonly",
			},
		},

		rules: {
			// ===========================
			// TypeScript rules
			// ===========================
			// Set @typescript-eslint/no-explicit-any to warn instead of error
			"@typescript-eslint/no-explicit-any": "warn",

			// Allow unused vars with underscore prefix
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],

			// Prefer modern syntax
			"@typescript-eslint/consistent-type-imports": [
				"error",
				{
					prefer: "type-imports",
					fixStyle: "separate-type-imports",
				},
			],

			"@typescript-eslint/consistent-type-exports": [
				"error",
				{
					fixMixedExportsWithInlineTypeSpecifier: true,
				},
			],

			// Allow floating promises in some cases (Bun patterns)
			"@typescript-eslint/no-floating-promises": "off",

			// Be more lenient with type assertions for Bun APIs
			"@typescript-eslint/no-unsafe-assignment": "warn",
			"@typescript-eslint/no-unsafe-member-access": "warn",
			"@typescript-eslint/no-unsafe-call": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",
			"@typescript-eslint/no-unsafe-argument": "warn",

			// Relax some strict rules
			"@typescript-eslint/prefer-nullish-coalescing": "off",
			"@typescript-eslint/prefer-regexp-exec": "off",
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/consistent-type-definitions": "off", // Allow both type and interface

			// ===========================
			// Stylistic rules (formatting)
			// ===========================
			// Tabs instead of spaces (like Biome)
			"@stylistic/indent": ["error", "tab"],

			// Double quotes (like Biome)
			"@stylistic/quotes": ["error", "double"],

			// Always use semicolons
			"@stylistic/semi": ["error", "always"],

			// Trailing commas
			"@stylistic/comma-dangle": ["error", "always-multiline"],

			// Spacing
			"@stylistic/space-before-function-paren": [
				"error",
				{
					anonymous: "always",
					named: "never",
					asyncArrow: "always",
				},
			],

			"@stylistic/object-curly-spacing": ["error", "always"],
			"@stylistic/comma-spacing": ["error"],
			"@stylistic/keyword-spacing": ["error"],
			"@stylistic/space-infix-ops": ["error"],

			// Line length (soft warning only)
			"@stylistic/max-len": [
				"warn",
				{
					code: 120,
					ignoreUrls: true,
					ignoreStrings: true,
					ignoreTemplateLiterals: true,
					ignoreRegExpLiterals: true,
				},
			],

			// ===========================
			// Unicorn rules (best practices)
			// ===========================
			"unicorn/prefer-node-protocol": "error", // Use node:fs instead of fs
			"unicorn/prefer-module": "error", // Prefer ES modules
			"unicorn/no-null": "off", // null is fine in TypeScript
			"unicorn/prevent-abbreviations": "off", // Too strict
			"unicorn/filename-case": [
				"error",
				{
					case: "kebabCase",
				},
			],
		},
	},
);
