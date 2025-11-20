"use client";

import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	Copy,
	GripVertical,
	Plus,
	Trash2,
	WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { type CellHistoryChange, useSteps } from "~/hooks/useSteps";
import { useTableMutations } from "~/hooks/useTableMutations";
import { useTableSearchNavigation } from "~/hooks/useTableSearchNavigation";
import { detectOS } from "~/lib/detectOS";
import { filterRowsByQuery, rowMatchesQuery } from "~/lib/tableFilter";
import { cn } from "~/lib/utils";
import type { ColumnType } from "~/types/column";

import { createColumnDefs } from "./ColumnDefinitions";
// Import our extracted components and hooks
import { DataTableStatusBar } from "./components/DataTableStatusBar";
import { DataTableToolbar } from "./components/DataTableToolbar";
import { TableDataCell } from "./components/cells/TableDataCell";
import { TableHeaderCell } from "./components/cells/TableHeaderCell";
import { applyFilters } from "./components/filters/Filters";
import { applySorts } from "./components/filters/Sorts";
import { AddColumnDropdown } from "./components/toolbar/AddColumnDropdown";
import { ViewsSidebar } from "./components/views/ViewsSidebar";
import { useCellInteractions } from "./hooks/useCellInteractions";
import { toHistoryValue, useCellOperations } from "./hooks/useCellOperations";
import { useClipboardOperations } from "./hooks/useClipboardOperations";
import { useDataTableCrud } from "./hooks/useDataTableCrud";
import { useDataTableData } from "./hooks/useDataTableData";
import { useDataTableKeyboard } from "./hooks/useDataTableKeyboard";
import { type GridCell, useDataTableState } from "./hooks/useDataTableState";
import { useDataTableVirtualization } from "./hooks/useDataTableVirtualization";
import { useViewFilter } from "./hooks/useViewFilter";
import { MAX_PAGE_SIZE, ROW_HEIGHT } from "./utils/constants";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";

// Types
type Cell = {
	id: string;
	columnId: string;
	value: string | null;
	rowId: string;
	column?: {
		id: string;
		name: string;
		type: ColumnType;
		required: boolean;
		position: number;
		tableId: string;
	};
};

interface DataTableProps {
	tableId: string;
}

