import { Elysia, t } from "elysia";
import { generateAircacheTypes, generateAircacheTypesJson } from "../../lib/types-generator";

export const types = new Elysia({ prefix: "/api/types" }).get(
	"/",
	async ({ query, set }) => {
		if (query.format === "json") {
			const data = await generateAircacheTypesJson();
			return {
				backend: "sqlite",
				...data,
			};
		}

		const content = await generateAircacheTypes();
		set.headers["Content-Type"] = "text/plain";
		return content;
	},
	{
		query: t.Object({
			format: t.Optional(t.String()),
		}),
		detail: {
			summary: "Get TypeScript Definitions",
			description: "Generate TypeScript interfaces or JSON metadata for your Airtable schema",
		},
	},
);
