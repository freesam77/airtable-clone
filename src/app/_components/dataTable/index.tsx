"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "~/components/ui/context-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useTableMutations } from "~/hooks/useTableMutations";
import { useTableSearchNavigation } from "~/hooks/useTableSearchNavigation";
import { type CellHistoryChange, useUndoStack } from "~/hooks/useUndoStack";
import { detectOS } from "~/lib/detectOS";
import { filterRowsByQuery, rowMatchesQuery } from "~/lib/tableFilter";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { ViewsHeader } from "./ViewsHeader";
import { ViewsSidebar } from "./ViewsSidebar";
import { AddColumnDropdown } from "./addColumnDropdown";
import { type TableData as TableRowData, createColumnDefs } from "./columnDefs";
import { applyFilters } from "./filter/Filters";
import { applySorts } from "./filter/Sorts";
import { useViewFilter } from "./filter/useViewFilter";
import {
	type FillPreview,
	type GridCell,
	type SelectionRange,
	useDataTableState,
} from "./hooks/useDataTableState";

// Column helpers and definitions extracted to dataTable/columnDefs

// Extend the column meta type to include className
declare module "@tanstack/react-table" {
	interface ColumnMeta<TData, TValue> {
		className?: string;
		// Optional: used for editor input typing
		type?: "TEXT" | "NUMBER";
	}
}

type Cell = {
	id: string;
	columnId: string;
	value: string | null;
	rowId: string;
	column: {
		id: string;
		name: string;
		type: "TEXT" | "NUMBER";
		required: boolean;
		position: number;
		tableId: string;
	};
};

type TableData = {
	id: string;
	position: number;
	createdAt: Date;
	updatedAt: Date;
	tableId: string;
	cells: Array<Cell>;
};

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const toHistoryValue = (
	value: string | number | null | undefined,
): string | null => {
	if (value === null || value === undefined) return null;
	return String(value);
};

interface DataTableProps {
	tableId: string;
}