export function DataTable({ tableId }: DataTableProps) {
	// Basic state
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [viewSidebarOpen, setViewSidebarOpen] = useState(true);
	const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
	const [showCheckboxes, setShowCheckboxes] = useState(false);
	const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
	const [pageSize, setPageSize] = useState(MAX_PAGE_SIZE);

	// Refs
	const scrollParentRef = useRef<HTMLDivElement | null>(null);
	const activeCellRef = useRef<any>(null);
	const selectionRef = useRef<any>(null);
	const initialEditValueRef = useRef<string | null>(null);

	// Core hooks
	const osName = useMemo(() => detectOS(), []);
	const {
		state: interactionState,
		setActiveCell,
		setSelection,
		setEditingCell,
		setFillPreview,
	} = useDataTableState();
	const { activeCell, selection, editingCell } = interactionState;
	const { pushStep, popUndoStep, popRedoStep } = useSteps();

	// Data management
	const {
		data,
		columns,
		orderedColumns,
		optimisticRows,
		tableColumn,
		tableColumnLoading,
		rowCountData,
		infiniteQueryInput,
		rowsInfinite,
		utils,
		handleOptimisticUpdate,
		viewportFetching,
		isViewportLoading,
		clearViewportCache,
		totalLoadedRowCount,
	} = useDataTableData({ tableId, pageSize });

	// Table mutations
	const {
		queueCellUpdate,
		flushPendingUpdates,
		cancelCellUpdate,
		addRowMutation,
		addColumnMutation,
		deleteRowMutation,
		deleteColumnMutation,
		renameColumnMutation,
		duplicateColumnMutation,
		addRowAtPositionMutation,
		duplicateRowAtPositionMutation,
	} = useTableMutations({
		tableId,
		infiniteInput: infiniteQueryInput,
		onOptimisticUpdate: handleOptimisticUpdate,
	});

	// Views
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

	// Process data
	const hiddenColumnSet = useMemo(
		() => new Set(hiddenColumnIds),
		[hiddenColumnIds],
	);
	const visibleColumns = useMemo(
		() => orderedColumns.filter((col) => !hiddenColumnSet.has(col.id)),
		[orderedColumns, hiddenColumnSet],
	);

	const viewRows = useMemo(() => {
		const filtered = applyFilters(data, orderedColumns, data, filters);
		return applySorts(filtered, orderedColumns, sorts, autoSort);
	}, [data, orderedColumns, filters, sorts, autoSort]);

	const displayData = useMemo(() => {
		return filterRowsByQuery(viewRows, orderedColumns, searchValue);
	}, [viewRows, orderedColumns, searchValue]);

	const optimisticRowLimit = 200;

	// Combine display data with optimistic rows
	const rowsWithOptimistic = useMemo(
		() => [...displayData, ...optimisticRows.slice(0, optimisticRowLimit)],
		[displayData, optimisticRows],
	);

	// Virtualization
	const { rowVirtualizer, filteredRowsCount, loadedRowsCount } =
		useDataTableVirtualization({
			rowsWithOptimistic,
			showCheckboxes,
			scrollParentRef,
			rowsInfinite,
			setPageSize,
			totalRowCount: rowCountData?.count,
			totalLoadedRowCount,
			viewportFetching,
		});

	// Lookups - Enhanced to include viewport data for full navigation support
	const rowIndexLookup = useMemo(() => {
		const map = new Map<string, number>();
		
		// Add all regular data rows
		rowsWithOptimistic.forEach((row, index) => map.set(row.id, index));
		
		// Add viewport data rows for navigation support
		if (viewportFetching && rowCountData?.count) {
			// For viewport rows, we need to include them in the lookup
			// This allows navigation to work across the entire virtual range
			for (let i = 0; i < rowCountData.count; i++) {
				if (!map.has(`row-${i}`)) { // Don't override existing rows
					const viewportRow = viewportFetching.getRowAtIndex(i);
					if (viewportRow) {
						map.set(viewportRow.id, i);
					}
				}
			}
		}
		
		return map;
	}, [rowsWithOptimistic, viewportFetching, rowCountData?.count]);

	const columnIndexLookup = useMemo(() => {
		const map = new Map<string, number>();
		visibleColumns.forEach((col, index) => map.set(col.id, index));
		return map;
	}, [visibleColumns]);

	// Clean up selected rows that are no longer in the visible dataset
	useEffect(() => {
		if (selectedRowIds.size === 0) return;

		const currentRowIds = new Set(rowsWithOptimistic.map((row) => row.id));
		const selectedRowsToKeep = new Set<string>();

		// Only keep selections for rows that are still in the current visible data
		for (const rowId of selectedRowIds) {
			if (currentRowIds.has(rowId)) {
				selectedRowsToKeep.add(rowId);
			}
		}

		// Update selected rows if any were removed
		if (selectedRowsToKeep.size !== selectedRowIds.size) {
			setSelectedRowIds(selectedRowsToKeep);

			// If no rows left selected, exit checkbox mode
			if (selectedRowsToKeep.size === 0) {
				setShowCheckboxes(false);
			}
		}
	}, [
		rowsWithOptimistic,
		selectedRowIds,
		setSelectedRowIds,
		setShowCheckboxes,
	]);

	const getCellByIndex = useCallback(
		(rowIndex: number, columnIndex: number) => {
			const column = visibleColumns[columnIndex];
			if (!column) return null;
			
			// First try regular data
			const row = rowsWithOptimistic[rowIndex];
			if (row) {
				return { rowId: row.id, columnId: column.id };
			}
			
			// Then try viewport data
			if (viewportFetching) {
				const viewportRow = viewportFetching.getRowAtIndex(rowIndex);
				if (viewportRow) {
					return { rowId: viewportRow.id, columnId: column.id };
				}
			}
			
			return null;
		},
		[rowsWithOptimistic, visibleColumns, viewportFetching],
	);

	const getRowByIndex = useCallback(
		(rowIndex: number) => {
			// First try regular data
			const row = rowsWithOptimistic[rowIndex];
			if (row) return row;
			
			// Then try viewport data
			if (viewportFetching) {
				return viewportFetching.getRowAtIndex(rowIndex);
			}
			
			return null;
		},
		[rowsWithOptimistic, viewportFetching],
	);

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

	// handleCellUpdate for general use - defined early to avoid circular dependency
	const handleCellUpdate = useCallback(
		(rowId: string, columnId: string, value: string | number | null) => {
			// Get the column for normalization
			const column = columns.find((col) => col.id === columnId);
			let nextValue: string | null = null;

			if (value === null || value === undefined) {
				nextValue = null;
			} else if (column?.type === "NUMBER") {
				const raw =
					typeof value === "number" ? String(value) : String(value).trim();
				if (raw === "") {
					nextValue = null;
				} else {
					const parsed = Number(raw);
					if (!Number.isFinite(parsed)) {
						nextValue = null;
					} else {
						nextValue = String(parsed);
					}
				}
			} else {
				nextValue = typeof value === "number" ? String(value) : String(value);
			}

			const payload = nextValue ?? "";
			queueCellUpdate(rowId, columnId, payload);
			flushPendingUpdates();
		},
		[queueCellUpdate, flushPendingUpdates, columns],
	);

	// Undo/Redo functions
	const undoLastStep = useCallback(() => {
		const step = popUndoStep();
		if (!step) return;
		for (const change of [...step].reverse()) {
			handleCellUpdate(
				change.rowId,
				change.columnId,
				change.previousValue ?? "",
			);
		}
	}, [handleCellUpdate, popUndoStep]);

	const redoLastStep = useCallback(() => {
		const step = popRedoStep();
		if (!step) return;
		for (const change of step) {
			handleCellUpdate(change.rowId, change.columnId, change.nextValue ?? "");
		}
	}, [handleCellUpdate, popRedoStep]);

	// Cell operations
	const { normalizeValueForColumn, updateFillPreview, moveSelection } =
		useCellOperations({
			columns,
			rowsWithOptimistic,
			visibleColumns,
			rowIndexLookup,
			columnIndexLookup,
			totalRowCount: rowCountData?.count,
			handleCellUpdate,
			recordUndoStep,
			getCellByIndex,
			setActiveCell,
			setSelection,
			setFillPreview,
		});

	// Update refs when state changes
	useEffect(() => {
		activeCellRef.current = activeCell;
		selectionRef.current = selection;
	}, [activeCell, selection]);

	const onCommitEdit = useCallback(
		(
			rowId: string,
			columnId: string,
			nextValue: string,
			previousValue: string | number | null,
		) => {
			// Normalize next value
			const normalizedNext = normalizeValueForColumn(columnId, nextValue);

			// Convert to unified string form for undo
			const previousHistoryValue = toHistoryValue(previousValue);
			const nextHistoryValue = normalizedNext;

			// Record undo step (only when value actually changed)
			if (previousHistoryValue !== nextHistoryValue) {
				recordUndoStep({
					rowId,
					columnId,
					previousValue: previousHistoryValue,
					nextValue: nextHistoryValue,
				});
			}

			// Apply update optimistically + queue mutation
			flushSync(() => {
				const payload = normalizedNext ?? "";
				queueCellUpdate(rowId, columnId, payload);
				flushPendingUpdates();
			});

			// Exit editing mode
			setEditingCell(null);

			// Focus back to grid wrapper
			scrollParentRef.current?.focus();
		},
		[
			normalizeValueForColumn,
			recordUndoStep,
			queueCellUpdate,
			flushPendingUpdates,
			setEditingCell,
		],
	);

	const onCancelEdit = useCallback(() => {
		// Simply exit edit mode
		setEditingCell(null);

		// Refocus the virtualized grid
		scrollParentRef.current?.focus();
	}, [setEditingCell]);

	const onNavigate = useCallback(
		(
			cell: { rowId: string; columnId: string },
			direction: "forward" | "backward",
		) => {
			const rowIndex = rowIndexLookup.get(cell.rowId);
			const colIndex = columnIndexLookup.get(cell.columnId);
			if (rowIndex === undefined || colIndex === undefined) return;

			const nextColIndex =
				direction === "forward" ? colIndex + 1 : colIndex - 1;

			if (nextColIndex < 0 || nextColIndex >= visibleColumns.length) return;

			const nextCell = getCellByIndex(rowIndex, nextColIndex);
			if (!nextCell) return;

			// End editing, jump selection
			setEditingCell(null);
			setActiveCell(nextCell);
			setSelection({ anchor: nextCell, focus: nextCell });

			// Make sure that column is scrolled into view
			rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" });
			scrollParentRef.current?.focus();
		},
		[
			rowIndexLookup,
			columnIndexLookup,
			visibleColumns.length,
			getCellByIndex,
			setEditingCell,
			setActiveCell,
			setSelection,
			rowVirtualizer,
		],
	);

	// CRUD operations
	const crudOperations = useDataTableCrud({
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
	});

	// Cell interactions
	const selectCell = useCallback(
		(cell: any, options: any = {}) => {
			if (
				!rowIndexLookup.has(cell.rowId) ||
				!columnIndexLookup.has(cell.columnId)
			)
				return;
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
		[
			rowIndexLookup,
			columnIndexLookup,
			setEditingCell,
			setActiveCell,
			setSelection,
		],
	);

	// Position-aware context menu handlers
	const handleInsertRecordAbove = useCallback(
		(rowId: string) => {
			crudOperations.handleInsertRecordAbove(rowId, rowsWithOptimistic);
		},
		[crudOperations, rowsWithOptimistic],
	);

	const handleInsertRecordBelow = useCallback(
		(rowId: string) => {
			crudOperations.handleInsertRecordBelow(rowId, rowsWithOptimistic);
		},
		[crudOperations, rowsWithOptimistic],
	);

	const handleDuplicateRecord = useCallback(
		(rowId: string) => {
			crudOperations.handleDuplicateRecord(rowId, rowsWithOptimistic);
		},
		[crudOperations, rowsWithOptimistic],
	);
	const startEditing = useCallback(
		(cell: any, initialValue?: string) => {
			if (
				!cell ||
				!rowIndexLookup.has(cell.rowId) ||
				!columnIndexLookup.has(cell.columnId)
			)
				return;
			cancelCellUpdate(cell.rowId, cell.columnId);
			initialEditValueRef.current =
				initialValue !== undefined ? initialValue : null;
			setEditingCell(cell);
		},
		[rowIndexLookup, columnIndexLookup, setEditingCell, cancelCellUpdate],
	);

	const {
		finalizePointer,
		handleCellPointerDown,
		handleCellPointerEnter,
		handleFillPointerDown,
	} = useCellInteractions({
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
	});

	// Clipboard operations
	const getSelectionBounds = useCallback(
		(sel: any) => {
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
			)
				return null;
			return {
				rowStart: Math.min(anchorRow, focusRow),
				rowEnd: Math.max(anchorRow, focusRow),
				colStart: Math.min(anchorCol, focusCol),
				colEnd: Math.max(anchorCol, focusCol),
			};
		},
		[rowIndexLookup, columnIndexLookup],
	);

	const { copySelectionToClipboard, pasteClipboardData } =
		useClipboardOperations({
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
		});

	// moveSelection wrapper for keyboard
	const moveSelectionKeyboard = useCallback(
		(deltaRow: number, deltaCol: number, extend: boolean) => {
			moveSelection(
				deltaRow,
				deltaCol,
				extend,
				activeCell,
				selectionRef,
				activeCellRef,
				selectCell,
				rowVirtualizer,
			);
		},
		[moveSelection, activeCell, selectCell, rowVirtualizer],
	);

	// moveHorizontallyFromCell for keyboard
	const moveHorizontallyFromCell = useCallback(
		(cell: GridCell | null, deltaCol: number) => {
			if (!cell) return;
			moveSelection(
				0,
				deltaCol,
				false,
				cell,
				selectionRef,
				activeCellRef,
				selectCell,
				rowVirtualizer,
			);
		},
		[moveSelection, selectCell, rowVirtualizer],
	);

	// Keyboard handling
	const { handleGridKeyDown } = useDataTableKeyboard({
		activeCell,
		editingCell,
		osName,
		moveSelection: moveSelectionKeyboard,
		moveHorizontallyFromCell,
		handleCellUpdate,
		copySelectionToClipboard,
		pasteClipboardData,
		undoLastStep,
		redoLastStep,
		startEditing,
		scrollParentRef,
		setSearchOpen,
	});

	// Event handlers

	useEffect(() => {
		const handlePointerUp = () => finalizePointer();
		window.addEventListener("pointerup", handlePointerUp);
		return () => window.removeEventListener("pointerup", handlePointerUp);
	}, [finalizePointer]);

	// Table setup
	const getInitialEditValue = useCallback(
		(cell: any) => {
			if (
				!editingCell ||
				editingCell.rowId !== cell.rowId ||
				editingCell.columnId !== cell.columnId
			)
				return null;
			return initialEditValueRef.current;
		},
		[editingCell],
	);

	const consumeInitialEditValue = useCallback(() => {
		initialEditValueRef.current = null;
	}, []);

	const columnDefs = useMemo(() => {
		return createColumnDefs({
			columns: visibleColumns,
			displayData: rowsWithOptimistic,
			rowNumberMap: new Map(
				rowsWithOptimistic.map((row, idx) => [row.id, idx + 1]),
			),
			selectedRowIds,
			setSelectedRowIds,
			showCheckboxes,
			setShowCheckboxes,
			hoveredRowId,
			editingCell,
			onCommitEdit,
			onCancelEdit,
			onNavigate,
			getInitialEditValue,
			onInitialValueConsumed: consumeInitialEditValue,
		});
	}, [
		visibleColumns,
		rowsWithOptimistic,
		selectedRowIds,
		showCheckboxes,
		hoveredRowId,
		editingCell,
		getInitialEditValue,
		consumeInitialEditValue,
		onCommitEdit,
		onCancelEdit,
		onNavigate,
		setSelectedRowIds,
		setShowCheckboxes,
	]);

	const table = useReactTable({
		data: rowsWithOptimistic,
		columns: columnDefs,
		getCoreRowModel: getCoreRowModel(),
		state: { globalFilter: searchValue },
		onGlobalFilterChange: setSearchValue,
		globalFilterFn: (row, _columnId, filterValue) =>
			rowMatchesQuery(row.original, orderedColumns, String(filterValue ?? "")),
		enableColumnPinning: true,
		initialState: { columnPinning: { left: ["row-number"] } },
	});

	// Search navigation
	const { matches, activeMatchIndex, gotoNextMatch, gotoPrevMatch } =
		useTableSearchNavigation({
			rows: rowsWithOptimistic,
			columns: orderedColumns,
			searchValue,
		});

	// Loading states
	if (
		tableColumnLoading ||
		rowsInfinite.isLoading ||
		viewsLoading ||
		!activeView
	) {
		return (
			<div className="flex h-full w-full items-center justify-center text-gray-500">
				<p>Loading view…</p>
			</div>
		);
	}

	if (!tableColumn) {
		return (
			<div className="flex h-full w-full items-center justify-center text-gray-500">
				<p>Table not found.</p>
			</div>
		);
	}

	// Main render
	return (
		<div className="relative flex h-full w-full flex-col overflow-hidden">
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				<div className="shrink-0 border-b bg-white">
					<DataTableToolbar
						viewName={activeView?.name ?? "View"}
						onRenameView={(name) =>
							activeView && handleRenameView(activeView.id, name)
						}
						onDuplicateView={() =>
							activeView && handleDuplicateView(activeView.id)
						}
						onDeleteView={() => activeView && handleDeleteView(activeView.id)}
						canDeleteView={canDeleteView}
						onToggleSidebar={() => setViewSidebarOpen((v) => !v)}
						searchOpen={searchOpen}
						setSearchOpen={setSearchOpen}
						searchValue={searchValue}
						onSearchValueChange={setSearchValue}
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
				</div>

				<div className="flex flex-1 overflow-hidden">
					{viewSidebarOpen && (
						<div className="flex h-full w-[263px] flex-col border-r bg-white">
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
						</div>
					)}

					<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
						<div
							className="relative flex min-h-0 flex-1 overflow-x-auto overflow-y-auto border-gray-200 bg-white outline-none"
							ref={scrollParentRef}
							onKeyDown={handleGridKeyDown}
							onMouseDown={() => scrollParentRef.current?.focus()}
							tabIndex={0}
						>
							<table
								className="table-fixed border-separate border-spacing-0 self-start"
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
								<thead className="sticky top-0 z-30 border-gray-300 border-b bg-white">
									{table.getHeaderGroups().map((headerGroup) => (
										<tr key={headerGroup.id}>
											{/* Custom row number header with checkbox toggle */}
											<th className="w-12 border-gray-200 border-b bg-white px-2 pt-2 text-center">
												<input
													type="checkbox"
													className="size-4"
													checked={
														selectedRowIds.size === rowsWithOptimistic.length &&
														rowsWithOptimistic.length > 0
													}
													onChange={(e) => {
														if (e.target.checked) {
															// Select all visible rows
															setSelectedRowIds(
																new Set(
																	rowsWithOptimistic.map((row) => row.id),
																),
															);
															setShowCheckboxes(true);
														} else {
															// Deselect all
															setSelectedRowIds(new Set());
															setShowCheckboxes(false);
														}
													}}
													aria-label="Toggle all row selection"
												/>
											</th>
											{headerGroup.headers
												.filter((header) => header.id !== "row-number")
												.map((header) => (
													<TableHeaderCell
														key={header.id}
														header={header}
														onRename={crudOperations.handleRenameColumn}
														onDuplicate={crudOperations.handleDuplicateColumn}
														onDelete={crudOperations.handleDeleteColumn}
														disabledRename={renameColumnMutation.isPending}
														disabledDuplicate={
															duplicateColumnMutation.isPending
														}
													/>
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
												{virtualItems.map((virtualRow) => {
													let row = table.getRowModel().rows[virtualRow.index];

													// Try viewport fetching if regular row data is not available
													if (!row && viewportFetching) {
														const viewportRow = viewportFetching.getRowAtIndex(
															virtualRow.index,
														);
														if (viewportRow) {
															// Create a fake table row structure for viewport-fetched data
															row = {
																original: viewportRow,
																getVisibleCells: () => {
																	return visibleColumns.map((col) => {
																		const cell = viewportRow.cells.find(
																			(c) => c.columnId === col.id,
																		);
																		const cellValue = cell?.value ?? null;

																		// Find the actual column definition to get proper rendering
																		const columnDef = columns.find((c) => c.id === col.id);
																		const actualColumnDef = table.getColumn(col.id)?.columnDef;

																		return {
																			id: `${viewportRow.id}-${col.id}`,
																			column: {
																				id: col.id,
																				columnDef: {
																					id: col.id,
																					meta: actualColumnDef?.meta || { className: "w-[150px]" },
																					// Use the actual cell renderer for proper editing/display
																					cell: actualColumnDef?.cell || (({ getValue }) => getValue()),
																					header: actualColumnDef?.header || (() => col.name),
																				},
																			},
																			getValue: () => cell || null, // Return the full cell object
																			getContext: () => ({
																				getValue: () => cell || null,
																				row: { original: viewportRow },
																				column: { 
																					id: col.id, 
																					columnDef: actualColumnDef || {}
																				},
																				cell: {
																					getValue: () => cell || null,
																					id: `${viewportRow.id}-${col.id}`,
																				},
																				table: {},
																				renderValue: () => cellValue,
																			}),
																		};
																	});
																},
															} as any;
														}
													}

													// Handle placeholder rows for unloaded data
													if (!row) {
														const placeholderRowId = `placeholder-${virtualRow.index}`;
														const isHovered = hoveredRowId === placeholderRowId;

														return (
															<tr
																key={virtualRow.key}
																data-index={virtualRow.index}
																className={cn(
																	"cursor-default transition-colors",
																	isHovered && "bg-gray-50",
																)}
																style={{ height: ROW_HEIGHT }}
																onMouseEnter={() =>
																	setHoveredRowId(placeholderRowId)
																}
																onMouseLeave={() => setHoveredRowId(null)}
															>
																{/* Row number column - shows checkbox when in selection mode */}
																<td className="w-12 border-gray-200 border-b px-2 py-2 text-center text-gray-500 text-xs">
																	{showCheckboxes ? (
																		<input
																			type="checkbox"
																			className="size-4"
																			disabled
																			aria-label={`Row ${virtualRow.index + 1} (loading)`}
																		/>
																	) : (
																		virtualRow.index + 1
																	)}
																</td>
																{visibleColumns.map((column) => (
																	<td
																		key={`${placeholderRowId}-${column.id}`}
																		className="border-gray-200 border-r border-b px-3 py-2"
																	>
																		<div className="h-4 animate-pulse rounded bg-gray-200" />
																	</td>
																))}
															</tr>
														);
													}

													const rowId = row.original.id;
													const isHovered = hoveredRowId === rowId;

													return (
														<ContextMenu key={virtualRow.key}>
															<ContextMenuTrigger asChild>
																<tr
																	data-index={virtualRow.index}
																	className={cn(
																		"cursor-default transition-colors",
																		isHovered && "bg-gray-50",
																	)}
																	style={{ height: ROW_HEIGHT }}
																	onMouseEnter={() => setHoveredRowId(rowId)}
																	onMouseLeave={() => setHoveredRowId(null)}
																>
																	{/* Row number column - shows checkbox when hovered or in selection mode */}
																	<td className="w-12 border-gray-200 border-b px-2 py-2 text-center text-gray-500 text-xs">
																		{showCheckboxes || isHovered ? (
																			<div className="flex items-center justify-center gap-1">
																				{isHovered && (
																					<GripVertical className="absolute left-1 size-4 cursor-grab text-gray-400" />
																				)}
																				<input
																					type="checkbox"
																					className="size-4"
																					checked={selectedRowIds.has(rowId)}
																					onChange={(e) => {
																						const newSelected = new Set(selectedRowIds);
																						if (e.target.checked) {
																							newSelected.add(rowId);
																							setShowCheckboxes(true);
																						} else {
																							newSelected.delete(rowId);
																							// If no rows selected, exit checkbox mode
																							if (newSelected.size === 0) {
																								setShowCheckboxes(false);
																							}
																						}
																						setSelectedRowIds(newSelected);
																					}}
																					aria-label={`Select row ${virtualRow.index + 1}`}
																				/>
																			</div>
																		) : (
																			virtualRow.index + 1
																		)}
																	</td>
																	{row
																		.getVisibleCells()
																		.filter(
																			(cell) => cell.column.id !== "row-number",
																		)
																		.map((cell) => {
																			const columnId = cell.column.id;
																			const cellKey = `${rowId}:${columnId}`;
																			const { fillPreview } = interactionState;

																			const isSelectable =
																				rowIndexLookup.has(rowId) &&
																				columnIndexLookup.has(columnId);

																			const isCellActive =
																				!!activeCell &&
																				activeCell.rowId === rowId &&
																				activeCell.columnId === columnId;

																			const isInSelectionRange = (() => {
																				if (!selection) return false;
																				const bounds =
																					getSelectionBounds(selection);
																				if (!bounds) return false;
																				const rowIndex =
																					rowIndexLookup.get(rowId);
																				const colIndex =
																					columnIndexLookup.get(columnId);
																				if (
																					rowIndex === undefined ||
																					colIndex === undefined
																				)
																					return false;
																				return (
																					rowIndex >= bounds.rowStart &&
																					rowIndex <= bounds.rowEnd &&
																					colIndex >= bounds.colStart &&
																					colIndex <= bounds.colEnd
																				);
																			})();

																			const isFillHighlighted =
																				fillPreview?.columnId === columnId &&
																				fillPreview.rows.includes(
																					virtualRow.index,
																				);

																			return (
																				<TableDataCell
																					key={cellKey}
																					cell={cell}
																					cellKey={cellKey}
																					rowId={rowId}
																					isSelectable={isSelectable}
																					isGridActive={isCellActive}
																					isSelected={isInSelectionRange}
																					isFillHighlighted={isFillHighlighted}
																					isMatch={false}
																					isActiveSearchCell={false}
																					onPointerDown={handleCellPointerDown}
																					onPointerEnter={
																						handleCellPointerEnter
																					}
																					onDoubleClick={startEditing}
																					onFillPointerDown={
																						handleFillPointerDown
																					}
																				/>
																			);
																		})}
																</tr>
															</ContextMenuTrigger>
															<ContextMenuContent className="w-48 p-2">
																<ContextMenuItem
																	onClick={() => handleInsertRecordAbove(rowId)}
																	className="flex cursor-pointer items-center gap-2 px-2 py-2 hover:bg-gray-100"
																>
																	<ArrowUp className="size-3" />
																	Insert record above
																</ContextMenuItem>
																<ContextMenuItem
																	onClick={() => handleInsertRecordBelow(rowId)}
																	className="flex cursor-pointer items-center gap-2 px-2 py-2 hover:bg-gray-100"
																>
																	<ArrowDown className="size-3" />
																	Insert record below
																</ContextMenuItem>
																<ContextMenuItem
																	onClick={() => handleDuplicateRecord(rowId)}
																	className="flex cursor-pointer items-center gap-2 px-2 py-2 hover:bg-gray-100"
																>
																	<Copy className="size-3" />
																	Duplicate record
																</ContextMenuItem>
																<ContextMenuItem
																	onClick={() =>
																		crudOperations.handleDeleteRows(rowId)
																	}
																	className="flex cursor-pointer items-center gap-2 px-2 py-2 hover:bg-gray-100"
																>
																	<Trash2 className="size-3" />
																	<span className="text-red-700">
																		Delete record
																	</span>
																</ContextMenuItem>
															</ContextMenuContent>
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
								<tfoot>
									<tr className="bg-white">
										{visibleColumns.map((col, index) => (
											<td
												key={col.id}
												className={cn(" w-full text-gray-900 text-sm")}
												colSpan={visibleColumns.length + 1}
											>
												{index === 0 ? (
													<button
														type="button"
														onClick={crudOperations.handleAddRow}
														className="flex size-8 w-full cursor-pointer items-center border-gray-200 border-r border-b pl-7.5 text-gray-600 text-xl hover:bg-gray-50 hover:text-gray-800"
													>
														+
													</button>
												) : null}
											</td>
										))}
										{/* trailing add-column cell */}
										<td className="w-[100px] border-gray-200" />
									</tr>
								</tfoot>
							</table>
							<div className="fixed bottom-10 z-20 ml-3 flex items-center text-xs">
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={crudOperations.handleFloatingAddRow}
												disabled={addRowMutation.isPending}
												className="h-8 rounded-l-full border border-gray-200 bg-white p-2 px-3 text-gray-700 text-xs transition hover:bg-gray-100"
											>
												<Plus className="size-3.5" />
											</button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Add record</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<button
									type="button"
									className="flex h-8 items-center gap-1 rounded-r-full border border-gray-200 border-l-0 bg-white p-2 px-3 text-gray-700 text-xs transition disabled:text-gray-400"
									disabled
								>
									<WandSparkles className="size-3.5" />
									Add...
								</button>
							</div>

							<AddColumnDropdown
								onCreate={crudOperations.handleAddColumn}
								isLoading={addColumnMutation.isPending}
								trigger={
									<button
										type="button"
										className="sticky top-0 w-30 cursor-pointer border-r border-b bg-white text-gray-900 text-lg hover:bg-gray-100"
										aria-label="Add column"
										style={{ height: `${ROW_HEIGHT + 3}px` }}
									>
										+
									</button>
								}
							/>
						</div>

						<DataTableStatusBar
							footerRowCount={
								(rowCountData?.count ?? rowsWithOptimistic.length) +
								optimisticRows.length
							}
							loadedCount={loadedRowsCount}
							isLoading={rowsInfinite.isFetchingNextPage || isViewportLoading}
							showApproximate={
								rowCountData === undefined && rowsInfinite.hasNextPage
							}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
