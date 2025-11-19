import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GridCell, SelectionRange, FillPreview } from "./useDataTableState";

interface UseCellInteractionsParams {
	rowIndexLookup: Map<string, number>;
	columnIndexLookup: Map<string, number>;
	setEditingCell: (cell: GridCell | null) => void;
	setActiveCell: (cell: GridCell | null) => void;
	setSelection: (selection: SelectionRange | null) => void;
	setFillPreview: (preview: FillPreview | null) => void;
	updateFillPreview: (origin: GridCell, target: GridCell) => void;
	startEditing: (cell: GridCell | null, initialValue?: string) => void;
	selectCell: (cell: GridCell, options?: { extend?: boolean; anchorOverride?: GridCell }) => void;
	scrollParentRef: React.RefObject<HTMLDivElement | null>;
	selectionRef: React.MutableRefObject<SelectionRange | null>;
	activeCellRef: React.MutableRefObject<GridCell | null>;
}

export function useCellInteractions({
	rowIndexLookup,
	columnIndexLookup,
	setEditingCell,
	setActiveCell,
	setSelection,
	setFillPreview,
	updateFillPreview,
	startEditing,
	selectCell,
	scrollParentRef,
	selectionRef,
	activeCellRef,
}: UseCellInteractionsParams) {
	const pointerModeRef = useRef<"range" | "fill" | null>(null);
	const pointerAnchorRef = useRef<GridCell | null>(null);

	const handleCellPointerDown = useCallback(
		(
			event: ReactPointerEvent<HTMLTableCellElement>,
			cell: GridCell,
			isSelectable: boolean,
		) => {
			if (!isSelectable || event.button !== 0) return;
			const target = event.target as HTMLElement | null;
			if (target?.closest("[data-fill-handle]")) return;
			if (target?.closest("input,textarea,select,[contenteditable='true']")) {
				return;
			}
			event.preventDefault();
			scrollParentRef.current?.focus();
			setEditingCell(null);
			const anchorOverride = event.shiftKey
				? (selectionRef.current?.anchor ?? activeCellRef.current ?? cell)
				: undefined;
			pointerModeRef.current = "range";
			pointerAnchorRef.current = anchorOverride ?? cell;
			selectCell(cell, { extend: event.shiftKey, anchorOverride });
			if (event.detail === 2 && !event.shiftKey) {
				startEditing(cell);
			}
		},
		[selectCell, startEditing, scrollParentRef, setEditingCell, selectionRef, activeCellRef],
	);

	const handleCellPointerEnter = useCallback(
		(cell: GridCell, isSelectable: boolean) => {
			if (!isSelectable) return;
			if (pointerModeRef.current === "range" && pointerAnchorRef.current) {
				setEditingCell(null);
				setActiveCell(cell);
				setSelection({ anchor: pointerAnchorRef.current, focus: cell });
			} else if (
				pointerModeRef.current === "fill" &&
				pointerAnchorRef.current
			) {
				updateFillPreview(pointerAnchorRef.current, cell);
			}
		},
		[updateFillPreview, setEditingCell, setActiveCell, setSelection],
	);

	const handleFillPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLSpanElement>, cell: GridCell) => {
			event.stopPropagation();
			event.preventDefault();
			if (
				!rowIndexLookup.has(cell.rowId) ||
				!columnIndexLookup.has(cell.columnId)
			) {
				return;
			}
			scrollParentRef.current?.focus();
			pointerModeRef.current = "fill";
			pointerAnchorRef.current = cell;
			setFillPreview(null);
			setEditingCell(null);
		},
		[rowIndexLookup, columnIndexLookup, scrollParentRef, setFillPreview, setEditingCell],
	);

	const finalizePointer = useCallback(() => {
		pointerModeRef.current = null;
		pointerAnchorRef.current = null;
		setFillPreview(null);
	}, [setFillPreview]);

	return {
		handleCellPointerDown,
		handleCellPointerEnter,
		handleFillPointerDown,
		finalizePointer,
		pointerAnchorRef,
	};
}