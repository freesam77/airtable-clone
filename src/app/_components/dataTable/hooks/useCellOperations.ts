import { useCallback } from "react";
import type { CellHistoryChange } from "~/hooks/useSteps";
import type { ColumnMeta, TableData } from "~/types/dataTable";
import type { FillPreview, GridCell, SelectionRange } from "./useDataTableState";

interface UseCellOperationsParams {
	columns: ColumnMeta[];
	rowsWithOptimistic: TableData[];
	visibleColumns: ColumnMeta[];
	rowIndexLookup: Map<string, number>;
	columnIndexLookup: Map<string, number>;
	handleCellUpdate: (rowId: string, columnId: string, value: string | number | null) => void;
	recordUndoStep: (changes: CellHistoryChange | CellHistoryChange[]) => void;
	getCellByIndex: (rowIndex: number, columnIndex: number) => GridCell | null;
	setActiveCell: (cell: GridCell | null) => void;
	setSelection: (selection: SelectionRange) => void;
	setFillPreview: (preview: FillPreview | null) => void;
}

export const toHistoryValue = (
	value: string | number | null | undefined,
): string | null => {
	if (value === null || value === undefined) return null;
	return String(value);
};

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

export function useCellOperations({
	columns,
	rowsWithOptimistic,
	visibleColumns,
	rowIndexLookup,
	columnIndexLookup,
	handleCellUpdate,
	recordUndoStep,
	getCellByIndex,
	setActiveCell,
	setSelection,
	setFillPreview,
}: UseCellOperationsParams) {
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

	const updateFillPreview = useCallback(
		(origin: GridCell, target: GridCell) => {
			if (origin.columnId !== target.columnId) {
				setFillPreview(null);
				return;
			}
			const originRow = rowIndexLookup.get(origin.rowId);
			const targetRow = rowIndexLookup.get(target.rowId);
			if (originRow === undefined || targetRow === undefined) {
				setFillPreview(null);
				return;
			}
			if (originRow === targetRow) {
				setFillPreview(null);
				return;
			}
			const step = originRow < targetRow ? 1 : -1;
			const rows: number[] = [];
			for (
				let idx = originRow + step;
				step === 1 ? idx <= targetRow : idx >= targetRow;
				idx += step
			) {
				rows.push(idx);
			}
			setFillPreview({ columnId: origin.columnId, rows });
		},
		[rowIndexLookup, setFillPreview],
	);

	const applyFillFromPreview = useCallback(
		(preview: FillPreview | null, anchor: GridCell | null) => {
			if (!preview || preview.rows.length === 0 || !anchor) {
				return;
			}
			const anchorRowIndex = rowIndexLookup.get(anchor.rowId);
			if (anchorRowIndex === undefined) return;
			const anchorRow = rowsWithOptimistic[anchorRowIndex];
			if (!anchorRow) return;
			const sourceValue =
				anchorRow.cells.find((cell) => cell.columnId === preview.columnId)
					?.value ?? null;
			const historyChanges: CellHistoryChange[] = [];
			const nextHistoryValue = toHistoryValue(sourceValue);

			for (const rowIndex of preview.rows) {
				const targetRow = rowsWithOptimistic[rowIndex];
				if (!targetRow) continue;
				const previousValue =
					targetRow.cells.find((cell) => cell.columnId === preview.columnId)
						?.value ?? null;
				const previousHistoryValue = toHistoryValue(previousValue);
				if (previousHistoryValue === nextHistoryValue) continue;

				historyChanges.push({
					rowId: targetRow.id,
					columnId: preview.columnId,
					previousValue: previousHistoryValue,
					nextValue: nextHistoryValue,
				});

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
			rowsWithOptimistic,
			getCellByIndex,
			handleCellUpdate,
			recordUndoStep,
			rowIndexLookup,
			setActiveCell,
			setSelection,
		],
	);

	const moveSelection = useCallback(
		(deltaRow: number, deltaCol: number, extend: boolean, activeCell: GridCell | null, selectionRef: React.MutableRefObject<SelectionRange | null>, activeCellRef: React.MutableRefObject<GridCell | null>, selectCell: (cell: GridCell, options?: { extend?: boolean }) => void, rowVirtualizer: any) => {
			const baseCell = extend
				? (selectionRef.current?.focus ?? activeCellRef.current)
				: activeCellRef.current;
			if (!baseCell) return;
			const currentRowIndex = rowIndexLookup.get(baseCell.rowId);
			const currentColIndex = columnIndexLookup.get(baseCell.columnId);
			if (
				currentRowIndex === undefined ||
				currentColIndex === undefined ||
				rowsWithOptimistic.length === 0 ||
				visibleColumns.length === 0
			) {
				return;
			}
			const nextRowIndex = clamp(
				currentRowIndex + deltaRow,
				0,
				Math.max(rowsWithOptimistic.length - 1, 0),
			);
			const nextColIndex = clamp(
				currentColIndex + deltaCol,
				0,
				Math.max(visibleColumns.length - 1, 0),
			);
			const nextCell = getCellByIndex(nextRowIndex, nextColIndex);
			if (!nextCell) return;
			selectCell(nextCell, { extend });
			rowVirtualizer.scrollToIndex(nextRowIndex, { align: "auto" });
		},
		[
			rowIndexLookup,
			columnIndexLookup,
			rowsWithOptimistic.length,
			visibleColumns.length,
			getCellByIndex,
		],
	);

	return {
		normalizeValueForColumn,
		updateFillPreview,
		applyFillFromPreview,
		moveSelection,
	};
}