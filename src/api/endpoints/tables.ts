import { Elysia, t } from "elysia";
import { sqliteService } from "../../lib/sqlite";
import { normalizeKey } from "../../lib/utils";

export const tables = new Elysia({ prefix: "/api/tables" })
	// 📋 List all tables
	.get("/", async () => {
		const tables = await sqliteService.getTables();
		return {
			backend: "sqlite",
			tables: tables.map((t) => t.name),
		};
	})

	// 📄 Get specific record by ID
	.get(
		"/:tableName/:recordId",
		async ({ params: { tableName, recordId }, set }) => {
			const normalizedTableName = normalizeKey(decodeURIComponent(tableName));
			const decodedRecordId = decodeURIComponent(recordId);

			const record = await sqliteService.getRecord(normalizedTableName, decodedRecordId);

			if (!record) {
				set.status = 404;
				return {
					error: "Record not found",
					backend: "sqlite",
				};
			}

			return {
				backend: "sqlite",
				...record,
			};
		},
		{
			params: t.Object({
				tableName: t.String(),
				recordId: t.String(),
			}),
		},
	)

	// 📋 Get table records with pagination
	.get(
		"/:tableName",
		async ({ params: { tableName }, query, set }) => {
			const rawTableName = decodeURIComponent(tableName);
			const normalizedTableName = normalizeKey(rawTableName);

			// Check if table exists
			const exists = await sqliteService.tableExists(normalizedTableName);
			if (!exists) {
				set.status = 404;
				return {
					error: `Table '${rawTableName}' not found`,
					backend: "sqlite",
				};
			}

			// Parse pagination parameters
			const page = query.page ? Number.parseInt(query.page) : 1;
			const pageSize = query.pageSize ? Number.parseInt(query.pageSize) : 100;
			const offset = (page - 1) * pageSize;

			const { records, total } = await sqliteService.getRecords(normalizedTableName, {
				limit: pageSize,
				offset,
				modifiedAfter: query.modifiedAfter,
				filter: query.filter,
			});

			return {
				backend: "sqlite",
				records,
				pagination: {
					page,
					pageSize,
					total,
					totalPages: Math.ceil(total / pageSize),
				},
			};
		},
		{
			params: t.Object({
				tableName: t.String(),
			}),
			query: t.Object({
				page: t.Optional(t.String()),
				pageSize: t.Optional(t.String()),
				modifiedAfter: t.Optional(t.String()),
				filter: t.Optional(t.String()),
			}),
		},
	);
