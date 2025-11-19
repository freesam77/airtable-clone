import { useCallback } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GridCell } from "./useDataTableState";

interface UseKeyboardNavigationParams {
	activeCell: GridCell | null;
	editingCell: GridCell | null;
	osName: string;
	moveSelection: (deltaRow: number, deltaCol: number, extend: boolean) => void;
	moveHorizontallyFromCell: (cell: GridCell | null, deltaCol: number) => void;
	handleCellUpdate: (rowId: string, columnId: string, value: string) => void;
	copySelectionToClipboard: () => Promise<void>;
	pasteClipboardData: () => Promise<void>;
	undoLastStep: () => void;
	redoLastStep: () => void;
	startEditing: (cell: GridCell | null, initialValue?: string) => void;
	scrollParentRef: React.RefObject<HTMLDivElement | null>;
}

export function useKeyboardNavigation({
	activeCell,
	editingCell,
	osName,
	moveSelection,
	moveHorizontallyFromCell,
	handleCellUpdate,
	copySelectionToClipboard,
	pasteClipboardData,
	undoLastStep,
	redoLastStep,
	startEditing,
	scrollParentRef,
}: UseKeyboardNavigationParams) {
	const isPrintableKey = (event: ReactKeyboardEvent<HTMLDivElement>) =>
		event.key.length === 1 &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey &&
		!event.repeat;

	const handleGridKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLDivElement>) => {
			if (!activeCell) return;
			const useMeta = osName === "macOS" || osName === "iOS";
			const isMod = useMeta ? event.metaKey : event.ctrlKey;
			const key = event.key;

			if (isMod && key.toLowerCase() === "z" && !editingCell) {
				event.preventDefault();
				if (event.shiftKey) {
					redoLastStep();
				} else {
					undoLastStep();
				}
				return;
			}

			if (isMod) {
				const lowered = key.toLowerCase();
				if (lowered === "c") {
					event.preventDefault();
					copySelectionToClipboard();
					return;
				}
				if (lowered === "v") {
					event.preventDefault();
					pasteClipboardData();
					return;
				}
			}

			if (editingCell) return;

			switch (key) {
				case "Enter":
					event.preventDefault();
					startEditing(activeCell);
					return;
				case "Tab":
					event.preventDefault();
					moveHorizontallyFromCell(activeCell, event.shiftKey ? -1 : 1);
					scrollParentRef.current?.focus();
					return;
				case "ArrowDown":
					event.preventDefault();
					moveSelection(1, 0, event.shiftKey);
					return;
				case "ArrowUp":
					event.preventDefault();
					moveSelection(-1, 0, event.shiftKey);
					return;
				case "ArrowLeft":
					event.preventDefault();
					moveSelection(0, -1, event.shiftKey);
					return;
				case "ArrowRight":
					event.preventDefault();
					moveSelection(0, 1, event.shiftKey);
					return;
				case "Delete":
				case "Backspace":
					event.preventDefault();
					handleCellUpdate(activeCell.rowId, activeCell.columnId, "");
					return;
				default:
					if (isPrintableKey(event)) {
						event.preventDefault();
						startEditing(activeCell, event.key);
						return;
					}
					break;
			}
		},
		[
			activeCell,
			copySelectionToClipboard,
			editingCell,
			handleCellUpdate,
			moveSelection,
			moveHorizontallyFromCell,
			osName,
			pasteClipboardData,
			startEditing,
			undoLastStep,
			redoLastStep,
			isPrintableKey,
			scrollParentRef,
		],
	);

	return { handleGridKeyDown };
}