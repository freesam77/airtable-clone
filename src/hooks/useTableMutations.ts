import { api } from "~/trpc/react";
import { useCellUpdateQueue } from "./useCellUpdateQueue";

type RowCell = {
	columnId: string;
	column?: ({ id: string } & Record<string, unknown>) | null;
};

const resolveCellColumnId = (cell: RowCell) => cell.column?.id ?? cell.columnId;

type InfiniteInput = Extract<
	Parameters<typeof api.table.getInfiniteRows.useInfiniteQuery>[0],
	{ id: string }
>;

type UseTableMutationsParams = {
	tableId: string;
	infiniteInput: InfiniteInput;
	onOptimisticUpdate: (
		rowId: string,
		columnId: string,
		value?: string | number,
	) => void;
};

export function useTableMutations({
	tableId,
	infiniteInput,
	onOptimisticUpdate,
}: UseTableMutationsParams) {
	const utils = api.useUtils();
	const rowCountInput = { id: tableId };

	const { queueCellUpdate, flushPendingUpdates, remapRowId, cancelCellUpdate } =
		useCellUpdateQueue({
			tableId,
			onOptimisticUpdate,
		});

	const addRowMutation = api.table.addRow.useMutation({
		onMutate: async (variables) => {
			await utils.table.getInfiniteRows.cancel(infiniteInput);
			const prevInfiniteRows =
				utils.table.getInfiniteRows.getInfiniteData(infiniteInput);
			const prevColumnData = utils.table.getTableColumnType.getData({
				id: tableId,
			});

			const optimisticRowId = `temp-${Date.now()}`;
			const now = new Date();
			const optimisticRow = {
				id: optimisticRowId,
				position:
					(prevInfiniteRows?.pages
						.flatMap((p) => p.items)
						.reduce((acc, r) => Math.max(acc, r.position), -1) ?? -1) + 1,
				createdAt: now,
				updatedAt: now,
				tableId,
				cells: variables.cells.map((cv) => {
					const column = prevColumnData?.columns.find(
						(col) => col.id === cv.columnId,
					);
					return {
						id: `temp-cell-${Date.now()}-${cv.columnId}`,
						columnId: cv.columnId,
						rowId: optimisticRowId,
						value: cv.value || null,
						column:
							column ||
							({
								id: cv.columnId,
								name: "Unknown",
								type: "TEXT" as const,
								required: false,
								position: 0,
								tableId,
							} as const),
					};
				}),
			} as const;

			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
				if (!old) return old;
				if (old.pages.length === 0) return old;
				const pages = old.pages.map((page, idx, arr) =>
					idx === arr.length - 1
						? { ...page, items: [...page.items, optimisticRow] }
						: page,
				);
				return { ...old, pages };
			});
			const prevRowCount = utils.table.getRowCount.getData(rowCountInput);
			utils.table.getRowCount.setData(rowCountInput, (old) => {
				if (!old) return old;
				return { ...old, count: old.count + 1 };
			});

			return {
				previousInfinite: prevInfiniteRows,
				previousData: prevColumnData,
				optimisticRow,
				previousRowCount: prevRowCount,
			};
		},
		onSuccess: (result, _variables, context) => {
			if (context?.optimisticRow?.id && result?.id) {
				remapRowId(context.optimisticRow.id, result.id);
			}
			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.map((row) =>
							row.id === context?.optimisticRow.id ? result : row,
						),
					})),
				};
			});
		},
		onError: (_err, _variables, context) => {
			if (context?.previousInfinite) {
				utils.table.getInfiniteRows.setInfiniteData(
					infiniteInput,
					context.previousInfinite,
				);
			}
			if (context?.previousRowCount) {
				utils.table.getRowCount.setData(
					rowCountInput,
					context.previousRowCount,
				);
			}
		},
		onSettled: () => {
			utils.table.getInfiniteRows.invalidate(infiniteInput);
			utils.table.getRowCount.invalidate(rowCountInput);
		},
	});

	const addColumnMutation = api.table.addColumn.useMutation({
		onMutate: async (variables) => {
			await utils.table.getTableColumnType.cancel({ id: tableId });
			const prevColumnData = utils.table.getTableColumnType.getData({
				id: tableId,
			});
			const prevInfiniteRows =
				utils.table.getInfiniteRows.getInfiniteData(infiniteInput);

			const optimisticColumn = {
				id: `temp-col-${Date.now()}`,
				name: variables.name,
				type: variables.type,
				position: prevColumnData?.columns.length || 0,
				required: false,
				tableId,
			} as const;

			utils.table.getTableColumnType.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					columns: [...old.columns, optimisticColumn],
				};
			});

			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.map((row) => ({
							...row,
							cells: [
								...row.cells,
								{
									id: `temp-cell-${Date.now()}-${row.id}`,
									columnId: optimisticColumn.id,
									rowId: row.id,
									value: null,
									column: optimisticColumn,
								},
							],
						})),
					})),
				};
			});

			return {
				previousData: prevColumnData,
				previousInfinite: prevInfiniteRows,
				optimisticColumn,
			};
		},
		onSuccess: (result, _variables, context) => {
			utils.table.getTableColumnType.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					columns: old.columns.map((col) =>
						col.id === context?.optimisticColumn.id ? result : col,
					),
				};
			});
			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.map((row) => ({
							...row,
							cells: row.cells.map((cell) =>
								resolveCellColumnId(cell) === context?.optimisticColumn.id
									? { ...cell, column: result }
									: cell,
							),
						})),
					})),
				};
			});
		},
		onError: (_err, _variables, context) => {
			if (context?.previousData) {
				utils.table.getTableColumnType.setData(
					{ id: tableId },
					context.previousData,
				);
			}
			if (context?.previousInfinite) {
				utils.table.getInfiniteRows.setInfiniteData(
					infiniteInput,
					context.previousInfinite,
				);
			}
		},
		onSettled: () => {
			utils.table.getTableColumnType.invalidate({ id: tableId });
			utils.table.getInfiniteRows.invalidate(infiniteInput);
		},
	});

	const deleteRowMutation = api.table.deleteRow.useMutation({
		onMutate: async (variables) => {
			await utils.table.getInfiniteRows.cancel(infiniteInput);
			const prevInfiniteRows =
				utils.table.getInfiniteRows.getInfiniteData(infiniteInput);

			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.filter((row) => row.id !== variables.rowId),
					})),
				};
			});

			const prevRowCount = utils.table.getRowCount.getData(rowCountInput);
			utils.table.getRowCount.setData(rowCountInput, (old) => {
				if (!old) return old;
				return { ...old, count: Math.max(old.count - 1, 0) };
			});

			return {
				previousInfinite: prevInfiniteRows,
				previousRowCount: prevRowCount,
			};
		},
		onError: (_err, _variables, context) => {
			if (context?.previousInfinite) {
				utils.table.getInfiniteRows.setInfiniteData(
					infiniteInput,
					context.previousInfinite,
				);
			}
			if (context?.previousRowCount) {
				utils.table.getRowCount.setData(
					rowCountInput,
					context.previousRowCount,
				);
			}
		},
		onSettled: () => {
			utils.table.getInfiniteRows.invalidate(infiniteInput);
			utils.table.getRowCount.invalidate(rowCountInput);
		},
	});

	const deleteColumnMutation = api.table.deleteColumn.useMutation({
		onMutate: async (variables) => {
			await utils.table.getTableColumnType.cancel({ id: tableId });
			await utils.table.getInfiniteRows.cancel(infiniteInput);

			const prevColumnData = utils.table.getTableColumnType.getData({
				id: tableId,
			});
			const prevInfiniteRows =
				utils.table.getInfiniteRows.getInfiniteData(infiniteInput);

			// Optimistically remove the column metadata
			utils.table.getTableColumnType.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					columns: old.columns.filter((c) => c.id !== variables.colId),
				};
			});

			// Optimistically remove cells for that column from each row
			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.map((row) => ({
							...row,
							cells: row.cells.filter(
								(cell) => cell.columnId !== variables.colId,
							),
						})),
					})),
				};
			});

			return {
				previousColumns: prevColumnData,
				previousInfinite: prevInfiniteRows,
			} as const;
		},
		onError: (_err, _variables, ctx) => {
			if (ctx?.previousColumns)
				utils.table.getTableColumnType.setData(
					{ id: tableId },
					ctx.previousColumns,
				);
			if (ctx?.previousInfinite)
				utils.table.getInfiniteRows.setInfiniteData(
					infiniteInput,
					ctx.previousInfinite,
				);
		},
		onSettled: () => {
			utils.table.getTableColumnType.invalidate({ id: tableId });
			utils.table.getInfiniteRows.invalidate(infiniteInput);
		},
	});

	const renameColumnMutation = api.table.updateColumn.useMutation({
		onMutate: async (variables) => {
			await utils.table.getTableColumnType.cancel({ id: tableId });
			await utils.table.getInfiniteRows.cancel(infiniteInput);

			const prevColumnData = utils.table.getTableColumnType.getData({
				id: tableId,
			});
			const prevInfiniteRows =
				utils.table.getInfiniteRows.getInfiniteData(infiniteInput);

			// Optimistically rename in column metadata
			utils.table.getTableColumnType.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					columns: old.columns.map((c) =>
						c.id === variables.colId ? { ...c, name: variables.name } : c,
					),
				};
			});

			// Also update embedded column meta in each row's cells
			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.map((row) => ({
							...row,
							cells: row.cells.map((cell) =>
								cell.columnId === variables.colId
									? {
											...cell,
											column: {
												...((cell as RowCell).column ?? {
													id: variables.colId,
													name: variables.name,
													type: "TEXT" as const,
													required: false,
													position: 0,
													tableId,
												}),
												name: variables.name,
											} as RowCell["column"],
										}
									: cell,
							),
						})),
					})),
				};
			});

			return { prevColumnData, prevInfiniteRows } as const;
		},
		onError: (_err, _variables, ctx) => {
			if (ctx?.prevColumnData)
				utils.table.getTableColumnType.setData(
					{ id: tableId },
					ctx.prevColumnData,
				);
			if (ctx?.prevInfiniteRows)
				utils.table.getInfiniteRows.setInfiniteData(
					infiniteInput,
					ctx.prevInfiniteRows,
				);
		},
		onSettled: () => {
			utils.table.getTableColumnType.invalidate({ id: tableId });
			utils.table.getInfiniteRows.invalidate(infiniteInput);
		},
	});

	const duplicateColumnMutation = api.table.duplicateColumn.useMutation({
		onMutate: async (variables) => {
			await utils.table.getTableColumnType.cancel({ id: tableId });
			await utils.table.getInfiniteRows.cancel(infiniteInput);

			const prevColumnData = utils.table.getTableColumnType.getData({
				id: tableId,
			});
			const prevInfiniteRows =
				utils.table.getInfiniteRows.getInfiniteData(infiniteInput);

			const original = prevColumnData?.columns.find(
				(c) => c.id === variables.colId,
			);
			const optimisticColumn = original
				? {
						id: `temp-dup-col-${Date.now()}`,
						name: `${original.name} copy`,
						type: original.type,
						position: prevColumnData?.columns.length || 0,
						required: false,
						tableId,
					}
				: undefined;

			if (optimisticColumn) {
				utils.table.getTableColumnType.setData({ id: tableId }, (old) => {
					if (!old) return old;
					return { ...old, columns: [...old.columns, optimisticColumn] };
				});

				utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
					if (!old) return old;
					return {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							items: page.items.map((row) => {
								const src = row.cells.find(
									(c) => c.columnId === variables.colId,
								);
								return {
									...row,
									cells: [
										...row.cells,
										{
											id: `temp-cell-${Date.now()}-${row.id}`,
											columnId: optimisticColumn.id,
											rowId: row.id,
											value: src?.value ?? null,
											column: optimisticColumn,
										},
									],
								};
							}),
						})),
					};
				});
			}

			return { prevColumnData, prevInfiniteRows, optimisticColumn } as const;
		},
		onSuccess: (result, _variables, ctx) => {
			// replace optimistic column meta with server one and update embedded cell meta
			utils.table.getTableColumnType.setData({ id: tableId }, (old) => {
				if (!old || !ctx?.optimisticColumn) return old;
				return {
					...old,
					columns: old.columns.map((c) =>
						c.id === ctx.optimisticColumn!.id ? result : c,
					),
				};
			});
			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
				if (!old || !ctx?.optimisticColumn) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.map((row) => ({
							...row,
							cells: row.cells.map((cell) =>
								cell.columnId === ctx.optimisticColumn!.id
									? { ...cell, column: result }
									: cell,
							),
						})),
					})),
				};
			});
		},
		onError: (_err, _variables, ctx) => {
			if (ctx?.prevColumnData)
				utils.table.getTableColumnType.setData(
					{ id: tableId },
					ctx.prevColumnData,
				);
			if (ctx?.prevInfiniteRows)
				utils.table.getInfiniteRows.setInfiniteData(
					infiniteInput,
					ctx.prevInfiniteRows,
				);
		},
		onSettled: () => {
			utils.table.getTableColumnType.invalidate({ id: tableId });
			utils.table.getInfiniteRows.invalidate(infiniteInput);
		},
	});

	return {
		queueCellUpdate,
		flushPendingUpdates,
		remapRowId,
		cancelCellUpdate,
		addRowMutation,
		addColumnMutation,
		deleteRowMutation,
		deleteColumnMutation,
		renameColumnMutation,
		duplicateColumnMutation,
	} as const;
}
