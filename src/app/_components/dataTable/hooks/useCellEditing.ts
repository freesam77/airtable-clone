import { useCallback } from "react";
import type { CellHistoryChange } from "~/hooks/useSteps";
import type { ColumnMeta, TableData } from "../columnDefs";
import type {
	FillPreview,
	GridCell,
	SelectionRange,
} from "./useDataTableState";

type ValueOrUpdater<T> = T | ((prev: T) => T);

interface UseCellEditingParams {
	columns: ColumnMeta[];
	queueCellUpdate: (
		rowId: string,
		columnId: string,
		value?: string | number,
	) => void;
	flushPendingUpdates: () => void;
	recordUndoStep: (changes: CellHistoryChange | CellHistoryChange[]) => void;
	scrollParentRef: React.RefObject<HTMLDivElement | null>;
	rowIndexLookup: Map<string, number>;
	columnIndexLookup: Map<string, number>;
	filteredRows: TableData[];
	visibleColumns: ColumnMeta[];
	selection: SelectionRange | null;
	setSelection: (value: ValueOrUpdater<SelectionRange | null>) => void;
	getCellByIndex: (rowIndex: number, columnIndex: number) => GridCell | null;
	editingCell: GridCell | null;
	setEditingCell: (cell: GridCell | null) => void;
	activeCell: GridCell | null;
	setActiveCell: (cell: GridCell | null) => void;
}

