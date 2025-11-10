import { api } from "~/trpc/react";
import { useCellUpdateQueue } from "./useCellUpdateQueue";

type InfiniteInput = {
	id: string;
	limit: number;
	direction: "forward" | "backward";
};

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

	const { queueCellUpdate, flushPendingUpdates, remapRowId } =
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

			return {
				previousInfinite: prevInfiniteRows,
				previousData: prevColumnData,
				optimisticRow,
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
		},
		onSettled: () => {
			utils.table.getInfiniteRows.invalidate(infiniteInput);
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
								cell.column.id === context?.optimisticColumn.id
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

			return { previousInfinite: prevInfiniteRows };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousInfinite) {
				utils.table.getInfiniteRows.setInfiniteData(
					infiniteInput,
					context.previousInfinite,
				);
			}
		},
		onSettled: () => {
			utils.table.getInfiniteRows.invalidate(infiniteInput);
		},
	});

	return {
		queueCellUpdate,
		flushPendingUpdates,
		remapRowId,
		addRowMutation,
		addColumnMutation,
		deleteRowMutation,
	} as const;
}
