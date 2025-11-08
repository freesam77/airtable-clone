"use client";

import { type ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
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
import { AddColumnDropdown } from "./addColumnDropdown";
import { ViewsHeader } from "./dataTable/ViewsHeader";
import { ViewsSidebar } from "./dataTable/ViewsSidebar";
import { createColumnDefs, type TableData as TableRowData } from "./dataTable/columnDefs";

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

// IntersectionObserver root (scroll container)
const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);

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

	// Fetch rows via infinite query (page size 50)
	const infiniteInput = {
		id: tableId,
		limit: 50 as const,
		direction: "forward" as const,
	};
	const rowsInfinite = api.table.getInfiniteRows.useInfiniteQuery(
		infiniteInput,
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

	const utils = api.useUtils();

	// Optimistic update function for immediate UI feedback
	const handleOptimisticUpdate = useCallback(
		(rowId: string, columnId: string, value?: string | number) => {
			const stringValue = typeof value === "number" ? String(value) : value;
			const normalized = stringValue === "" ? null : stringValue;
			utils.table.getInfiniteRows.setInfiniteData(infiniteInput, (old) => {
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
	} = useTableMutations({
		tableId,
		infiniteInput,
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

	const displayData = useMemo(
		() => filterRowsByQuery(data, orderedColumns, searchValue),
		[data, orderedColumns, searchValue],
	);
	// Pre-filter rows using the same logic as the global filter so non-matching rows are hidden at the data level too

	// Create column definitions dynamically based on the table structure
	const columnDefs: ColumnDef<TableRowData>[] = createColumnDefs({
		columns: orderedColumns as any,
		displayData: displayData as any,
		selectedRowIds,
		setSelectedRowIds,
		showCheckboxes,
		setShowCheckboxes,
		handleCellUpdate,
	}) as unknown as ColumnDef<TableData>[];

const table = useReactTable({
		data: displayData,
		columns: columnDefs,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
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

// Observe last visible row: fetch next page
const { ref: lastRowRef, inView: lastRowInView } = useInView({
    root: rootEl,
    rootMargin: "200px",
    threshold: 0.1,
});

useEffect(() => {
    if (lastRowInView && rowsInfinite.hasNextPage && !rowsInfinite.isFetchingNextPage) {
        void rowsInfinite.fetchNextPage();
    }
}, [lastRowInView, rowsInfinite.hasNextPage, rowsInfinite.isFetchingNextPage]);

	// Use filtered rows for match nav/highlight (already reflects search filtering)
	const filteredRows = table.getRowModel().rows.map((r) => r.original);

	const {
		matches,
		matchKeys,
		activeMatchIndex,
		activeMatch,
		gotoNextMatch,
		gotoPrevMatch,
		getCellKey,
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

	const handleAddColumn = (name: string, type: "TEXT" | "NUMBER") => {
		addColumnMutation.mutate({
			tableId,
			name,
			type,
		});
	};

	// removed: inline add-row editing state and handlers

	const handleDeleteRows = async (clickedRowId: string) => {
		const ids =
			selectedRowIds.size > 0 ? Array.from(selectedRowIds) : [clickedRowId];
		await Promise.all(
			ids.map((id) => deleteRowMutation.mutateAsync({ rowId: id })),
		);
		setSelectedRowIds(new Set());
		utils.table.getTableColumnType.invalidate({ id: tableId });
		utils.table.getInfiniteRows.invalidate(infiniteInput);
	};

	if (tableColumnLoading || rowsInfinite.isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-gray-500">Loading table...</div>
			</div>
		);
	}

	// If metadata is missing, we cannot render the table structure
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
					table={table as any}
					matchesCount={matches.length}
					activeMatchIndex={activeMatchIndex}
					gotoPrevMatch={gotoPrevMatch}
					gotoNextMatch={gotoNextMatch}
				/>

				<div className="flex h-full">
					{/* Left views sidebar inside table area */}
					{viewSidebarOpen && <ViewsSidebar viewName={viewName} />}

					<div className="flex max-h-[90vh] w-full flex-col justify-between overflow-hidden min-h-0">
						<div
							className="flex overflow-y-auto border-gray-200 flex-1 min-h-0"
						>
							<table
								className="border bg-white"
								key={`table-${columns.length}-${columns.map((c) => c.id).join("-")}`}
							>
								<thead className="border-gray-300 border-b">
									{table.getHeaderGroups().map((headerGroup) => (
										<tr key={headerGroup.id}>
											{headerGroup.headers.map((header) => (
												<th
													key={header.id}
													className={cn(
														"border-gray-200 border-r p-2 text-left text-gray-700 text-sm",
														header.column.columnDef.meta?.className,
													)}
												>
													{header.isPlaceholder
														? null
														: flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)}
												</th>
											))}
										</tr>
									))}
								</thead>
								<tbody>
	{table.getRowModel().rows.map((row, idx, arr) => (
		<ContextMenu key={row.id}>
			<ContextMenuTrigger asChild>
				<tr
					ref={idx === arr.length - 1 ? lastRowRef : undefined}
					className={cn("cursor-default")}
				>
					{row.getVisibleCells().map((cell) => (
						<td
							key={cell.id}
							className={cn(
								"h-8 w-[150px] truncate whitespace-nowrap border-gray-200 border-r border-b text-gray-900 text-sm",
								cell.column.columnDef.meta?.className,
								(() => {
									const key = getCellKey(row.original.id, cell.column.id);
									const isMatch = Boolean(searchValue) && matchKeys.has(key);
									const isActiveCell =
										Boolean(activeMatch) &&
										activeMatch?.rowId === row.original.id &&
										activeMatch?.columnId === cell.column.id;
									return isActiveCell ? "bg-yellow-200" : isMatch ? "bg-yellow-100" : "";
								})(),
							)}
							data-cell={getCellKey(row.original.id, cell.column.id)}
						>
							{flexRender(cell.column.columnDef.cell, cell.getContext())}
						</td>
					))}
				</tr>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-48">
				<ContextMenuItem
					onClick={() => {
						handleDeleteRows(row.original.id);
					}}
					className="text-red-600 focus:bg-red-50 focus:text-red-600"
				>
					Delete row
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	))}
</tbody>
								{/* Add Row button row */}
								<tfoot>
								<tr className="border-gray-200 border-r bg-white">
									{columns
										.sort((a, b) => a.position - b.position)
										.map((col, index) => (
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
								</tr>
								</tfoot>
							</table>
							{/* Floating Add Column button (no body cells underneath) */}
							<AddColumnDropdown
								onCreate={handleAddColumn}
								isLoading={addColumnMutation.isPending}
								trigger={
									<button
										type="button"
										className="pointer-events-auto h-[41.19px] w-[100px] cursor-pointer border border-gray-200 border-l-0 bg-white text-gray-900 text-lg hover:bg-gray-100"
										aria-label="Add column"
									>
										+
									</button>
								}
							/>
						</div>
						{/* Footer with record count */}
						<div className="w-full border-t bg-white p-4 text-xs">
							<span> {table.getRowModel().rows.length} records</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}








