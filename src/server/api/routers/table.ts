import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const tableRouter = createTRPCRouter({
	// Get a specific table with its data
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.table.findFirst({
				where: {
					id: input.id,
					base: {
						createdById: ctx.session.user.id,
					},
				},
				include: {
					columns: {
						orderBy: { position: "asc" },
					},
					rows: {
						include: {
							cells: {
								include: {
									column: true,
								},
							},
						},
						orderBy: { position: "asc" },
					},
				},
			});
		}),
	// Get infinite rows
	getInfiniteRows: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				limit: z.number().min(1).max(200).nullish(),
				cursor: z.string().nullish(),
				direction: z.enum(["forward", "backward"]).default("forward"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const limit = input.limit ?? 50;
			const forward = input.direction === "forward";

			// Stable deterministic ordering using position then id as tiebreaker
			const orderBy = forward
				? [{ position: "asc" as const }, { id: "asc" as const }]
				: [{ position: "desc" as const }, { id: "desc" as const }];

			const rows = await ctx.db.row.findMany({
				where: {
					tableId: input.id,
					table: {
						base: { createdById: ctx.session.user.id },
					},
				},
				include: {
					cells: {
						include: { column: true },
					},
				},
				orderBy,
				take: (forward ? 1 : -1) * (limit + 1),
				...(input.cursor
					? {
							cursor: { id: input.cursor },
							skip: 1,
						}
					: {}),
			});

			let nextCursor: string | undefined = undefined;
			let prevCursor: string | undefined = undefined;

			let items = rows;
			// If we fetched more than the page size, pop the extra and set cursors
			const hasMore = rows.length > limit;
			if (hasMore) {
				const extra = items.pop();
				if (forward) {
					nextCursor = extra?.id;
				} else {
					prevCursor = extra?.id;
				}
			}

			// For backward pagination, return items in ascending order for UI consistency
			if (!forward) {
				items = items.reverse();
			}

			return {
				items,
				nextCursor,
				prevCursor,
			};
		}),

	// Create a new table (now handled by base router createTable)
	create: protectedProcedure
		.input(
			z.object({
				baseId: z.string(),
				name: z.string().min(1),
				description: z.string().optional(),
				columns: z.array(
					z.object({
						name: z.string().min(1),
						type: z.enum(["TEXT", "NUMBER"]),
						required: z.boolean().default(false),
						position: z.number(),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First verify the base belongs to the user
			const base = await ctx.db.base.findFirst({
				where: {
					id: input.baseId,
					createdById: ctx.session.user.id,
				},
			});

			if (!base) {
				throw new Error("Base not found or access denied");
			}

			return ctx.db.table.create({
				data: {
					name: input.name,
					description: input.description,
					baseId: input.baseId,
					columns: {
						create: input.columns,
					},
				},
				include: {
					columns: {
						orderBy: { position: "asc" },
					},
					rows: true,
				},
			});
		}),

	// Add a new row to a table
	addRow: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				cells: z.array(
					z.object({
						columnId: z.string(),
						value: z.string().optional(),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First, verify the table belongs to the user
			const table = await ctx.db.table.findFirst({
				where: {
					id: input.tableId,
					base: {
						createdById: ctx.session.user.id,
					},
				},
				include: {
					rows: true,
				},
			});

			if (!table) {
				throw new Error("Table not found or access denied");
			}

			// Get the next position for the new row
			const nextPosition = table.rows.length;

			// Create the row
			const row = await ctx.db.row.create({
				data: {
					tableId: input.tableId,
					position: nextPosition,
					cells: {
						create: input.cells,
					},
				},
				include: {
					cells: {
						include: {
							column: true,
						},
					},
				},
			});

			return row;
		}),

	// Add a new column to a table
	addColumn: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				name: z.string().min(1),
				type: z.enum(["TEXT", "NUMBER"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First, verify the table belongs to the user
			const table = await ctx.db.table.findFirst({
				where: {
					id: input.tableId,
					base: {
						createdById: ctx.session.user.id,
					},
				},
				include: {
					columns: true,
				},
			});

			if (!table) {
				throw new Error("Table not found or access denied");
			}

			// Get the next position for the new column
			const nextPosition = table.columns.length;

			// Create the column
			const column = await ctx.db.column.create({
				data: {
					tableId: input.tableId,
					name: input.name,
					type: input.type,
					position: nextPosition,
				},
			});

			return column;
		}),

	// Update cell values
	updateCell: protectedProcedure
		.input(
			z.object({
				rowId: z.string(),
				columnId: z.string(),
				value: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First verify the row belongs to a table owned by the user
			const row = await ctx.db.row.findFirst({
				where: {
					id: input.rowId,
					table: {
						base: {
							createdById: ctx.session.user.id,
						},
					},
				},
			});

			if (!row) {
				throw new Error("Row not found or access denied");
			}

			// Normalize empty string to null so clearing a cell truly clears it
			const normalizedValue = input.value === "" ? null : (input.value ?? null);

			return ctx.db.cell.upsert({
				where: {
					columnId_rowId: {
						columnId: input.columnId,
						rowId: input.rowId,
					},
				},
				update: {
					value: normalizedValue,
				},
				create: {
					columnId: input.columnId,
					rowId: input.rowId,
					value: normalizedValue,
				},
			});
		}),

	// Delete a row
	deleteRow: protectedProcedure
		.input(z.object({ rowId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// First verify the row belongs to a table owned by the user
			const row = await ctx.db.row.findFirst({
				where: {
					id: input.rowId,
					table: {
						base: {
							createdById: ctx.session.user.id,
						},
					},
				},
			});

			if (!row) {
				throw new Error("Row not found or access denied");
			}

			// Delete the row (cascade will handle cell values)
			await ctx.db.row.delete({
				where: { id: input.rowId },
			});

			// Update positions of remaining rows
			await ctx.db.row.updateMany({
				where: {
					tableId: row.tableId,
					position: { gt: row.position },
				},
				data: {
					position: { decrement: 1 },
				},
			});

			return { success: true };
		}),

	// Generate random rows
	generateRows: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				count: z.number().min(1).max(100000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First, verify the table belongs to the user and get columns
			const table = await ctx.db.table.findFirst({
				where: {
					id: input.tableId,
					base: {
						createdById: ctx.session.user.id,
					},
				},
				include: {
					columns: true,
					rows: true,
				},
			});

			if (!table) {
				throw new Error("Table not found or access denied");
			}

			// Helper functions for random data generation
			const randomNames = [
				"Alice",
				"Bob",
				"Charlie",
				"Diana",
				"Eve",
				"Frank",
				"Grace",
				"Henry",
				"Ivy",
				"Jack",
				"Kate",
				"Liam",
				"Mia",
				"Noah",
				"Olivia",
				"Paul",
				"Quinn",
				"Ruby",
				"Sam",
				"Tina",
			];
			const randomEmails = [
				"gmail.com",
				"yahoo.com",
				"outlook.com",
				"hotmail.com",
				"icloud.com",
			];

			const generateRandomValue = (column: { type: string; name: string }):
				| string
				| number => {
				if (column.type === "NUMBER") {
					if (column.name.toLowerCase().includes("age")) {
						return Math.floor(Math.random() * 80) + 18; // Age between 18-98
					}
					return Math.floor(Math.random() * 1000) + 1; // Random number 1-1000
				}

				// TEXT type
				if (column.name.toLowerCase().includes("name")) {
					return (
						randomNames[Math.floor(Math.random() * randomNames.length)] ||
						"User"
					);
				}
				if (column.name.toLowerCase().includes("email")) {
					const name =
						randomNames[
							Math.floor(Math.random() * randomNames.length)
						]?.toLowerCase() || "user";
					const domain =
						randomEmails[Math.floor(Math.random() * randomEmails.length)] ||
						"example.com";
					return `${name}@${domain}`;
				}
				// Generic text
				const words = [
					"Lorem",
					"ipsum",
					"dolor",
					"sit",
					"amet",
					"consectetur",
					"adipiscing",
					"elit",
				];
				return words[Math.floor(Math.random() * words.length)] || "Lorem";
			};

			// Create rows with random data
			const rowsToCreate = Array.from({ length: input.count }, (_, index) => {
				const position = table.rows.length + index;
				return {
					tableId: input.tableId,
					position,
					cells: {
						create: table.columns.map((column) => {
							const value = String(generateRandomValue(column));
							return {
								columnId: column.id,
								value,
							};
						}),
					},
				};
			});

			// Create rows in chunks to avoid oversized transactions/responses
			const chunkSize = 1000;
			for (let i = 0; i < rowsToCreate.length; i += chunkSize) {
				const chunk = rowsToCreate.slice(i, i + chunkSize);
				await ctx.db.$transaction(
					chunk.map((rowData) =>
						ctx.db.row.create({
							data: rowData,
						}),
					),
				);
			}

			// Return a lightweight result; clients should re-fetch table
			return { created: rowsToCreate.length };
		}),
});