export function DataTable({ tableId }: DataTableProps) {
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [viewSidebarOpen, setViewSidebarOpen] = useState(true);
	const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
	const [showCheckboxes, setShowCheckboxes] = useState(false);
	const osName = useMemo(() => detectOS(), []);
	const {
		state: interactionState,
		setActiveCell,
		setSelection,
		setEditingCell,
		setFillPreview,
	} = useDataTableState();
	const { activeCell, selection, editingCell, fillPreview } = interactionState;
	const { pushStep, popStep } = useUndoStack();
	const recordUndoStep = useCallback(
		(changes: CellHistoryChange | CellHistoryChange[]) => {
			const arr = Array.isArray(changes) ? changes : [changes];
			const filtered = arr.filter(
				(change) => change.previousValue !== change.nextValue,
			);
			if (filtered.length === 0) return;
			pushStep(filtered);
		},
		[pushStep],
	);

	const pointerModeRef = useRef<"range" | "fill" | null>(null);
	const pointerAnchorRef = useRef<GridCell | null>(null);
	const activeCellRef = useRef<GridCell | null>(null);
	const selectionRef = useRef<SelectionRange | null>(null);
	const scrollParentRef = useRef<HTMLDivElement | null>(null);
	const handleNavigateFromCellRef = useRef<
		((cell: GridCell, direction: "forward" | "backward") => void) | null
	>(null);
	const initialEditValueRef = useRef<string | null>(null);

	useEffect(() => {
		activeCellRef.current = activeCell;
	}, [activeCell]);

	useEffect(() => {
		selectionRef.current = selection;
	}, [selection]);

	useEffect(() => {
		if (!editingCell) {
			initialEditValueRef.current = null;
		}
	}, [editingCell]);

	// Fetch table metadata for columns
	const { data: tableColumn, isLoading: tableColumnLoading } =
		api.table.getTableColumnType.useQuery(
			{ id: tableId },
			{
				retry: (failureCount, error) => {
					if (error?.data?.code === "UNAUTHORIZED") {
						return false;
					}
					return failureCount < 3;
				},
			},
		);

	const infiniteQueryInput = {
		id: tableId,
		limit: 200 as const,
		direction: "forward" as const,
	};
	const rowsInfinite = api.table.getInfiniteRows.useInfiniteQuery(
		infiniteQueryInput,
		{
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			getPreviousPageParam: (firstPage) => firstPage.prevCursor,
		},
	);

	// No global sentinel needed; we observe the last rendered row

	// Flatten paged rows for the table
	const data = useMemo(
		() => rowsInfinite.data?.pages.flatMap((p) => p.items) ?? [],
		[rowsInfinite.data],
	);
	const columns = tableColumn?.columns || [];

	// Stable ordered columns list used for filtering and match navigation
	const orderedColumns = useMemo(
		() => [...columns].sort((a, b) => a.position - b.position),
		[columns],
	);

	const {
		views,
		viewsLoading,
		activeView,
		filters,
		sorts,
		hiddenColumnIds,
		autoSort,
		canDeleteView,
		handleUpdateView,
		handleSelectView,
		handleCreateView,
		handleRenameView,
		handleDuplicateView,
		handleDeleteView,
		handleReorderView,
	} = useViewFilter(tableId);

	const hiddenColumnSet = useMemo(
		() => new Set(hiddenColumnIds),
		[hiddenColumnIds],
	);

	const visibleColumns = useMemo(
		() => orderedColumns.filter((col) => !hiddenColumnSet.has(col.id)),
		[orderedColumns, hiddenColumnSet],
	);

	useEffect(() => {
		const available = new Set(orderedColumns.map((col) => col.id));
		const filtered = hiddenColumnIds.filter((id) => available.has(id));
		if (filtered.length !== hiddenColumnIds.length) {
			handleUpdateView({ hiddenColumnIds: filtered });
		}
	}, [orderedColumns, hiddenColumnIds, handleUpdateView]);

	const utils = api.useUtils();

	// Optimistic update function for immediate UI feedback
	const handleOptimisticUpdate = useCallback(
		(rowId: string, columnId: string, value?: string | number) => {
			const stringValue = typeof value === "number" ? String(value) : value;
			const normalized = stringValue === "" ? null : stringValue;
			utils.table.getInfiniteRows.setInfiniteData(infiniteQueryInput, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.map((row) =>
							row.id === rowId
								? {
										...row,
										cells: row.cells.map((cell) =>
											cell.column.id === columnId
												? { ...cell, value: normalized ?? null }
												: cell,
										),
									}
								: row,
						),
					})),
				};
			});
		},
		[utils.table.getInfiniteRows, tableId],
	);

	const {
		queueCellUpdate,
		flushPendingUpdates,
		addRowMutation,
		addColumnMutation,
		deleteRowMutation,
		deleteColumnMutation,
		renameColumnMutation,
		duplicateColumnMutation,
	} = useTableMutations({
		tableId,
		infiniteInput: infiniteQueryInput,
		onOptimisticUpdate: handleOptimisticUpdate,
	});

	// Handle cell value updates using the queue
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

	const handleCommitEdit = useCallback(
		(
			rowId: string,
			columnId: string,
			nextValue: string,
			previousValue: string | number | null,
		) => {
			const normalizedNext = normalizeValueForColumn(columnId, nextValue);
			const previousHistoryValue = toHistoryValue(previousValue);
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
		[handleCellUpdate, normalizeValueForColumn, recordUndoStep],
	);

	const handleCancelEdit = useCallback(() => {
		setEditingCell(null);
		scrollParentRef.current?.focus();
	}, []);

	const displayData = useMemo<TableData[]>(() => {
		const pre = filterRowsByQuery(
			data,
			orderedColumns,
			searchValue,
		) as unknown as TableData[];
		const filtered = applyFilters<TableData>(
			data,
			orderedColumns,
			pre,
			filters,
		) as unknown as TableData[];
		return applySorts<TableData>(filtered, orderedColumns, sorts, autoSort);
	}, [data, orderedColumns, searchValue, filters, sorts, autoSort]);

	const filteredRows = displayData;

	// Pre-filter rows using the same logic as the global filter so non-matching rows are hidden at the data level too

	// Create column definitions dynamically based on the table structure
	const handleAddColumn = useCallback(
		(name: string, type: "TEXT" | "NUMBER") => {
			addColumnMutation.mutate({ tableId, name, type });
		},
		[addColumnMutation, tableId],
	);
	const getInitialEditValue = useCallback(
		(cell: GridCell) => {
			if (
				!editingCell ||
				editingCell.rowId !== cell.rowId ||
				editingCell.columnId !== cell.columnId
			) {
				return null;
			}
			return initialEditValueRef.current;
		},
		[editingCell],
	);

	const consumeInitialEditValue = useCallback(() => {
		initialEditValueRef.current = null;
	}, []);

	const columnDefs: ColumnDef<TableRowData>[] = createColumnDefs({
		columns: visibleColumns,
		displayData: displayData,
		selectedRowIds,
		setSelectedRowIds,
		showCheckboxes,
		setShowCheckboxes,
		editingCell,
		onCommitEdit: handleCommitEdit,
		onCancelEdit: handleCancelEdit,
		onNavigate: (cell, direction) =>
			handleNavigateFromCellRef.current?.(cell, direction),
		getInitialEditValue,
		onInitialValueConsumed: consumeInitialEditValue,
	}) as unknown as ColumnDef<TableData>[];

	const table = useReactTable<TableData>({
		data: displayData,
		columns: columnDefs,
		getCoreRowModel: getCoreRowModel(),
		// Drive TanStack's global filter from our searchValue state
		state: { globalFilter: searchValue },
		onGlobalFilterChange: setSearchValue,
		// Use a custom global filter that hides rows with no matching cells
		globalFilterFn: (row, _columnId, filterValue) =>
			rowMatchesQuery(row.original, orderedColumns, String(filterValue ?? "")),
		enableColumnPinning: true,
		initialState: {
			columnPinning: {
				left: ["row-number"],
			},
		},
	});
	const rowIndexLookup = useMemo(() => {
		const map = new Map<string, number>();
		filteredRows.forEach((row, index) => map.set(row.id, index));
		return map;
	}, [filteredRows]);

	const columnIndexLookup = useMemo(() => {
		const map = new Map<string, number>();
		visibleColumns.forEach((col, index) => map.set(col.id, index));
		return map;
	}, [visibleColumns]);

	const getCellByIndex = useCallback(
		(rowIndex: number, columnIndex: number): GridCell | null => {
			const row = filteredRows[rowIndex];
			const column = visibleColumns[columnIndex];
			if (!row || !column) return null;
			return { rowId: row.id, columnId: column.id };
		},
		[filteredRows, visibleColumns],
	);

	const getSelectionBounds = useCallback(
		(sel: SelectionRange | null) => {
			if (!sel) return null;
			const anchorRow = rowIndexLookup.get(sel.anchor.rowId);
			const focusRow = rowIndexLookup.get(sel.focus.rowId);
			const anchorCol = columnIndexLookup.get(sel.anchor.columnId);
			const focusCol = columnIndexLookup.get(sel.focus.columnId);
			if (
				anchorRow === undefined ||
				focusRow === undefined ||
				anchorCol === undefined ||
				focusCol === undefined
			) {
				return null;
			}
			return {
				rowStart: Math.min(anchorRow, focusRow),
				rowEnd: Math.max(anchorRow, focusRow),
				colStart: Math.min(anchorCol, focusCol),
				colEnd: Math.max(anchorCol, focusCol),
			};
		},
		[rowIndexLookup, columnIndexLookup],
	);

	useEffect(() => {
		if (
			activeCell ||
			filteredRows.length === 0 ||
			visibleColumns.length === 0
		) {
			return;
		}
		const firstRow = filteredRows[0];
		const firstColumn = visibleColumns[0];
		if (!firstRow || !firstColumn) return;
		const first = { rowId: firstRow.id, columnId: firstColumn.id };
		setActiveCell(first);
		setSelection({ anchor: first, focus: first });
	}, [activeCell, filteredRows, visibleColumns]);

	useEffect(() => {
		if (
			!activeCell ||
			(rowIndexLookup.has(activeCell.rowId) &&
				columnIndexLookup.has(activeCell.columnId))
		) {
			return;
		}
		if (filteredRows.length === 0 || visibleColumns.length === 0) {
			setActiveCell(null);
			setSelection(null);
			return;
		}
		const fallbackRow = filteredRows[0];
		const fallbackColumn = visibleColumns[0];
		if (!fallbackRow || !fallbackColumn) {
			setActiveCell(null);
			setSelection(null);
			return;
		}
		const fallback = { rowId: fallbackRow.id, columnId: fallbackColumn.id };
		setActiveCell(fallback);
		setSelection({ anchor: fallback, focus: fallback });
	}, [
		activeCell,
		rowIndexLookup,
		columnIndexLookup,
		filteredRows,
		visibleColumns,
	]);

	useEffect(() => {
		if (!editingCell) return;
		if (
			!rowIndexLookup.has(editingCell.rowId) ||
			!columnIndexLookup.has(editingCell.columnId)
		) {
			setEditingCell(null);
			return;
		}
		const key = `${editingCell.rowId}|${editingCell.columnId}`;
		const input = document.querySelector(
			`[data-cell-input="${key}"]`,
		) as HTMLInputElement | null;
		if (!input) return;
		const frame = requestAnimationFrame(() => {
			input.focus();
			input.select();
		});
		return () => cancelAnimationFrame(frame);
	}, [editingCell, rowIndexLookup, columnIndexLookup]);

	const selectCell = useCallback(
		(
			cell: GridCell,
			options: { extend?: boolean; anchorOverride?: GridCell } = {},
		) => {
			if (
				!rowIndexLookup.has(cell.rowId) ||
				!columnIndexLookup.has(cell.columnId)
			) {
				return;
			}
			const anchor = options.extend
				? (options.anchorOverride ??
					selectionRef.current?.anchor ??
					activeCellRef.current ??
					cell)
				: cell;
			setEditingCell(null);
			setActiveCell(anchor);
			setSelection({ anchor, focus: cell });
		},
		[rowIndexLookup, columnIndexLookup, setEditingCell],
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
		[rowIndexLookup],
	);

	const applyFillFromPreview = useCallback(
		(preview: FillPreview | null) => {
			if (!preview || preview.rows.length === 0 || !pointerAnchorRef.current) {
				return;
			}
			const anchor = pointerAnchorRef.current;
			const anchorRowIndex = rowIndexLookup.get(anchor.rowId);
			if (anchorRowIndex === undefined) return;
			const anchorRow = filteredRows[anchorRowIndex];
			if (!anchorRow) return;
			const sourceValue =
				anchorRow.cells.find((cell) => cell.columnId === preview.columnId)
					?.value ?? null;
			const historyChanges: CellHistoryChange[] = [];
			const nextHistoryValue = toHistoryValue(sourceValue);

			for (const rowIndex of preview.rows) {
				const targetRow = filteredRows[rowIndex];
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
			filteredRows,
			getCellByIndex,
			handleCellUpdate,
			recordUndoStep,
			rowIndexLookup,
			setActiveCell,
			setSelection,
		],
	);

	const finalizePointer = useCallback(() => {
		if (pointerModeRef.current === "fill") {
			applyFillFromPreview(fillPreview);
		}
		pointerModeRef.current = null;
		pointerAnchorRef.current = null;
		setFillPreview(null);
	}, [applyFillFromPreview, fillPreview]);

	useEffect(() => {
		const handlePointerUp = () => finalizePointer();
		window.addEventListener("pointerup", handlePointerUp);
		return () => window.removeEventListener("pointerup", handlePointerUp);
	}, [finalizePointer]);

	const selectedCellKeys = useMemo(() => {
		const bounds = getSelectionBounds(selection);
		if (!bounds) return new Set<string>();
		const keys = new Set<string>();
		for (
			let rowIndex = bounds.rowStart;
			rowIndex <= bounds.rowEnd;
			rowIndex++
		) {
			const row = filteredRows[rowIndex];
			if (!row) continue;
			for (
				let colIndex = bounds.colStart;
				colIndex <= bounds.colEnd;
				colIndex++
			) {
				const column = visibleColumns[colIndex];
				if (!column) continue;
				keys.add(`${row.id}|${column.id}`);
			}
		}
		return keys;
	}, [selection, getSelectionBounds, filteredRows, visibleColumns]);

	const fillPreviewKeys = useMemo(() => {
		if (!fillPreview) return new Set<string>();
		const keys = new Set<string>();
		for (const rowIndex of fillPreview.rows) {
			const row = filteredRows[rowIndex];
			if (!row) continue;
			keys.add(`${row.id}|${fillPreview.columnId}`);
		}
		return keys;
	}, [fillPreview, filteredRows]);

	const hasRangeSelection =
		Boolean(selection) &&
		(selection?.anchor.rowId !== selection?.focus.rowId ||
			selection?.anchor.columnId !== selection?.focus.columnId);

	const activeCellKey = activeCell
		? `${activeCell.rowId}|${activeCell.columnId}`
		: null;

	const startEditing = useCallback(
		(cell: GridCell | null, initialValue?: string) => {
			if (!cell) return;
			if (
				!rowIndexLookup.has(cell.rowId) ||
				!columnIndexLookup.has(cell.columnId)
			) {
				return;
			}
			initialEditValueRef.current =
				initialValue !== undefined ? initialValue : null;
			setEditingCell(cell);
		},
		[columnIndexLookup, rowIndexLookup],
	);

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
		[selectCell, startEditing],
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
		[updateFillPreview],
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
		[rowIndexLookup, columnIndexLookup],
	);

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
			const row = filteredRows[rowIndex];
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
		filteredRows,
		getCellDisplayValue,
		getSelectionBounds,
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
		filteredRows,
		getCellByIndex,
		handleCellUpdate,
		normalizeValueForColumn,
		recordUndoStep,
		rowIndexLookup,
		visibleColumns,
	]);

	const filteredRowsCount = rowsInfinite.hasNextPage
		? filteredRows.length + 1
		: filteredRows.length;

	const rowVirtualizer = useVirtualizer({
		count: filteredRowsCount,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => 37,
		overscan: 10,
		useAnimationFrameWithResizeObserver: true,
		onChange: (instance) => {
			const vItems = instance.getVirtualItems();
			if (!vItems.length) return;
			const last = vItems[vItems.length - 1];
			if (!last) return;
			const reachedEnd = last.index >= filteredRows.length - 10;
			if (
				reachedEnd &&
				rowsInfinite.hasNextPage &&
				!rowsInfinite.isFetchingNextPage
			) {
				rowsInfinite.fetchNextPage();
			}
			utils.table.getInfiniteRows.setInfiniteData(infiniteQueryInput, (old) => {
				if (!old) return old;
				return { ...old, pages: old.pages.slice(-5) };
			});
		},
	});

	const moveSelection = useCallback(
		(deltaRow: number, deltaCol: number, extend: boolean) => {
			const baseCell = extend
				? (selectionRef.current?.focus ?? activeCellRef.current)
				: activeCellRef.current;
			if (!baseCell) return;
			const currentRowIndex = rowIndexLookup.get(baseCell.rowId);
			const currentColIndex = columnIndexLookup.get(baseCell.columnId);
			if (
				currentRowIndex === undefined ||
				currentColIndex === undefined ||
				filteredRows.length === 0 ||
				visibleColumns.length === 0
			) {
				return;
			}
			const nextRowIndex = clamp(
				currentRowIndex + deltaRow,
				0,
				Math.max(filteredRows.length - 1, 0),
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
			filteredRows.length,
			visibleColumns.length,
			getCellByIndex,
			selectCell,
			rowVirtualizer,
		],
	);

	const moveHorizontallyFromCell = useCallback(
		(cell: GridCell | null, deltaCol: number) => {
			if (!cell) return;
			const rowIndex = rowIndexLookup.get(cell.rowId);
			const colIndex = columnIndexLookup.get(cell.columnId);
			if (
				rowIndex === undefined ||
				colIndex === undefined ||
				visibleColumns.length === 0
			) {
				return;
			}
			const nextColIndex = clamp(
				colIndex + deltaCol,
				0,
				Math.max(visibleColumns.length - 1, 0),
			);
			const nextCell = getCellByIndex(rowIndex, nextColIndex);
			if (!nextCell) return;
			setEditingCell(null);
			setActiveCell(nextCell);
			setSelection({ anchor: nextCell, focus: nextCell });
			rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" });
			scrollParentRef.current?.focus();
		},
		[
			columnIndexLookup,
			getCellByIndex,
			rowIndexLookup,
			rowVirtualizer,
			setActiveCell,
			setEditingCell,
			setSelection,
			visibleColumns.length,
			scrollParentRef,
		],
	);

	const handleNavigateFromCell = useCallback(
		(cell: GridCell, direction: "forward" | "backward") => {
			moveHorizontallyFromCell(cell, direction === "forward" ? 1 : -1);
		},
		[moveHorizontallyFromCell],
	);

	useEffect(() => {
		handleNavigateFromCellRef.current = handleNavigateFromCell;
	}, [handleNavigateFromCell]);

	const undoLastStep = useCallback(() => {
		const step = popStep();
		if (!step) return;
		for (const change of [...step].reverse()) {
			handleCellUpdate(
				change.rowId,
				change.columnId,
				change.previousValue ?? "",
			);
		}
	}, [handleCellUpdate, popStep]);

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
				undoLastStep();
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
			moveSelection,
			moveHorizontallyFromCell,
			osName,
			pasteClipboardData,
			startEditing,
			undoLastStep,
			isPrintableKey,
		],
	);

	const {
		matches,
		matchKeys,
		activeMatchIndex,
		activeMatch,
		gotoNextMatch,
		gotoPrevMatch,
	} = useTableSearchNavigation({
		rows: filteredRows,
		columns: orderedColumns,
		searchValue,
	});

	// Keyboard shortcut: Ctrl/Cmd+F opens the table search
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const useMeta = osName === "macOS" || osName === "iOS";
			const mod = useMeta ? e.metaKey : e.ctrlKey;
			const key = e.key.toLowerCase();
			if (mod && key === "f") {
				e.preventDefault();
				setSearchOpen(true);
				setTimeout(() => {
					const input = document.getElementById(
						"table-search",
					) as HTMLInputElement | null;
					input?.focus();
					input?.select();
				}, 0);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [osName]);

	const handleAddRow = () => {
		const cells = columns.map((col) => ({ columnId: col.id, value: "" }));
		addRowMutation.mutate({ tableId, cells });
	};

	const handleDeleteRows = async (clickedRowId: string) => {
		const ids =
			selectedRowIds.size > 0 ? Array.from(selectedRowIds) : [clickedRowId];
		await Promise.all(
			ids.map((id) => deleteRowMutation.mutateAsync({ rowId: id })),
		);
		setSelectedRowIds(new Set());
		utils.table.getTableColumnType.invalidate({ id: tableId });
		utils.table.getInfiniteRows.invalidate(infiniteQueryInput);
	};

	if (
		tableColumnLoading ||
		rowsInfinite.isLoading ||
		viewsLoading ||
		!activeView
	) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-gray-500">Loading view…</div>
			</div>
		);
	}

	if (!tableColumn) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-gray-500">Table not found.</div>
			</div>
		);
	}

	return (
		<div className="flex h-full">
			<div className="min-w-0 flex-1">
				<ViewsHeader
					viewName={activeView?.name ?? "View"}
					onRenameView={(name) => {
						if (!activeView) return;
						handleRenameView(activeView.id, name);
					}}
					onDuplicateView={() => {
						if (!activeView) return;
						handleDuplicateView(activeView.id);
					}}
					onDeleteView={() => {
						if (!activeView) return;
						handleDeleteView(activeView.id);
					}}
					canDeleteView={canDeleteView}
					onToggleSidebar={() => setViewSidebarOpen((v) => !v)}
					searchOpen={searchOpen}
					setSearchOpen={setSearchOpen}
					table={table}
					matchesCount={matches.length}
					activeMatchIndex={activeMatchIndex}
					gotoPrevMatch={gotoPrevMatch}
					gotoNextMatch={gotoNextMatch}
					columns={orderedColumns}
					filters={filters}
					sorts={sorts}
					autoSort={autoSort}
					hiddenColumnIds={hiddenColumnIds}
					onUpdateView={handleUpdateView}
				/>

				<div className="flex">
					{/* Left views sidebar inside table area */}
					{viewSidebarOpen && (
						<ViewsSidebar
							views={views}
							activeViewId={activeView?.id ?? null}
							onSelectView={handleSelectView}
							onCreateView={handleCreateView}
							onRenameView={handleRenameView}
							onDuplicateView={handleDuplicateView}
							onDeleteView={handleDeleteView}
							onReorderView={handleReorderView}
							canDeleteView={canDeleteView}
						/>
					)}

					<div className="flex h-[88vh] w-full flex-col justify-between">
						<div
							className="relative flex min-h-0 overflow-x-auto overflow-y-auto border-gray-200 outline-none"
							ref={scrollParentRef}
							onKeyDown={handleGridKeyDown}
							onMouseDown={() => scrollParentRef.current?.focus()}
						>
							<table
								className="border-separate border-spacing-0 border bg-white"
								key={`table-${columns.length}-${columns.map((c) => c.id).join("-")}`}
							>
								<colgroup>
									{table.getVisibleLeafColumns?.().map((col) => (
										<col
											key={col.id}
											className={cn("w-[150px]", col.columnDef.meta?.className)}
										/>
									))}
								</colgroup>
								<thead className="border-gray-300 border-b bg-white">
									{table.getHeaderGroups().map((headerGroup) => (
										<tr key={headerGroup.id}>
											{headerGroup.headers.map((header) => (
												<th
													key={header.id}
													className={cn(
														"sticky top-0 z-40 border-gray-200 border-r border-b bg-white p-2 text-left text-gray-700 text-sm",
														header.column.columnDef.meta?.className,
													)}
												>
													<div
														className={cn(
															"flex items-center gap-2",
															header.column.id === "row-number" && "inline",
														)}
													>
														{header.isPlaceholder
															? null
															: flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}

														{header.column.id !== "row-number" && (
															<ColumnHeaderMenu
																columnId={header.column.id}
																onRename={(id) => {
																	const current =
																		header.column.columnDef.header;
																	const name = prompt(
																		"Rename column",
																		String(
																			current instanceof Function
																				? id
																				: current,
																		) || id,
																	);
																	if (name?.trim()) {
																		renameColumnMutation.mutate({
																			colId: id,
																			name: name.trim(),
																		});
																	}
																}}
																onDuplicate={(id) =>
																	duplicateColumnMutation.mutate({ colId: id })
																}
																onDelete={(id) =>
																	deleteColumnMutation.mutate({ colId: id })
																}
																disabledRename={renameColumnMutation.isPending}
																disabledDuplicate={
																	duplicateColumnMutation.isPending
																}
															/>
														)}
													</div>
												</th>
											))}
										</tr>
									))}
								</thead>
								<tbody>
									{(() => {
										const virtualItems = rowVirtualizer.getVirtualItems();
										const paddingTop = virtualItems.length
											? virtualItems[0]!.start
											: 0;
										const paddingBottom = virtualItems.length
											? rowVirtualizer.getTotalSize() -
												virtualItems[virtualItems.length - 1]!.end
											: 0;
										const visibleColCount =
											(table.getVisibleLeafColumns() as any)?.length ?? 0;
										return (
											<>
												{paddingTop > 0 && (
													<tr>
														<td
															colSpan={visibleColCount}
															style={{ height: paddingTop }}
															className="border-0 p-0"
														/>
													</tr>
												)}
												{virtualItems.map((vItem) => {
													const isLoader =
														vItem.index >= table.getRowModel().rows.length;
													const row = table.getRowModel().rows[vItem.index];

													return (
														<ContextMenu key={vItem.key}>
															<ContextMenuTrigger asChild>
																<tr
																	data-index={vItem.index}
																	className="cursor-default"
																	style={{ height: `${vItem.size}px` }}
																>
																	{isLoader ? (
																		// Loader row spans all columns
																		<td
																			colSpan={visibleColCount}
																			className="h-8 text-center text-gray-500 text-sm"
																			// biome-ignore lint/a11y/noNoninteractiveTabindex: <explanation>
																			tabIndex={0}
																		>
																			{rowsInfinite.isFetchingNextPage
																				? "Loading…"
																				: "Load more…"}
																		</td>
																	) : (
																		row?.getVisibleCells().map((cell) => {
																			const key = `${row?.original.id}|${cell.column.id}`;
																			const isMatch =
																				Boolean(searchValue) &&
																				matchKeys.has(key);
																			const isActiveSearchCell =
																				Boolean(activeMatch) &&
																				activeMatch?.rowId ===
																					row?.original.id &&
																				activeMatch?.columnId ===
																					cell.column.id;
																			const rowId = row?.original.id;
																			const isSelectableCell =
																				Boolean(rowId) &&
																				columnIndexLookup.has(cell.column.id);
																			const isGridActive =
																				isSelectableCell &&
																				activeCellKey === key;
																			const isSelected =
																				isSelectableCell &&
																				selectedCellKeys.has(key);
																			const isFillHighlighted =
																				isSelectableCell &&
																				fillPreviewKeys.has(key);
																			const backgroundClass = isFillHighlighted
																				? "bg-blue-100"
																				: hasRangeSelection && isSelected
																					? "bg-blue-50"
																					: isActiveSearchCell
																						? "bg-yellow-200"
																						: isMatch
																							? "bg-yellow-100"
																							: "";
																			return (
																				<td
																					key={cell.id}
																					className={cn(
																						"relative h-8 w-[150px] overflow-visible whitespace-nowrap border-gray-200 border-r border-b px-2 text-gray-900 text-sm",
																						cell.column.columnDef.meta
																							?.className,
																						backgroundClass,
																					)}
																					data-cell={key}
																					onPointerDown={(event) => {
																						if (!rowId) return;
																						handleCellPointerDown(
																							event,
																							{
																								rowId,
																								columnId: cell.column.id,
																							},
																							isSelectableCell,
																						);
																					}}
																					onPointerEnter={() => {
																						if (!rowId) return;
																						handleCellPointerEnter(
																							{
																								rowId,
																								columnId: cell.column.id,
																							},
																							isSelectableCell,
																						);
																					}}
																					onDoubleClick={(event) => {
																						if (!rowId || !isSelectableCell)
																							return;
																						event.stopPropagation();
																						startEditing({
																							rowId,
																							columnId: cell.column.id,
																						});
																					}}
																				>
																					{isGridActive && (
																						<>
																							<div className="-inset-0.5 pointer-events-none absolute border-2 border-blue-500" />
																							<span
																								data-fill-handle
																								className="absolute right-0 bottom-0 z-30 size-2 translate-x-1/2 translate-y-1/2 cursor-crosshair border border-blue-600 bg-white shadow-sm"
																								onPointerDown={(event) => {
																									if (!rowId) return;
																									handleFillPointerDown(event, {
																										rowId,
																										columnId: cell.column.id,
																									});
																								}}
																							/>
																						</>
																					)}
																					<div className="truncate">
																						{flexRender(
																							cell.column.columnDef.cell,
																							cell.getContext(),
																						)}
																					</div>
																				</td>
																			);
																		})
																	)}
																</tr>
															</ContextMenuTrigger>

															{!isLoader && row && (
																<ContextMenuContent className="w-48">
																	<ContextMenuItem
																		onClick={() =>
																			handleDeleteRows(row?.original.id)
																		}
																		className="text-red-600 focus:bg-red-50 focus:text-red-600"
																	>
																		Delete row
																	</ContextMenuItem>
																</ContextMenuContent>
															)}
														</ContextMenu>
													);
												})}
												{paddingBottom > 0 && (
													<tr>
														<td
															colSpan={visibleColCount}
															style={{ height: paddingBottom }}
															className="border-0 p-0"
														/>
													</tr>
												)}
											</>
										);
									})()}
								</tbody>
								{/* Add Row button row */}
								<tfoot>
									<tr className="border-gray-200 border-r bg-white">
										{visibleColumns.map((col, index) => (
											<td
												key={col.id}
												className={cn("border-gray-200 text-gray-900 text-sm")}
											>
												{index === 0 ? (
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<button
																	type="button"
																	onClick={handleAddRow}
																	className="flex size-8 w-full cursor-pointer items-center justify-center text-gray-600 text-xl hover:bg-gray-50 hover:text-gray-800"
																>
																	+
																</button>
															</TooltipTrigger>
															<TooltipContent>
																<p>
																	You can also insert a new record anywhere by
																	pressing Shift-Enter
																</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												) : null}
											</td>
										))}
										{/* trailing add-column cell */}
										<td className="w-[100px] border-gray-200" />
									</tr>
								</tfoot>
							</table>
							<AddColumnDropdown
								onCreate={handleAddColumn}
								isLoading={addColumnMutation.isPending}
								trigger={
									<button
										type="button"
										className="sticky top-0 h-[41.5px] w-[200px] border-separate border-spacing-0 cursor-pointer border-t border-r border-b border-l-0 bg-white text-gray-900 text-lg hover:bg-gray-100"
										aria-label="Add column"
									>
										+
									</button>
								}
							/>
						</div>
						{/* Footer with record count */}
						<div className="w-full border-t bg-white p-4 text-xs">
							<span> {filteredRowsCount} records</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
