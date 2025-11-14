import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { columnTypeSchema } from "~/types/column";

const filterConditionSchema = z.object({
	id: z.string(),
	columnId: z.string(),
	type: columnTypeSchema,
	op: z.string(),
	value: z.string().optional().nullable(),
});

const sortConditionSchema = z.object({
	id: z.string().optional(),
	columnId: z.string(),
	type: columnTypeSchema,
	dir: z.enum(["asc", "desc"]),
});

const viewSettingsSchema = z
	.object({
		version: z.number().default(1),
		filters: z.array(filterConditionSchema).default([]),
		sorts: z.array(sortConditionSchema).default([]),
		hiddenColumnIds: z.array(z.string()).default([]),
		autoSort: z.boolean().default(true),
		groups: z.array(z.any()).optional(),
	})
	.passthrough();

export type ViewSettings = z.infer<typeof viewSettingsSchema>;

export const defaultViewSettings: ViewSettings = {
	version: 1,
	filters: [],
	sorts: [],
	hiddenColumnIds: [],
	autoSort: true,
};

type ProtectedContext = {
	readonly db: PrismaClient;
	readonly session: { user: { id: string } };
};

const assertTableOwnership = async (ctx: ProtectedContext, tableId: string) => {
	const table = await ctx.db.table.findFirst({
		where: {
			id: tableId,
			base: { createdById: ctx.session.user.id },
		},
		select: { id: true },
	});

	if (!table) {
		throw new Error("Table not found or access denied");
	}
};

const assertViewOwnership = async (ctx: ProtectedContext, viewId: string) => {
	const view = await ctx.db.view.findFirst({
		where: {
			id: viewId,
			table: {
				base: { createdById: ctx.session.user.id },
			},
		},
	});

	if (!view) {
		throw new Error("View not found or access denied");
	}

	return view;
};

export const viewRouter = createTRPCRouter({
	listByTable: protectedProcedure
		.input(z.object({ tableId: z.string() }))
		.query(async ({ ctx, input }) => {
			await assertTableOwnership(ctx, input.tableId);
			return ctx.db.view.findMany({
				where: { tableId: input.tableId },
				orderBy: { position: "asc" },
			});
		}),

	create: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				name: z.string().optional(),
				type: z.string().default("grid"),
				settings: viewSettingsSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertTableOwnership(ctx, input.tableId);
			const count = await ctx.db.view.count({
				where: { tableId: input.tableId },
			});

			const baseName = input.name?.trim().length
				? input.name.trim()
				: `Grid ${count + 1}`;

			return ctx.db.view.create({
				data: {
					name: baseName,
					type: input.type ?? "grid",
					position: count,
					settings: (input.settings ??
						defaultViewSettings) as Prisma.JsonObject,
					tableId: input.tableId,
				},
			});
		}),

	rename: protectedProcedure
		.input(z.object({ viewId: z.string(), name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await assertViewOwnership(ctx, input.viewId);
			return ctx.db.view.update({
				where: { id: input.viewId },
				data: { name: input.name },
			});
		}),

	duplicate: protectedProcedure
		.input(z.object({ viewId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const view = await assertViewOwnership(ctx, input.viewId);
			const count = await ctx.db.view.count({
				where: { tableId: view.tableId },
			});
			const duplicatedName = `${view.name} copy`;
			return ctx.db.view.create({
				data: {
					name: duplicatedName,
					type: view.type,
					position: count,
					settings: view.settings as Prisma.JsonObject,
					tableId: view.tableId,
				},
			});
		}),

	delete: protectedProcedure
		.input(z.object({ viewId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const view = await assertViewOwnership(ctx, input.viewId);
			const remaining = await ctx.db.view.count({
				where: { tableId: view.tableId },
			});
			if (remaining <= 1) {
				throw new Error("A table must have at least one view");
			}
			await ctx.db.view.delete({ where: { id: input.viewId } });
			// Re-normalize positions
			const views = await ctx.db.view.findMany({
				where: { tableId: view.tableId },
				orderBy: { position: "asc" },
			});
			await ctx.db.$transaction(
				views.map((v, idx) =>
					ctx.db.view.update({ where: { id: v.id }, data: { position: idx } }),
				),
			);
			return { success: true };
		}),

	reorder: protectedProcedure
		.input(
			z.object({
				tableId: z.string(),
				orderedIds: z.array(z.string()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertTableOwnership(ctx, input.tableId);
			const existing = await ctx.db.view.findMany({
				where: { tableId: input.tableId },
				select: { id: true },
			});
			const existingIds = new Set(existing.map((v) => v.id));
			if (existingIds.size !== input.orderedIds.length) {
				throw new Error("Invalid view order payload");
			}
			for (const id of input.orderedIds) {
				if (!existingIds.has(id)) {
					throw new Error("Invalid view order payload");
				}
			}
			await ctx.db.$transaction(
				input.orderedIds.map((id, index) =>
					ctx.db.view.update({ where: { id }, data: { position: index } }),
				),
			);
			return { success: true };
		}),

	updateSettings: protectedProcedure
		.input(
			z.object({
				viewId: z.string(),
				settings: viewSettingsSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertViewOwnership(ctx, input.viewId);
			return ctx.db.view.update({
				where: { id: input.viewId },
				data: { settings: input.settings as Prisma.JsonObject },
			});
		}),
});
