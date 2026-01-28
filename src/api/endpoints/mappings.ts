import { Elysia, t } from "elysia";
import { sqliteService } from "../../lib/sqlite";

export const mappings = new Elysia({ prefix: "/api/mappings" })
	// 📄 Get all mappings
	.get("/", async () => {
		const mappings = sqliteService.getAllMappings();
		return {
			backend: "sqlite",
			mappings,
		};
	})

	// 📄 Get mapping for a specific table/identifier
	.get(
		"/:identifier",
		async ({ params: { identifier }, set }) => {
			const mappings = sqliteService.getAllMappings();
			const decodedId = decodeURIComponent(identifier);

			const mapping = mappings.find(
				(m) => m.id === decodedId || m.originalName === decodedId || m.normalizedName === decodedId,
			);

			if (!mapping) {
				set.status = 404;
				return {
					error: "Mapping not found",
					backend: "sqlite",
				};
			}

			return {
				backend: "sqlite",
				...mapping,
			};
		},
		{
			params: t.Object({
				identifier: t.String(),
			}),
		},
	);
