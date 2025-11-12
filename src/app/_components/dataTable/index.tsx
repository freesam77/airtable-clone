"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { detectOS } from "~/lib/detectOS";
import { filterRowsByQuery, rowMatchesQuery } from "~/lib/tableFilter";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { type FilterCondition, applyFilters } from "./Filters";
import { type SortCondition, applySorts } from "./Sorts";
import { ViewsHeader } from "./ViewsHeader";
import { ViewsSidebar } from "./ViewsSidebar";
import { AddColumnDropdown } from "./addColumnDropdown";
import { type TableData as TableRowData, createColumnDefs } from "./columnDefs";

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

interface DataTableProps {
	tableId: string;
}

export function DataTable({ tableId }: DataTableProps) {
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [viewSidebarOpen, setViewSidebarOpen] = useState(true);
	const [viewName, setViewName] = useState("Grid view");
	const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
	const [showCheckboxes, setShowCheckboxes] = useState(false);

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

	const [filters, setFilters] = useState<FilterCondition[]>([]);
	const [sorts, setSorts] = useState<SortCondition[]>([]);
	const [autoSort, setAutoSort] = useState(true);
	const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);

	const hiddenColumnSet = useMemo(
		() => new Set(hiddenColumnIds),
		[hiddenColumnIds],
	);

	const visibleColumns = useMemo(
		() => orderedColumns.filter((col) => !hiddenColumnSet.has(col.id)),
		[orderedColumns, hiddenColumnSet],
	);

	useEffect(() => {
		setHiddenColumnIds((prev) => {
			const available = new Set(orderedColumns.map((col) => col.id));
			const filtered = prev.filter((id) => available.has(id));
			return filtered.length === prev.length ? prev : filtered;
		});
	}, [orderedColumns]);

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
	const handleCellUpdate = useCallback(
		(rowId: string, columnId: string, value: string | number) => {
			// Find the column to determine the type
			const column = columns.find((col) => col.id === columnId);
			if (!column) return;

			// Queue the update with proper typing
			// Always queue. Empty string means clear the cell
			queueCellUpdate(rowId, columnId, value);
			// Flush pending updates immediately after a committed edit
			flushPendingUpdates();
		},
		[columns, queueCellUpdate, flushPendingUpdates],
	);

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

	// Pre-filter rows using the same logic as the global filter so non-matching rows are hidden at the data level too

	// Create column definitions dynamically based on the table structure
	const handleAddColumn = useCallback(
		(name: string, type: "TEXT" | "NUMBER") => {
			addColumnMutation.mutate({ tableId, name, type });
		},
		[addColumnMutation, tableId],
	);
	const columnDefs: ColumnDef<TableRowData>[] = createColumnDefs({
		columns: visibleColumns,
		displayData: displayData,
		selectedRowIds,
		setSelectedRowIds,
		showCheckboxes,
		setShowCheckboxes,
		handleCellUpdate,
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

	// Use filtered rows for match nav/highlight (already reflects search filtering)
	const filteredRows = table.getRowModel().rows.map((r) => r.original);

	const filteredRowsCount = rowsInfinite.hasNextPage
		? filteredRows.length + 1
		: filteredRows.length;

	const scrollParentRef = useRef<HTMLDivElement | null>(null);

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
			const os = detectOS();
			const useMeta = os === "macOS" || os === "iOS";
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
	}, []);

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

	if (tableColumnLoading || rowsInfinite.isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-gray-500">Loading table...</div>
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
					viewName={viewName}
					onRenameView={(name) => setViewName(name)}
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
					setFilters={setFilters}
					sorts={sorts}
					setSorts={setSorts}
					autoSort={autoSort}
					setAutoSort={setAutoSort}
					hiddenColumnIds={hiddenColumnIds}
					setHiddenColumnIds={setHiddenColumnIds}
				/>

				<div className="flex">
					{/* Left views sidebar inside table area */}
					{viewSidebarOpen && <ViewsSidebar viewName={viewName} />}

					<div className="flex h-[88vh] w-full flex-col justify-between">
						<div
							className="relative flex min-h-0 overflow-x-auto overflow-y-auto border-gray-200"
							ref={scrollParentRef}
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
																			const isActiveCell =
																				Boolean(activeMatch) &&
																				activeMatch?.rowId ===
																					row?.original.id &&
																				activeMatch?.columnId ===
																					cell.column.id;
																			return (
																				<td
																					key={cell.id}
																					className={cn(
																						"h-8 w-[150px] truncate whitespace-nowrap border-gray-200 border-r border-b p-2 text-gray-900 text-sm",
																						cell.column.columnDef.meta
																							?.className,
																						isActiveCell
																							? "bg-yellow-200"
																							: isMatch
																								? "bg-yellow-100"
																								: "",
																					)}
																					data-cell={key}
																				>
																					{flexRender(
																						cell.column.columnDef.cell,
																						cell.getContext(),
																					)}
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
										{visibleColumns
											.map((col, index) => (
												<td
													key={col.id}
													className={cn(
														"border-gray-200 text-gray-900 text-sm",
													)}
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
