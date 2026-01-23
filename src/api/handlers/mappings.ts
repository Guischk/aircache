/**
 * Handler for table mappings API
 * Provides metadata about table ID/name mappings
 */

import { sqliteService } from "../../lib/sqlite/index";

/**
 * GET /api/mappings
 * Returns all table mappings
 */
export async function handleGetMappings(): Promise<Response> {
	try {
		const mappings = await sqliteService.getAllMappings();

		return new Response(
			JSON.stringify({
				backend: "sqlite",
				count: mappings.length,
				mappings: mappings.map((m) => ({
					tableId: m.id,
					originalName: m.originalName,
					normalizedName: m.normalizedName,
					primaryFieldId: m.primaryFieldId,
					fieldCount: Object.keys(m.fields).length,
				})),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
				backend: "sqlite",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

/**
 * GET /api/mappings/:identifier
 * Returns a specific table mapping by ID or normalized name
 */
export async function handleGetTableMapping(identifier: string): Promise<Response> {
	try {
		const mappings = await sqliteService.getAllMappings();

		// Find by table ID or normalized name
		const mapping = mappings.find((m) => m.id === identifier || m.normalizedName === identifier);

		if (!mapping) {
			return new Response(
				JSON.stringify({
					error: "Table not found",
					identifier,
					backend: "sqlite",
				}),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(
			JSON.stringify({
				backend: "sqlite",
				mapping: {
					tableId: mapping.id,
					originalName: mapping.originalName,
					normalizedName: mapping.normalizedName,
					primaryFieldId: mapping.primaryFieldId,
					fields: mapping.fields,
				},
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
				backend: "sqlite",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
