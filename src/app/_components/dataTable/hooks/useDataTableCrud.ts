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
	addRowAtPositionMutation: any;
	duplicateRowAtPositionMutation: any;
	utils: any;
	infiniteQueryInput: any;
	selectedRowIds: Set<string>;
	setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	filteredRowsCount: number;
	rowVirtualizer: any;
	clearViewportCache?: () => void;
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
	addRowAtPositionMutation,
	duplicateRowAtPositionMutation,
	utils,
	infiniteQueryInput,
	selectedRowIds,
	setSelectedRowIds,
	filteredRowsCount,
	rowVirtualizer,
	clearViewportCache,
}: UseDataTableCrudParams) {
	const handleAddColumn = useCallback(
		(name: string, type: ColumnType) => {
			addColumnMutation.mutate({ tableId, name, type });
		},
		[addColumnMutation, tableId],
	);

	const handleRenameColumn = useCallback(
		(id: string, newName: string) => {
			if (newName?.trim()) {
				renameColumnMutation.mutate({
					colId: id,
					name: newName.trim(),
				});
			}
		},
		[renameColumnMutation],
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

	const handleInsertColumnLeft = useCallback(
		(id: string) => {
			// For now, just add a new column (we'll enhance this later to handle positions)
			addColumnMutation.mutate({ tableId, name: "New Field", type: "TEXT" });
		},
		[addColumnMutation, tableId],
	);

	const handleInsertColumnRight = useCallback(
		(id: string) => {
			// For now, just add a new column (we'll enhance this later to handle positions)
			addColumnMutation.mutate({ tableId, name: "New Field", type: "TEXT" });
		},
		[addColumnMutation, tableId],
	);

	const handleCopyFieldUrl = useCallback(
		(id: string) => {
			// Create a URL for the field (placeholder implementation)
			const url = `${window.location.origin}${window.location.pathname}?field=${id}`;
			navigator.clipboard.writeText(url);
			console.log('Field URL copied to clipboard');
		},
		[],
	);

	const handleEditDescription = useCallback(
		(id: string) => {
			// Placeholder - this would open a description editor
			console.log('Edit description for column:', id);
		},
		[],
	);

	const handleEditPermissions = useCallback(
		(id: string) => {
			// Placeholder - this would open a permissions editor
			console.log('Edit permissions for column:', id);
		},
		[],
	);

	const handleSortAZ = useCallback(
		(id: string) => {
			// Placeholder - this would implement sorting
			console.log('Sort A->Z for column:', id);
		},
		[],
	);

	const handleSortZA = useCallback(
		(id: string) => {
			// Placeholder - this would implement sorting
			console.log('Sort Z->A for column:', id);
		},
		[],
	);

	const handleFilter = useCallback(
		(id: string) => {
			// Placeholder - this would implement filtering
			console.log('Filter by column:', id);
		},
		[],
	);

	const handleGroup = useCallback(
		(id: string) => {
			// Placeholder - this would implement grouping
			console.log('Group by column:', id);
		},
		[],
	);

	const handleHideField = useCallback(
		(id: string) => {
			// Placeholder - this would hide the field
			console.log('Hide field:', id);
		},
		[],
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
			
			// Delete rows one by one and handle errors gracefully
			const deletePromises = ids.map(async (id) => {
				try {
					await deleteRowMutation.mutateAsync({ rowId: id });
					return { success: true, id };
				} catch (error) {
					console.warn(`Failed to delete row ${id}:`, error);
					return { success: false, id, error };
				}
			});
			
			const results = await Promise.all(deletePromises);
			const successCount = results.filter(r => r.success).length;
			
			if (successCount > 0) {
				console.log(`Successfully deleted ${successCount} rows`);
			}
			
			setSelectedRowIds(new Set());
			utils.table.getTableColumnType.invalidate({ id: tableId });
			utils.table.getInfiniteRows.invalidate(infiniteQueryInput);
			utils.table.getRowCount.invalidate({ id: tableId });
			// Also invalidate viewport fetching data if available
			utils.table.getRowsByRange.invalidate();
			// Clear viewport cache to force refetch
			clearViewportCache?.();
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

	const handleInsertRecordAbove = useCallback(
		(clickedRowId: string, rowsWithOptimistic: any[]) => {
			const clickedRow = rowsWithOptimistic.find(
				(row) => row.id === clickedRowId,
			);
			if (!clickedRow) return;

			const cells = columns.map((col) => ({ columnId: col.id, value: "" }));
			addRowAtPositionMutation.mutate({
				tableId,
				position: clickedRow.position,
				cells,
			});
		},
		[addRowAtPositionMutation, columns, tableId],
	);

	const handleInsertRecordBelow = useCallback(
		(clickedRowId: string, rowsWithOptimistic: any[]) => {
			const clickedRow = rowsWithOptimistic.find(
				(row) => row.id === clickedRowId,
			);
			if (!clickedRow) return;

			const cells = columns.map((col) => ({ columnId: col.id, value: "" }));
			addRowAtPositionMutation.mutate({
				tableId,
				position: clickedRow.position + 1,
				cells,
			});
		},
		[addRowAtPositionMutation, columns, tableId],
	);

	const handleDuplicateRecord = useCallback(
		(clickedRowId: string, rowsWithOptimistic: any[]) => {
			const clickedRow = rowsWithOptimistic.find(
				(row) => row.id === clickedRowId,
			);
			if (!clickedRow) return;

			duplicateRowAtPositionMutation.mutate({
				tableId,
				rowId: clickedRowId,
				position: clickedRow.position + 1,
			});
		},
		[duplicateRowAtPositionMutation, tableId],
	);

	const addRowButtonDisabled = addRowMutation.isPending || columns.length === 0;

	return {
		handleAddColumn,
		handleRenameColumn,
		handleDuplicateColumn,
		handleDeleteColumn,
		handleInsertColumnLeft,
		handleInsertColumnRight,
		handleCopyFieldUrl,
		handleEditDescription,
		handleEditPermissions,
		handleSortAZ,
		handleSortZA,
		handleFilter,
		handleGroup,
		handleHideField,
		handleAddRow,
		handleFloatingAddRow,
		handleDeleteRows,
		handleInsertRecordAbove,
		handleInsertRecordBelow,
		handleDuplicateRecord,
		addRowButtonDisabled,
	};
}
