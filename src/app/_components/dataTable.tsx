"use client";

import {
	type CellContext,
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from "@tanstack/react-table";
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
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useCellUpdateQueue } from "~/hooks/useCellUpdateQueue";
import { AddColumnDropdown } from "./addColumnDropdown";
import { EditableCell } from "./editableCell";
import { useTableSearchNavigation } from "~/hooks/useTableSearchNavigation";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { detectOS } from "~/lib/detectOS";
import { filterRowsByQuery, rowMatchesQuery } from "~/lib/tableFilter";

const getColumnTypeIcon = (type: "TEXT" | "NUMBER") => {
	return type === "TEXT" ? "A" : "#";
};

const getColumnTypeLabel = (type: "TEXT" | "NUMBER") => {
	return type === "TEXT" ? "Single line text" : "Number";
};

// Extend the column meta type to include className
declare module "@tanstack/react-table" {
	interface ColumnMeta<TData, TValue> {
		className?: string;
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
	const [isAddingRow, setIsAddingRow] = useState(false);
	const [newRowData, setNewRowData] = useState<Record<string, string>>({});
	const addRowRef = useRef<HTMLTableRowElement | null>(null);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");

	// Fetch table data directly in this component for optimistic updates
	const { data: tableData, isLoading: tableLoading } =
		api.table.getById.useQuery(
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

    // Extract data and columns from the fetched table data
    const data = tableData?.rows || [];
    const columns = tableData?.columns || [];

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
            utils.table.getById.setData({ id: tableId }, (old) => {
                if (!old) return old;

                return {
                    ...old,
                    rows: old.rows.map((row) =>
                        row.id === rowId
                            ? {
                                ...row,
                                cells: row.cells.map((cell) =>
                                    cell.column.id === columnId
                                        ? {
                                            ...cell,
                                            value: normalized ?? null,
                                          }
                                        : cell,
                                  ),
                              }
                            : row,
                    ),
                };
            });
        },
        [utils.table.getById, tableId],
    );

	// Initialize the cell update queue
    const { queueCellUpdate, flushPendingUpdates, pendingUpdatesCount, remapRowId } =
        useCellUpdateQueue({
            tableId,
            onOptimisticUpdate: handleOptimisticUpdate,
        });

	// Flush pending updates before page unload
	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (pendingUpdatesCount > 0) {
				// Attempt to flush pending updates
				flushPendingUpdates();
				// Show browser warning about unsaved changes
				event.preventDefault();
				event.returnValue = "";
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [pendingUpdatesCount, flushPendingUpdates]);
	const addRowMutation = api.table.addRow.useMutation({
		onMutate: async (variables) => {
			await utils.table.getById.cancel({ id: tableId });
			const previousData = utils.table.getById.getData({ id: tableId });

			// Immediately hide the editing state and clear input data
			setIsAddingRow(false);
			setNewRowData({});

			// Create optimistic row
			const optimisticRowId = `temp-${Date.now()}`;
			const now = new Date();
			const optimisticRow: TableData = {
				id: optimisticRowId,
				position: previousData?.rows.length || 0,
				createdAt: now,
				updatedAt: now,
				tableId: tableId,
				cells: variables.cells.map((cv) => {
					const column = previousData?.columns.find(
						(col) => col.id === cv.columnId,
					);
					return {
						id: `temp-cell-${Date.now()}-${cv.columnId}`,
						columnId: cv.columnId,
						rowId: optimisticRowId,
						value: cv.value || null,
						column: column || {
							id: cv.columnId,
							name: "Unknown",
							type: "TEXT" as const,
							required: false,
							position: 0,
							tableId: tableId,
						},
					};
				}),
			};

			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					rows: [...old.rows, optimisticRow],
				};
			});

