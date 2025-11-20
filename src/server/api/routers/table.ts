import { faker } from "@faker-js/faker";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { columnTypeSchema } from "~/types/column";
import { generateCellValue, generateSampleRows } from "~/server/utils/dataGeneration";
import { defaultViewSettings } from "./view";

const BULK_QUEUE_NAME = env.SUPABASE_BULK_QUEUE_NAME ?? "bulk_update";
const BULK_QUEUE_CHUNK_SIZE = 10000;
const BULK_ROW_QUEUE_THRESHOLD =
	env.BULK_ROW_QUEUE_THRESHOLD ?? BULK_QUEUE_CHUNK_SIZE;
const BULK_QUEUE_EVENT_TYPE = "BULK_RANDOM_ROW_GENERATION";

export const tableRouter = createTRPCRouter({
	// Get table columns (for headers/typing)
	getTableColumnType: protectedProcedure
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
					_count: {
						select: { rows: true },
					},
				},
			});
		}),
	getRowCount: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const count = await ctx.db.row.count({
				where: {
					tableId: input.id,
					table: { base: { createdById: ctx.session.user.id } },
				},
			});
			return { count };
		}),
	// Get infinite rows
	getInfiniteRows: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				limit: z.number().min(1).max(500).default(100),
				cursor: z.union([
					z.object({ position: z.number(), id: z.string() }),
					z.string(), // Legacy support
				]).nullish(),
				direction: z.enum(["forward", "backward"]).default("forward"),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Optimized table ownership validation
			const table = await ctx.db.table.findUnique({
				where: { id: input.id },
				select: { base: { select: { createdById: true } } },
			});
			
			if (!table || table.base.createdById !== ctx.session.user.id) {
				throw new Error("Table not found or access denied");
			}

			const limit = input.limit;
			const forward = input.direction === "forward";

			// Stable deterministic ordering using position then id as tiebreaker
			const orderBy: Prisma.RowOrderByWithRelationInput[] = forward
				? [{ position: "asc" }, { id: "asc" }]
				: [{ position: "desc" }, { id: "desc" }];

			// Handle legacy string cursor format vs new object cursor format
			let cursorCondition: any = {};
			let usePrismaCursor = false;

			if (input.cursor) {
				if (typeof input.cursor === 'string') {
					// Legacy cursor - just the row ID, fall back to old manual logic
					const cursorRow = await ctx.db.row.findUnique({
						where: { id: input.cursor },
						select: { position: true, id: true },
					});
					
					if (cursorRow) {
						if (forward) {
							cursorCondition = {
								OR: [
									{ position: { gt: cursorRow.position } },
									{ position: cursorRow.position, id: { gt: cursorRow.id } },
								],
							};
						} else {
							cursorCondition = {
								OR: [
									{ position: { lt: cursorRow.position } },
									{ position: cursorRow.position, id: { lt: cursorRow.id } },
								],
							};
						}
					}
				} else {
					// New composite cursor format - use Prisma's native cursor
					usePrismaCursor = true;
				}
			}

			// Fetch rows with optimized query
			const rows = await ctx.db.row.findMany({
				where: {
					tableId: input.id,
					...(!usePrismaCursor ? cursorCondition : {}),
				},
				include: {
					cells: {
						include: {
							column: true,
						},
					},
				},
				orderBy,
				...(usePrismaCursor && input.cursor && typeof input.cursor === 'object' 
					? {
						cursor: {
							tableId_position_id: {
								tableId: input.id,
								position: input.cursor.position,
								id: input.cursor.id,
							},
						},
						skip: 1,
					}
					: {}),
				take: forward ? limit + 1 : -(limit + 1), // Proper backward pagination
			});

			let nextCursor: { position: number; id: string } | undefined = undefined;
			let prevCursor: { position: number; id: string } | undefined = undefined;

			let items = rows;
			// If we fetched more than the page size, pop the extra and set cursors
			const hasMore = Math.abs(rows.length) > limit;
			if (hasMore) {
				if (forward) {
					const extra = items.pop()!;
					nextCursor = { position: extra.position, id: extra.id };
				} else {
					const extra = items.shift()!;
					prevCursor = { position: extra.position, id: extra.id };
				}
			}

			// For backward pagination, items are already in correct order due to negative take
			// No need to reverse

			return {
				items,
				nextCursor,
				prevCursor,
				hasMore,
			};
		}),

	// Lazy cell loading endpoint - fetch cells on demand for specific rows
	getCellsByRowIds: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				rowIds: z.array(z.string()).min(1).max(100), // Limit batch size
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify table ownership first
			const table = await ctx.db.table.findFirst({
				where: {
					id: input.tableId,
					base: { createdById: ctx.session.user.id },
				},
				select: { id: true },
			});

			if (!table) {
				throw new Error("Table not found or access denied");
			}

			// Fetch cells for the requested rows - optimized query using indexes
			const cells = await ctx.db.cell.findMany({
				where: {
					rowId: { in: input.rowIds },
				},
				select: {
					id: true,
					rowId: true,
					columnId: true,
					value: true,
				},
				orderBy: [
					{ rowId: "asc" },
					{ columnId: "asc" },
				],
			});

			// Group cells by rowId for easier consumption
			const cellsByRowId = cells.reduce<Record<string, Array<(typeof cells)[0]>>>((acc, cell) => {
				if (!acc[cell.rowId]) {
					acc[cell.rowId] = [];
				}
				acc[cell.rowId]!.push(cell);
				return acc;
			}, {});

			return cellsByRowId;
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
						type: columnTypeSchema,
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

				// Create the table with columns and views
			const newTable = await ctx.db.table.create({
				data: {
					name: input.name,
					description: input.description,
					baseId: input.baseId,
					columns: {
						create: input.columns,
					},
					views: {
						create: {
							name: "Grid view",
							type: "grid",
							position: 0,
							settings: defaultViewSettings as unknown as Prisma.JsonObject,
						},
					},
				},
				include: {
					columns: {
						orderBy: { position: "asc" },
					},
				},
			});

			// Generate sample data using faker.js
			const sampleRowsData = generateSampleRows(newTable.columns, newTable.id);
			
			// Create the sample rows with cells (using individual creates for nested data)
			await Promise.all(
				sampleRowsData.map((rowData) =>
					ctx.db.row.create({
						data: rowData,
					})
				)
			);

			// Return the complete table with rows and cells
			return ctx.db.table.findUniqueOrThrow({
				where: { id: newTable.id },
				include: {
					columns: {
						orderBy: { position: "asc" },
					},
					rows: {
						include: {
							cells: { include: { column: true } },
						},
						orderBy: { position: "asc" },
					},
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
					_count: {
						select: {
							rows: true,
						},
					},
				},
			});

			if (!table) {
				throw new Error("Table not found or access denied");
			}

			// Get the next position for the new row
			const nextPosition = table._count?.rows ?? 0;

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
	// Add a new row at a specific position
	addRowAtPosition: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				position: z.number().int().min(0),
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
			});

			if (!table) {
				throw new Error("Table not found or access denied");
			}

			// Use a transaction to ensure consistency
			return await ctx.db.$transaction(async (tx) => {
				// First, shift all rows at or after the target position down by 1
				await tx.row.updateMany({
					where: {
						tableId: input.tableId,
						position: { gte: input.position },
					},
					data: {
						position: { increment: 1 },
					},
				});

				// Create the new row at the specified position
				const row = await tx.row.create({
					data: {
						tableId: input.tableId,
						position: input.position,
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
			});
		}),

	// Duplicate a row at a specific position
	duplicateRowAtPosition: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				sourceRowId: z.string(),
				position: z.number().int().min(0),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First, verify the table and source row belong to the user
			const sourceRow = await ctx.db.row.findFirst({
				where: {
					id: input.sourceRowId,
					tableId: input.tableId,
					table: {
						base: {
							createdById: ctx.session.user.id,
						},
					},
				},
				include: {
					cells: true,
				},
			});

			if (!sourceRow) {
				throw new Error("Source row not found or access denied");
			}

			// Use a transaction to ensure consistency
			return await ctx.db.$transaction(async (tx) => {
				// First, shift all rows at or after the target position down by 1
				await tx.row.updateMany({
					where: {
						tableId: input.tableId,
						position: { gte: input.position },
					},
					data: {
						position: { increment: 1 },
					},
				});

				// Create the new row at the specified position with duplicated cells
				const row = await tx.row.create({
					data: {
						tableId: input.tableId,
						position: input.position,
						cells: {
							create: sourceRow.cells.map((cell) => ({
								columnId: cell.columnId,
								value: cell.value,
							})),
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
			});
		}),

	// Delete a table (and cascade its rows/columns/cells)
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Ensure the table belongs to the current user
			const table = await ctx.db.table.findFirst({
				where: {
					id: input.id,
					base: { createdById: ctx.session.user.id },
				},
			});

			if (!table) {
				throw new Error("Table not found or access denied");
			}

			await ctx.db.table.delete({ where: { id: input.id } });

			return { success: true } as const;
		}),

	// Update a table's metadata (e.g., name/description)
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const table = await ctx.db.table.findFirst({
				where: { id: input.id, base: { createdById: ctx.session.user.id } },
			});
			if (!table) throw new Error("Table not found or access denied");
			return ctx.db.table.update({
				where: { id: input.id },
				data: { name: input.name, description: input.description },
			});
		}),

	// Duplicate a table with its columns and rows
	duplicate: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const original = await ctx.db.table.findFirst({
				where: { id: input.id, base: { createdById: ctx.session.user.id } },
				include: {
					columns: true,
					rows: { include: { cells: true } },
				},
			});
			if (!original) throw new Error("Table not found or access denied");

			const newName = `${original.name} copy`;

			const newTable = await ctx.db.$transaction(async (tx) => {
				// 1) Create table
				const created = await tx.table.create({
					data: {
						baseId: original.baseId,
						name: newName,
						description: original.description,
					},
				});

				// 2) Duplicate columns (preserve order and props)
				const columnMap = new Map<string, string>();
				const sortedCols = [...original.columns].sort(
					(a, b) => a.position - b.position,
				);
				for (const col of sortedCols) {
					const c = await tx.column.create({
						data: {
							tableId: created.id,
							name: col.name,
							type: col.type,
							required: col.required,
							position: col.position,
						},
					});
					columnMap.set(col.id, c.id);
				}

				// 3) Duplicate rows and cells
				const sortedRows = [...original.rows].sort(
					(a, b) => a.position - b.position,
				);
				for (const row of sortedRows) {
					const r = await tx.row.create({
						data: { tableId: created.id, position: row.position },
					});
					if (row.cells.length) {
						await tx.cell.createMany({
							data: row.cells.map((cell) => ({
								rowId: r.id,
								columnId: columnMap.get(cell.columnId)!,
								value: cell.value ?? null,
							})),
							skipDuplicates: true,
						});
					}
				}

				return created;
			});

			return newTable;
		}),

	// Add a new column to a table
	addColumn: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				name: z.string().min(1),
				type: columnTypeSchema,
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

	// Delete a column
	deleteColumn: protectedProcedure
		.input(z.object({ colId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// First verify the row belongs to a table owned by the user
			const col = await ctx.db.column.findFirst({
				where: {
					id: input.colId,
					table: {
						base: {
							createdById: ctx.session.user.id,
						},
					},
				},
			});

			if (!col) {
				throw new Error("Row not found or access denied");
			}

			// Delete the column (cascade will handle cell values)
			await ctx.db.column.delete({
				where: { id: input.colId },
			});

			// Update positions of remaining rows
			await ctx.db.column.updateMany({
				where: {
					tableId: col.tableId,
					position: { gt: col.position },
				},
				data: {
					position: { decrement: 1 },
				},
			});

			return { success: true };
		}),

	// Update (rename) a column
	updateColumn: protectedProcedure
		.input(
			z.object({
				colId: z.string(),
				name: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// verify access
			const col = await ctx.db.column.findFirst({
				where: {
					id: input.colId,
					table: { base: { createdById: ctx.session.user.id } },
				},
			});
			if (!col) throw new Error("Column not found or access denied");

			const updated = await ctx.db.column.update({
				where: { id: input.colId },
				data: { name: input.name },
			});
			return updated;
		}),

	// Duplicate a column (including copying cell values)
	duplicateColumn: protectedProcedure
		.input(z.object({ colId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const original = await ctx.db.column.findFirst({
				where: {
					id: input.colId,
					table: { base: { createdById: ctx.session.user.id } },
				},
			});
			if (!original) throw new Error("Column not found or access denied");

			// compute next position
			const colCount = await ctx.db.column.count({
				where: { tableId: original.tableId },
			});
			const newName = `${original.name} copy`;

			// create new column
			const newCol = await ctx.db.column.create({
				data: {
					tableId: original.tableId,
					name: newName,
					type: original.type,
					position: colCount,
					required: false,
				},
			});

			// copy cells values
			const cells = await ctx.db.cell.findMany({
				where: { columnId: original.id },
				select: { rowId: true, value: true },
			});
			if (cells.length) {
				await ctx.db.cell.createMany({
					data: cells.map((c) => ({
						rowId: c.rowId,
						columnId: newCol.id,
						value: c.value ?? null,
					})),
					skipDuplicates: true,
				});
			}

			return newCol;
		}),

	// Bulk add random rows (and optionally enqueue massive jobs)
	bulkAddRows: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				count: z.number(),
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
					_count: {
						select: {
							rows: true,
						},
					},
				},
			});

			if (!table) {
				throw new Error("Table not found or access denied");
			}

			const existingRowCount = table._count?.rows ?? 0;
			const shouldQueue = input.count >= BULK_ROW_QUEUE_THRESHOLD;

			if (shouldQueue) {
				const totalJobs = Math.ceil(input.count / BULK_QUEUE_CHUNK_SIZE);
				const messageIds: number[] = [];
				for (let jobIndex = 0; jobIndex < totalJobs; jobIndex += 1) {
					const rowsRemaining = input.count - jobIndex * BULK_QUEUE_CHUNK_SIZE;
					const chunkCount = Math.min(rowsRemaining, BULK_QUEUE_CHUNK_SIZE);

					const payload = {
						type: BULK_QUEUE_EVENT_TYPE,
						requestedAt: new Date().toISOString(),
						tableId: table.id,
						tableName: table.name,
						baseId: table.baseId,
						count: chunkCount,
						totalRequested: input.count,
						requestedBy: ctx.session.user.id,
					};

					const [messageRow] = await ctx.db.$queryRaw<
						Array<{ msg_id: bigint }>
					>`SELECT pgmq.send(${BULK_QUEUE_NAME}, ${JSON.stringify(payload)}::jsonb, 0) AS msg_id;`;
					if (messageRow?.msg_id) {
						messageIds.push(Number(messageRow.msg_id));
					}
				}

				return {
					created: 0,
					queued: true,
					queueName: BULK_QUEUE_NAME,
					messageId: messageIds[0] ?? null,
				};
			}

			// Use the shared data generation utility

			// Create rows with random data
			const rowsToCreate = Array.from({ length: input.count }, (_, index) => {
				const position = existingRowCount + index;
				return {
					tableId: input.tableId,
					position,
					cells: {
						create: table.columns.map((column) => {
							const value = String(generateCellValue(column));
							return {
								columnId: column.id,
								value,
							};
						}),
					},
				};
			});

			// Create rows in chunks to avoid oversized transactions/responses
			const chunkSize = 5000;
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
			return {
				created: rowsToCreate.length,
				queued: false,
				queueName: null,
				messageId: null,
			};
		}),

	// Get rows by offset range for viewport-specific fetching
	getRowsByRange: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				offset: z.number().min(0).default(0),
				limit: z.number().min(1).max(500).default(100),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify table ownership
			const table = await ctx.db.table.findUnique({
				where: { id: input.id },
				select: { base: { select: { createdById: true } } },
			});
			
			if (!table || table.base.createdById !== ctx.session.user.id) {
				throw new Error("Table not found or access denied");
			}

			// Fetch rows using OFFSET/LIMIT for specific range
			const rows = await ctx.db.row.findMany({
				where: {
					tableId: input.id,
				},
				include: {
					cells: {
						include: {
							column: true,
						},
					},
				},
				orderBy: [
					{ position: "asc" },
					{ id: "asc" },
				],
				skip: input.offset,
				take: input.limit,
			});

			// Transform to match expected format
			const transformedRows = rows.map((row) => ({
				id: row.id,
				tableId: row.tableId,
				position: row.position,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				cells: row.cells.map((cell) => ({
					id: cell.id,
					columnId: cell.columnId,
					value: cell.value,
					rowId: cell.rowId,
					column: cell.column,
				})),
			}));

			return {
				items: transformedRows,
				offset: input.offset,
				limit: input.limit,
				hasMore: rows.length === input.limit,
			};
		}),
});
