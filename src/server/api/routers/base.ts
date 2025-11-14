import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { columnTypeSchema } from "~/types/column";
import { defaultViewSettings } from "./view";

export const baseRouter = createTRPCRouter({
	// Get all bases for the current user
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const bases = await ctx.db.base.findMany({
			where: { createdById: ctx.session.user.id },
			include: {
				tables: {
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
						views: {
							orderBy: { position: "asc" },
						},
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		// If no bases exist, create a default base
		if (bases.length === 0) {
			await ctx.db.base.create({
				data: {
					name: "My First Base",
					description: "Welcome to your first base!",
					createdById: ctx.session.user.id,
					tables: {
						create: {
							name: "Contacts",
							description: "this becomes the Base name",
							columns: {
								create: [
									{
										name: "Full Name",
										type: "TEXT",
										position: 0,
										required: false,
									},
									{ name: "Email", type: "TEXT", position: 1, required: false },
									{ name: "Phone", type: "TEXT", position: 2, required: false },
									{ name: "Age", type: "NUMBER", position: 3, required: false },
								],
							},
							views: {
								create: {
									name: "Grid view",
									type: "grid",
									position: 0,
									settings: defaultViewSettings as Prisma.JsonObject,
								},
							},
						},
					},
				},
			});

			// Return the created base
			return ctx.db.base.findMany({
				where: { createdById: ctx.session.user.id },
				include: {
					tables: {
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
							views: {
								orderBy: { position: "asc" },
							},
						},
					},
				},
				orderBy: { createdAt: "desc" },
			});
		}

		return bases;
	}),

	// Get a specific base by ID
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.base.findFirst({
				where: {
					id: input.id,
					createdById: ctx.session.user.id,
				},
				include: {
					tables: {
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
							views: {
								orderBy: { position: "asc" },
							},
						},
						orderBy: { createdAt: "desc" },
					},
				},
			});
		}),

	// Create a new base
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return ctx.db.base.create({
				data: {
					name: input.name,
					description: input.description,
					createdById: ctx.session.user.id,
				},
				include: {
					tables: true,
				},
			});
		}),

	// Update a base
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const base = await ctx.db.base.findFirst({
				where: {
					id: input.id,
					createdById: ctx.session.user.id,
				},
			});

			if (!base) {
				throw new Error("Base not found or access denied");
			}

			return ctx.db.base.update({
				where: { id: input.id },
				data: {
					name: input.name,
					description: input.description,
				},
			});
		}),

	// Delete a base
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const base = await ctx.db.base.findFirst({
				where: {
					id: input.id,
					createdById: ctx.session.user.id,
				},
			});

			if (!base) {
				throw new Error("Base not found or access denied");
			}

			return ctx.db.base.delete({
				where: { id: input.id },
			});
		}),

	// Create a new table within a base
	createTable: protectedProcedure
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
			// First, verify the base belongs to the user
			const base = await ctx.db.base.findFirst({
				where: {
					id: input.baseId,
					createdById: ctx.session.user.id,
				},
			});

			if (!base) {
				throw new Error("Base not found or access denied");
			}

			// 1) Create table with columns
			const created = await ctx.db.table.create({
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
							settings: defaultViewSettings as Prisma.JsonObject,
						},
					},
				},
				include: {
					columns: {
						orderBy: { position: "asc" },
					},
				},
			});

			// 2) Create an initial empty row so the table isn't blank
			await ctx.db.row.create({
				data: {
					tableId: created.id,
					position: 0,
					cells: {
						create: created.columns.map((col) => ({
							columnId: col.id,
							value: null,
						})),
					},
				},
			});

			// 3) Return the freshly created table with columns and rows populated
			return ctx.db.table.findUniqueOrThrow({
				where: { id: created.id },
				include: {
					columns: { orderBy: { position: "asc" } },
					rows: {
						include: {
							cells: { include: { column: true } },
						},
						orderBy: { position: "asc" },
					},
				},
			});
		}),
});
