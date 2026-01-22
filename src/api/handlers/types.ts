/**
 * Handler for TypeScript types generation API
 * Provides developer-friendly TypeScript definitions
 */

import {
	generateAircacheTypes,
	generateAircacheTypesJson,
} from "../../lib/types-generator/index";

/**
 * GET /api/types
 * Returns TypeScript definitions file
 *
 * Query params:
 *   format=json - Return JSON metadata instead of TypeScript
 */
export async function handleGetTypes(format?: string): Promise<Response> {
	try {
		if (format === "json") {
			// Return JSON metadata
			const jsonData = await generateAircacheTypesJson();

			return new Response(JSON.stringify(jsonData, null, 2), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		// Return TypeScript file
		const typescriptCode = await generateAircacheTypes();

		return new Response(typescriptCode, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Content-Disposition": 'attachment; filename="aircache-types.ts"',
			},
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
				hint: "Run 'bun run types' to generate table mappings first",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