			return { previousData, optimisticRow };
		},
        onSuccess: (result, _variables, context) => {
            // Replace optimistic row with server result
            if (context?.optimisticRow?.id && result?.id) {
                remapRowId(context.optimisticRow.id, result.id);
            }
            utils.table.getById.setData({ id: tableId }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    rows: old.rows.map((row) =>
                        row.id === context?.optimisticRow.id ? result : row,
                    ),
                };
            });
        },
		onError: (err, variables, context) => {
			void err;
			void variables;
			if (context?.previousData) {
				utils.table.getById.setData({ id: tableId }, context.previousData);
			}
			// Show the editing state again on error
			setIsAddingRow(true);
		},
		onSettled: () => {
			utils.table.getById.invalidate({ id: tableId });
		},
	});

	const addColumnMutation = api.table.addColumn.useMutation({
		onMutate: async (variables) => {
			await utils.table.getById.cancel({ id: tableId });
			const previousData = utils.table.getById.getData({ id: tableId });

			// Create optimistic column with all required fields
			const optimisticColumn = {
				id: `temp-col-${Date.now()}`,
				name: variables.name,
				type: variables.type,
				position: previousData?.columns.length || 0,
				required: false,
				tableId: tableId,
			};

			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					columns: [...old.columns, optimisticColumn],
					// Add empty cell values for existing rows
					rows: old.rows.map((row) => ({
						...row,
						cells: [
							...row.cells,
							{
								id: `temp-cell-${Date.now()}-${row.id}`,
								columnId: optimisticColumn.id,
								rowId: row.id,
								value: null,
								column: optimisticColumn,
							},
						],
					})),
				};
			});

			return { previousData, optimisticColumn };
		},
		onSuccess: (result, variables, context) => {
			// Replace optimistic column with server result and update all related cell values
			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					columns: old.columns.map((col) =>
						col.id === context?.optimisticColumn.id ? result : col,
					),
					rows: old.rows.map((row) => ({
						...row,
						cells: row.cells.map((cell) =>
							cell.column.id === context?.optimisticColumn.id
								? { ...cell, column: result }
								: cell,
						),
					})),
				};
			});
		},
		onError: (err, variables, context) => {
			void err;
			void variables;
			if (context?.previousData) {
				utils.table.getById.setData({ id: tableId }, context.previousData);
			}
		},
		onSettled: () => {
			utils.table.getById.invalidate({ id: tableId });
		},
	});

	const deleteRowMutation = api.table.deleteRow.useMutation({
		onMutate: async (variables) => {
			await utils.table.getById.cancel({ id: tableId });
			const previousData = utils.table.getById.getData({ id: tableId });

			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					rows: old.rows.filter((row) => row.id !== variables.rowId),
				};
			});

			return { previousData };
		},
		onError: (err, variables, context) => {
			void err;
			void variables;
			if (context?.previousData) {
				utils.table.getById.setData({ id: tableId }, context.previousData);
			}
		},
		onSettled: () => {
			utils.table.getById.invalidate({ id: tableId });
		},
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
        },
        [columns, queueCellUpdate],
    );

	// Create column definitions dynamically based on the table structure
	// Force re-render when columns change by including columns length in dependency
	const columnDefs: ColumnDef<TableData>[] = [
		// Data columns
		...columns
			.sort((a, b) => a.position - b.position)
			.map((col) => ({
				id: col.id,
				header: () => (
					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="flex h-4 w-4 items-center justify-center rounded bg-muted text-muted-foreground text-xs">
										{getColumnTypeIcon(col.type)}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									<p>{getColumnTypeLabel(col.type)}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						<span className="font-medium">{col.name}</span>
					</div>
				),
				cell: ({ getValue, row, column }: CellContext<TableData, unknown>) => {
					const cells = getValue() as Cell | undefined;
					const value = cells?.value || "";

					return (
						<EditableCell
							value={value}
							rowId={row.original.id}
							column={{
								...column,
								columnDef: {
									...column.columnDef,
									meta: { ...column.columnDef.meta, type: col.type },
								},
							}}
							handleCellUpdate={handleCellUpdate}
						/>
					);
				},
				accessorFn: (row: TableData) =>
					row.cells.find(
						(cv: { column: { id: string } }) => cv.column.id === col.id,
					),
			})),
		// Add Column button - pinned to right
		{
			id: "add-column",
			header: () => (
				<AddColumnDropdown
					onCreate={handleAddColumn}
					isLoading={addColumnMutation.isPending}
					trigger={
						<button
							type="button"
							className="h-full w-full cursor-pointer transition-colors hover:bg-gray-100"
						>
							+
						</button>
					}
				/>
			),
			cell: () => null, // Empty cell for data rows
			enableGlobalFilter: false,
			enablePinning: true,
			meta: {
				className:
					"sticky right-0 z-10 bg-gray-50 p-0 text-center font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 items-center justify-center text-xl",
			},
		},
	];

    // Pre-filter rows using the same logic as the global filter so non-matching rows are hidden at the data level too
    const displayData = useMemo(
        () => filterRowsByQuery(data, orderedColumns, searchValue),
        [data, orderedColumns, searchValue],
    );

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
            rowMatchesQuery(row.original as any, orderedColumns, String(filterValue ?? "")),
        enableColumnPinning: true,
        initialState: {
            columnPinning: {
                right: ["add-column"],
            },
        },
    });

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
					const input = document.getElementById("table-search") as HTMLInputElement | null;
					input?.focus();
					input?.select();
				}, 0);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const submitNewRow = () => {
		// Check if there's any data to submit
		const hasData = Object.values(newRowData).some(
			(value) => value.trim() !== "",
		);

		if (!hasData) {
			// If no data, just cancel the add operation
			handleCancelAdd();
			return;
		}

		const cells = columns.map((col) => ({
			columnId: col.id,
			value: newRowData[col.id] || "",
		}));

		addRowMutation.mutate({
			tableId,
			cells: cells,
		});
	};

	const handleAddRow = () => {
		if (isAddingRow) {
			submitNewRow();
			return;
		}
		// Start adding a new row
		setIsAddingRow(true);
	};

	const handleAddColumn = (name: string, type: "TEXT" | "NUMBER") => {
		addColumnMutation.mutate({
			tableId,
			name,
			type,
		});
	};

	const handleCancelAdd = () => {
		setIsAddingRow(false);
		setNewRowData({});
	};

	const handleInputChange = (columnId: string, value: string) => {
		setNewRowData((prev) => ({
			...prev,
			[columnId]: value,
		}));
	};

	const handleDeleteRow = (rowId: string) => {
		deleteRowMutation.mutate({ rowId });
	};

	if (tableLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-gray-500">Loading table...</div>
			</div>
		);
	}

	if (!tableData) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-gray-500">Table not found.</div>
			</div>
		);
	}

	return (
		<div className="flex-1 bg-white">
			<div className="flex justify-end border-b bg-white p-2">
				<DropdownMenu open={searchOpen} onOpenChange={setSearchOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="cursor-pointer">
							<Search />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-full bg-white">
						<div className="flex items-center gap-3">
            <Input
                id="table-search"
                type="text"
                value={String(table.getState().globalFilter ?? "")}
                onChange={(e) => table.setGlobalFilter(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "NumpadEnter") {
                        // Prevent the dropdown from handling Enter and possibly closing
                        e.preventDefault();
                        e.stopPropagation();
										if (e.shiftKey) {
											gotoPrevMatch();
										} else {
											gotoNextMatch();
										}
									}
								}}
								placeholder="Find in view"
								autoFocus
							/>
							<div className="min-w-20 text-center text-gray-500 text-xs">
								{matches.length > 0 &&
									`${activeMatchIndex + 1} / ${matches.length}`}
							</div>
							<div className="flex gap-1">
								<Button
									variant="outline"
									size="icon"
									onClick={gotoPrevMatch}
									disabled={matches.length === 0}
									aria-label="Previous match"
								>
									<ChevronUp className="h-4 w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									onClick={gotoNextMatch}
									disabled={matches.length === 0}
									aria-label="Next match"
								>
									<ChevronDown className="h-4 w-4" />
								</Button>
							</div>
							<Button
								variant="ghost"
								className="cursor-pointer"
								onClick={() => setSearchOpen(false)}
							>
								<X />
							</Button>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="relative overflow-hidden rounded-lg border border-gray-200">
				<table
					className="w-full"
					key={`table-${columns.length}-${columns.map((c) => c.id).join("-")}`}
				>
					<thead className="border-gray-200 border-b bg-gray-50">
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className={cn(
											"border-gray-200 border-r px-4 py-3 text-left font-medium text-gray-700 text-sm last:border-r-0",
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
					<tbody className="divide-y divide-gray-200">
						{table.getRowModel().rows.map((row, index) => (
							<ContextMenu key={row.id}>
								<ContextMenuTrigger asChild>
									<tr
										className={cn(
											"cursor-default hover:bg-gray-50",
											index % 2 === 0 ? "bg-white" : "bg-gray-50/30",
										)}
									>
										{row.getVisibleCells().map((cell) => (
											<td
												key={cell.id}
												className={cn(
													"border-gray-200 border-r px-4 py-3 text-gray-900 text-sm last:border-r-0",
													cell.column.columnDef.meta?.className,
													(() => {
														const key = getCellKey(
															row.original.id,
															cell.column.id,
														);
														const isMatch =
															Boolean(searchValue) && matchKeys.has(key);
														const isActiveCell =
															Boolean(activeMatch) &&
															activeMatch?.rowId === row.original.id &&
															activeMatch?.columnId === cell.column.id;
														// Darker bg for active cell; lighter bg for other matched cells
														return isActiveCell
															? "bg-yellow-200"
															: isMatch
																? "bg-yellow-100"
																: "";
													})(),
												)}
												data-cell={getCellKey(row.original.id, cell.column.id)}
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</td>
										))}
									</tr>
								</ContextMenuTrigger>
								<ContextMenuContent className="w-48">
									<ContextMenuItem
										onClick={() => handleDeleteRow(row.original.id)}
										className="text-red-600 focus:bg-red-50 focus:text-red-600"
									>
										Delete row
									</ContextMenuItem>
								</ContextMenuContent>
							</ContextMenu>
						))}
						{isAddingRow && (
							<tr className="bg-blue-50" ref={addRowRef}>
								{columns
									.sort((a, b) => a.position - b.position)
									.map((col) => (
										<td
											key={col.id}
											className="border-gray-200 border-r px-4 py-3 last:border-r-0"
										>
											<input
												type={col.type === "NUMBER" ? "number" : "text"}
												value={newRowData[col.id] ?? ""}
												onChange={(e) =>
													handleInputChange(col.id, e.target.value)
												}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														submitNewRow();
													}
													if (e.key === "Escape") {
														e.preventDefault();
														handleCancelAdd();
													}
												}}
												onBlur={() => {
													// Delay to allow focus to move to another input inside the same row
													setTimeout(() => {
														const container = addRowRef.current;
														if (!container) return;
														const active = document.activeElement;
														if (active && container.contains(active)) {
															return; // still within row inputs
														}
														submitNewRow();
													}, 0);
												}}
												className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
												placeholder={`Enter ${col.name.toLowerCase()}`}
											/>
										</td>
									))}
								{/* Empty cell for Add Column column in add row */}
								<td className="sticky right-0 z-10 border border-gray-200 border-l-0 bg-blue-50 px-4 py-3">
									{/* Empty cell to match header */}
								</td>
							</tr>
						)}
					</tbody>
					{/* Add Row button row */}
					<tr className="border-gray-200 border-t bg-white">
						{columns
							.sort((a, b) => a.position - b.position)
							.map((col, index) => (
								<td
									key={col.id}
									className={cn(
										"border-gray-200 border-r px-4 py-3 text-gray-900 text-sm last:border-r-0",
										index === 0 && "border-b-0", // Remove bottom border for first cell
									)}
								>
									{index === 0 ? (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<button
														type="button"
														onClick={handleAddRow}
														className="flex h-8 w-8 cursor-pointer items-center justify-center text-gray-600 text-xl hover:bg-gray-50 hover:text-gray-800"
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
						{/* Add Column cell */}
						<td className="sticky right-0 z-10 w-[50px] border border-gray-200 border-b-0 border-l-0 bg-white px-4 py-3 text-center">
							{/* Empty cell to match header */}
						</td>
					</tr>
				</table>
			</div>
			{/* Footer with record count */}
			<div className="flex items-center justify-end border-gray-200 border-t p-4 text-gray-500 text-sm">
				<div className="flex items-center gap-2">
					<span className="font-medium">{table.getRowModel().rows.length}</span>
					<span>records</span>
				</div>
			</div>
		</div>
	);
}
