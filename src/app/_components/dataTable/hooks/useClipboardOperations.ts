import { useCallback } from "react";
import type { CellHistoryChange } from "~/hooks/useSteps";
import type { ColumnMeta, TableData } from "~/types/dataTable";
import type { GridCell, SelectionRange } from "./useDataTableState";
import { toHistoryValue } from "./useCellOperations";

interface UseClipboardOperationsParams {
	activeCell: GridCell | null;
	selection: SelectionRange | null;
	rowsWithOptimistic: TableData[];
	visibleColumns: ColumnMeta[];
	rowIndexLookup: Map<string, number>;
	columnIndexLookup: Map<string, number>;
	getSelectionBounds: (sel: SelectionRange | null) => {
		rowStart: number;
		rowEnd: number;
		colStart: number;
		colEnd: number;
	} | null;
	normalizeValueForColumn: (
		columnId: string,
		input: string | number | null | undefined,
	) => string | null;
	handleCellUpdate: (
		rowId: string,
		columnId: string,
		value: string | number | null,
	) => void;
	recordUndoStep: (changes: CellHistoryChange | CellHistoryChange[]) => void;
	getCellByIndex: (rowIndex: number, columnIndex: number) => GridCell | null;
	setSelection: (selection: SelectionRange) => void;
	getRowByIndex?: (rowIndex: number) => TableData | null; // Helper to get row from any source
}


export function useClipboardOperations({
	activeCell,
	selection,
	rowsWithOptimistic,
	visibleColumns,
	rowIndexLookup,
	columnIndexLookup,
	getSelectionBounds,
	normalizeValueForColumn,
	handleCellUpdate,
	recordUndoStep,
	getCellByIndex,
	setSelection,
	getRowByIndex,
}: UseClipboardOperationsParams) {
	const getCellDisplayValue = useCallback(
		(row: TableData, columnId: string) =>
			row.cells.find((cell) => cell.columnId === columnId)?.value ?? null,
		[],
	);

	const copySelectionToClipboard = useCallback(async () => {
		if (typeof navigator === "undefined" || !navigator.clipboard) return;
		const targetSelection =
			selection ??
			(activeCell ? { anchor: activeCell, focus: activeCell } : null);
		const bounds = getSelectionBounds(targetSelection);
		if (!bounds) return;

		const lines: string[] = [];
		for (
			let rowIndex = bounds.rowStart;
			rowIndex <= bounds.rowEnd;
			rowIndex++
		) {
			// Use getRowByIndex if available, otherwise fall back to regular data
			const row = getRowByIndex ? getRowByIndex(rowIndex) : rowsWithOptimistic[rowIndex];
			if (!row) continue;
			const values: string[] = [];
			for (
				let colIndex = bounds.colStart;
				colIndex <= bounds.colEnd;
				colIndex++
			) {
				const column = visibleColumns[colIndex];
				if (!column) continue;
				const value = getCellDisplayValue(row, column.id);
				values.push(value === null || value === undefined ? "" : String(value));
			}
			lines.push(values.join("\t"));
		}

		try {
			await navigator.clipboard.writeText(lines.join("\n"));
		} catch (error) {
			console.error("Copy failed", error);
		}
	}, [
		activeCell,
		rowsWithOptimistic,
		getCellDisplayValue,
		getSelectionBounds,
		selection,
		visibleColumns,
		getRowByIndex,
	]);

	const pasteClipboardData = useCallback(async () => {
		if (
			typeof navigator === "undefined" ||
			!navigator.clipboard ||
			!activeCell
		) {
			return;
		}
		const startRowIndex = rowIndexLookup.get(activeCell.rowId);
		const startColIndex = columnIndexLookup.get(activeCell.columnId);
		if (
			startRowIndex === undefined ||
			startColIndex === undefined ||
			rowsWithOptimistic.length === 0 ||
			visibleColumns.length === 0
		) {
			return;
		}
		try {
			const text = await navigator.clipboard.readText();
			if (!text) return;
			const rawRows = text.replace(/\r/g, "").split("\n");
			const rows = rawRows.filter(
				(line, idx) =>
					!(line === "" && idx === rawRows.length - 1 && rawRows.length > 1),
			);
			let furthestRow = startRowIndex;
			let furthestCol = startColIndex;
			const historyChanges: CellHistoryChange[] = [];
			rows.forEach((line, rowOffset) => {
				const values = line.split("\t");
				values.forEach((cellValue, colOffset) => {
					const targetRowIndex = startRowIndex + rowOffset;
					const targetColIndex = startColIndex + colOffset;
					if (targetColIndex >= visibleColumns.length) {
						return;
					}
					// Use getRowByIndex if available, otherwise fall back to regular data
					const targetRow = getRowByIndex ? getRowByIndex(targetRowIndex) : 
						(targetRowIndex < rowsWithOptimistic.length ? rowsWithOptimistic[targetRowIndex] : null);
					const targetCol = visibleColumns[targetColIndex];
					if (!targetRow || !targetCol) return;
					const previousValue =
						targetRow.cells.find((cell) => cell.columnId === targetCol.id)
							?.value ?? null;
					const previousHistoryValue = toHistoryValue(previousValue);
					const normalizedNext = normalizeValueForColumn(
						targetCol.id,
						cellValue,
					);
					const nextHistoryValue = normalizedNext;
					if (previousHistoryValue !== nextHistoryValue) {
						historyChanges.push({
							rowId: targetRow.id,
							columnId: targetCol.id,
							previousValue: previousHistoryValue,
							nextValue: nextHistoryValue,
						});
					}
					handleCellUpdate(targetRow.id, targetCol.id, normalizedNext);
					furthestRow = Math.max(furthestRow, targetRowIndex);
					furthestCol = Math.max(furthestCol, targetColIndex);
				});
			});
			recordUndoStep(historyChanges);
			const focusCell = getCellByIndex(furthestRow, furthestCol);
			if (focusCell) {
				setSelection({ anchor: activeCell, focus: focusCell });
			}
		} catch (error) {
			console.error("Paste failed", error);
		}
	}, [
		activeCell,
		columnIndexLookup,
		rowsWithOptimistic,
		getCellByIndex,
		handleCellUpdate,
		normalizeValueForColumn,
		recordUndoStep,
		rowIndexLookup,
		visibleColumns,
		getSelectionBounds,
		setSelection,
		getRowByIndex,
	]);

	return {
		copySelectionToClipboard,
		pasteClipboardData,
		getCellDisplayValue,
	};
}
