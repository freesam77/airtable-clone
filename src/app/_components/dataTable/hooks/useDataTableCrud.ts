import { useCallback } from "react";
import type { ColumnType } from "~/types/column";
import type { ColumnMeta } from "~/types/dataTable";

interface UseDataTableCrudParams {
	tableId: string;
	columns: ColumnMeta[];
	addRowMutation: any;
	addColumnMutation: any;
	deleteRowMutation: any;
	deleteColumnMutation: any;
	renameColumnMutation: any;
	duplicateColumnMutation: any;
	utils: any;
	infiniteQueryInput: any;
	selectedRowIds: Set<string>;
	setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	filteredRowsCount: number;
	rowVirtualizer: any;
}

export function useDataTableCrud({
	tableId,
	columns,
	addRowMutation,
	addColumnMutation,
	deleteRowMutation,
	deleteColumnMutation,
	renameColumnMutation,
	duplicateColumnMutation,
	utils,
	infiniteQueryInput,
	selectedRowIds,
	setSelectedRowIds,
	filteredRowsCount,
	rowVirtualizer,
}: UseDataTableCrudParams) {
	const handleAddColumn = useCallback(
		(name: string, type: ColumnType) => {
			addColumnMutation.mutate({ tableId, name, type });
		},
		[addColumnMutation, tableId],
	);

	const handleRenameColumn = useCallback(
		(id: string) => {
			const currentName = columns.find((c) => c.id === id)?.name ?? id;
			const name = prompt("Rename column", currentName);
			if (name?.trim()) {
				renameColumnMutation.mutate({
					colId: id,
					name: name.trim(),
				});
			}
		},
		[columns, renameColumnMutation],
	);

	const handleDuplicateColumn = useCallback(
		(id: string) => {
			duplicateColumnMutation.mutate({ colId: id });
		},
		[duplicateColumnMutation],
	);

	const handleDeleteColumn = useCallback(
		(id: string) => {
			deleteColumnMutation.mutate({ colId: id });
		},
		[deleteColumnMutation],
	);

	const handleAddRow = useCallback(() => {
		const cells = columns.map((col) => ({ columnId: col.id, value: "" }));
		addRowMutation.mutate({ tableId, cells });
	}, [addRowMutation, columns, tableId]);

	const scrollToTableBottom = useCallback(() => {
		if (filteredRowsCount <= 0) return;
		rowVirtualizer.scrollToIndex(Math.max(filteredRowsCount - 1, 0), {
			align: "end",
		});
	}, [filteredRowsCount, rowVirtualizer]);

	const handleFloatingAddRow = useCallback(() => {
		scrollToTableBottom();
		handleAddRow();
	}, [handleAddRow, scrollToTableBottom]);

	const handleDeleteRows = useCallback(
		async (clickedRowId: string) => {
			const ids =
				selectedRowIds.size > 0 ? Array.from(selectedRowIds) : [clickedRowId];
			await Promise.all(
				ids.map((id) => deleteRowMutation.mutateAsync({ rowId: id })),
			);
			setSelectedRowIds(new Set());
			utils.table.getTableColumnType.invalidate({ id: tableId });
			utils.table.getInfiniteRows.invalidate(infiniteQueryInput);
		},
		[
			selectedRowIds,
			deleteRowMutation,
			setSelectedRowIds,
			utils.table.getTableColumnType,
			utils.table.getInfiniteRows,
			tableId,
			infiniteQueryInput,
		],
	);

	const addRowButtonDisabled = addRowMutation.isPending || columns.length === 0;

	return {
		handleAddColumn,
		handleRenameColumn,
		handleDuplicateColumn,
		handleDeleteColumn,
		handleAddRow,
		handleFloatingAddRow,
		handleDeleteRows,
		addRowButtonDisabled,
	};
}