export function useCellEditing({
	columns,
	queueCellUpdate,
	flushPendingUpdates,
	recordUndoStep,
	scrollParentRef,
	rowIndexLookup,
	columnIndexLookup,
	filteredRows,
	visibleColumns,
	selection,
	setSelection,
	getCellByIndex,
	editingCell,
	setEditingCell,
	activeCell,
	setActiveCell,
}: UseCellEditingParams) {
	const normalizeValueForColumn = useCallback(
		(
			columnId: string,
			input: string | number | null | undefined,
		): string | null => {
			const column = columns.find((col) => col.id === columnId);
			if (!column) {
				if (input === null || input === undefined) return null;
				return typeof input === "number" ? String(input) : input;
			}

			if (input === null || input === undefined) {
				return null;
			}

			if (column.type === "NUMBER") {
				const raw = typeof input === "number" ? String(input) : input.trim();
				if (raw === "") return null;
				const parsed = Number(raw);
				if (!Number.isFinite(parsed)) {
					return null;
				}
				return String(parsed);
			}

			return typeof input === "number" ? String(input) : input;
		},
		[columns],
	);

	const handleCellUpdate = useCallback(
		(rowId: string, columnId: string, value: string | number | null) => {
			const nextValue = normalizeValueForColumn(columnId, value);
			const payload = nextValue ?? "";
			queueCellUpdate(rowId, columnId, payload);
			flushPendingUpdates();
		},
		[flushPendingUpdates, normalizeValueForColumn, queueCellUpdate],
	);

	const startEditing = useCallback(
		(cell: GridCell | null) => {
			if (!cell) return;
			if (
				!rowIndexLookup.has(cell.rowId) ||
				!columnIndexLookup.has(cell.columnId)
			) {
				return;
			}
			setEditingCell(cell);
		},
		[columnIndexLookup, rowIndexLookup, setEditingCell],
	);

	const handleCommitEdit = useCallback(
		(
			rowId: string,
			columnId: string,
			nextValue: string,
			previousValue: string | number | null,
		) => {
			const normalizedNext = normalizeValueForColumn(columnId, nextValue);
			const previousHistoryValue =
				previousValue === null || previousValue === undefined
					? null
					: String(previousValue);
			const nextHistoryValue = normalizedNext;
			if (previousHistoryValue !== nextHistoryValue) {
				recordUndoStep({
					rowId,
					columnId,
					previousValue: previousHistoryValue,
					nextValue: nextHistoryValue,
				});
			}
			handleCellUpdate(rowId, columnId, normalizedNext);
			setEditingCell(null);
			scrollParentRef.current?.focus();
		},
		[
			handleCellUpdate,
			normalizeValueForColumn,
			recordUndoStep,
			scrollParentRef,
			setEditingCell,
		],
	);

	const handleCancelEdit = useCallback(() => {
		if (!editingCell) return;
		setEditingCell(null);
		scrollParentRef.current?.focus();
	}, [editingCell, scrollParentRef, setEditingCell]);

	const getCellDisplayValue = useCallback(
		(row: TableData, columnId: string) =>
			row.cells.find((cell) => cell.columnId === columnId)?.value ?? null,
		[],
	);

	const copySelectionToClipboard = useCallback(async () => {
		if (typeof navigator === "undefined" || !navigator.clipboard) return;
		const range =
			selection ??
			(activeCell ? { anchor: activeCell, focus: activeCell } : null);
		if (!range) return;
		const anchorRow = rowIndexLookup.get(range.anchor.rowId);
		const focusRow = rowIndexLookup.get(range.focus.rowId);
		const anchorCol = columnIndexLookup.get(range.anchor.columnId);
		const focusCol = columnIndexLookup.get(range.focus.columnId);
		if (
			anchorRow === undefined ||
			focusRow === undefined ||
			anchorCol === undefined ||
			focusCol === undefined
		) {
			return;
		}
		const rowStart = Math.min(anchorRow, focusRow);
		const rowEnd = Math.max(anchorRow, focusRow);
		const colStart = Math.min(anchorCol, focusCol);
		const colEnd = Math.max(anchorCol, focusCol);
		const lines: string[] = [];
		for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex++) {
			const row = filteredRows[rowIndex];
			if (!row) continue;
			const values: string[] = [];
			for (let colIndex = colStart; colIndex <= colEnd; colIndex++) {
				const column = visibleColumns[colIndex];
				if (!column) continue;
				const value = getCellDisplayValue(row, column.id);
				values.push(value === null || value === undefined ? "" : String(value));
			}
			lines.push(values.join("\t"));
		}
		await navigator.clipboard.writeText(lines.join("\n"));
	}, [
		activeCell,
		columnIndexLookup,
		filteredRows,
		getCellDisplayValue,
		rowIndexLookup,
		selection,
		visibleColumns,
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
			filteredRows.length === 0 ||
			visibleColumns.length === 0
		) {
			return;
		}
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
				if (
					targetRowIndex >= filteredRows.length ||
					targetColIndex >= visibleColumns.length
				) {
					return;
				}
				const targetRow = filteredRows[targetRowIndex];
				const targetCol = visibleColumns[targetColIndex];
				if (!targetRow || !targetCol) return;
				const previousValue =
					targetRow.cells.find((cell) => cell.columnId === targetCol.id)
						?.value ?? null;
				const previousHistoryValue =
					previousValue === null || previousValue === undefined
						? null
						: String(previousValue);
				const normalizedNext = normalizeValueForColumn(targetCol.id, cellValue);
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
	}, [
		activeCell,
		columnIndexLookup,
		filteredRows,
		getCellByIndex,
		handleCellUpdate,
		normalizeValueForColumn,
		recordUndoStep,
		rowIndexLookup,
		setSelection,
		visibleColumns,
	]);

	const applyFillFromPreview = useCallback(
		(preview: FillPreview | null, anchor: GridCell | null) => {
			if (!preview || preview.rows.length === 0 || !anchor) {
				return;
			}
			const anchorRowIndex = rowIndexLookup.get(anchor.rowId);
			if (anchorRowIndex === undefined) return;
			const anchorRow = filteredRows[anchorRowIndex];
			if (!anchorRow) return;
			const sourceValue =
				anchorRow.cells.find((cell) => cell.columnId === preview.columnId)
					?.value ?? null;
			const historyChanges: CellHistoryChange[] = [];
			const nextHistoryValue =
				sourceValue === null || sourceValue === undefined
					? null
					: String(sourceValue);
			for (const rowIndex of preview.rows) {
				const targetRow = filteredRows[rowIndex];
				if (!targetRow) continue;
				const previousValue =
					targetRow.cells.find((cell) => cell.columnId === preview.columnId)
						?.value ?? null;
				const previousHistoryValue =
					previousValue === null || previousValue === undefined
						? null
						: String(previousValue);
				if (previousHistoryValue !== nextHistoryValue) {
					historyChanges.push({
						rowId: targetRow.id,
						columnId: preview.columnId,
						previousValue: previousHistoryValue,
						nextValue: nextHistoryValue,
					});
				}
				handleCellUpdate(targetRow.id, preview.columnId, sourceValue ?? "");
			}
			if (historyChanges.length > 0) {
				recordUndoStep(historyChanges);
			}
			const focusRowIndex = preview.rows[preview.rows.length - 1];
			if (focusRowIndex === undefined) return;
			const columnIndex = columnIndexLookup.get(preview.columnId);
			const focusCell =
				columnIndex !== undefined
					? getCellByIndex(focusRowIndex, columnIndex)
					: null;
			if (focusCell) {
				setSelection({ anchor, focus: focusCell });
				setActiveCell(anchor);
			}
		},
		[
			columnIndexLookup,
			filteredRows,
			getCellByIndex,
			handleCellUpdate,
			recordUndoStep,
			rowIndexLookup,
			setActiveCell,
			setSelection,
		],
	);

	return {
		startEditing,
		handleCommitEdit,
		handleCancelEdit,
		handleCellUpdate,
		copySelectionToClipboard,
		pasteClipboardData,
		applyFillFromPreview,
	};
}
