import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const tableRouter = createTRPCRouter({
	// Get all tables for a specific base
	getByBaseId: protectedProcedure
		.input(z.object({ baseId: z.string() }))
		.query(async ({ ctx, input }) => {
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

			return ctx.db.table.findMany({
				where: { baseId: input.baseId },
				include: {
					columns: {
						orderBy: { position: "asc" },
					},
					rows: {
						include: {
							cellValues: {
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
							cellValues: {
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
				cellValues: z.array(
					z.object({
						columnId: z.string(),
						textValue: z.string().optional(),
						numberValue: z.number().optional(),
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
					cellValues: {
						create: input.cellValues,
					},
				},
				include: {
					cellValues: {
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
	updateCellValue: protectedProcedure
		.input(
			z.object({
				rowId: z.string(),
				columnId: z.string(),
				textValue: z.string().optional(),
				numberValue: z.number().optional(),
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

			return ctx.db.cellValue.upsert({
				where: {
					columnId_rowId: {
						columnId: input.columnId,
						rowId: input.rowId,
					},
				},
				update: {
					textValue: input.textValue,
					numberValue: input.numberValue,
				},
				create: {
					columnId: input.columnId,
					rowId: input.rowId,
					textValue: input.textValue,
					numberValue: input.numberValue,
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
				count: z.number().min(1).max(100),
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
					cellValues: {
						create: table.columns.map((column) => {
							const value = generateRandomValue(column);
							return {
								columnId: column.id,
								textValue: column.type === "TEXT" ? (value as string) : null,
								numberValue:
									column.type === "NUMBER" ? (value as number) : null,
							};
						}),
					},
				};
			});

			// Create all rows in a transaction
			const createdRows = await ctx.db.$transaction(
				rowsToCreate.map((rowData) =>
					ctx.db.row.create({
						data: rowData,
						include: {
							cellValues: {
								include: {
									column: true,
								},
							},
						},
					}),
				),
			);

			return createdRows;
		}),
});
