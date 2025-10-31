"use client";

import {
	type CellContext,
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { AddColumnDropdown } from "./add-column-dropdown";
import { EditableCell } from "./editable-cell";

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

type CellValue = {
	id: string;
	columnId: string;
	textValue: string | null;
	numberValue: number | null;
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
	cellValues: Array<CellValue>;
};

interface DataTableProps {
	tableId: string;
}

export function DataTable({ tableId }: DataTableProps) {
	const [isAddingRow, setIsAddingRow] = useState(false);
	const [newRowData, setNewRowData] = useState<Record<string, string>>({});
	const addRowRef = useRef<HTMLTableRowElement | null>(null);

	// Fetch table data directly in this component for optimistic updates
	const {
		data: tableData,
		isLoading: tableLoading,
	} = api.table.getById.useQuery(
		{ id: tableId },
		{
			retry: (failureCount, error) => {
				if (error?.data?.code === "UNAUTHORIZED") {
					return false;
				}
				return failureCount < 3;
			},
		}
	);

	// Extract data and columns from the fetched table data
	const data = tableData?.rows || [];
	const columns = tableData?.columns || [];

	const utils = api.useUtils();

	// Optimistic update function for immediate UI feedback
	const handleOptimisticUpdate = useCallback(
		(
			rowId: string,
			columnId: string,
			textValue?: string,
			numberValue?: number,
		) => {
			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				
				return {
					...old,
					rows: old.rows.map(row => 
						row.id === rowId 
							? {
								...row,
								cellValues: row.cellValues.map(cell =>
									cell.column.id === columnId
										? {
											...cell,
											textValue: textValue ?? null,
											numberValue: numberValue ?? null
										}
										: cell
								)
							}
							: row
					)
				};
			});
		},
		[utils.table.getById, tableId],
	);

	// Initialize the cell update queue
	const { queueCellUpdate, flushPendingUpdates, pendingUpdatesCount, isProcessing } = 
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
				event.returnValue = '';
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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
				position: (previousData?.rows.length || 0),
				createdAt: now,
				updatedAt: now,
				tableId: tableId,
				cellValues: variables.cellValues.map(cv => {
					const column = previousData?.columns.find(col => col.id === cv.columnId);
					return {
						id: `temp-cell-${Date.now()}-${cv.columnId}`,
						columnId: cv.columnId,
						rowId: optimisticRowId,
						textValue: cv.textValue || null,
						numberValue: cv.numberValue || null,
						column: column || {
							id: cv.columnId,
							name: 'Unknown',
							type: 'TEXT' as const,
							required: false,
							position: 0,
							tableId: tableId
						}
					};
				})
			};

			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					rows: [...old.rows, optimisticRow]
				};
			});

			return { previousData, optimisticRow };
		},
		onSuccess: (result, variables, context) => {
			// Replace optimistic row with server result
			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					rows: old.rows.map(row => 
						row.id === context?.optimisticRow.id ? result : row
					)
				};
			});
		},
		onError: (err, variables, context) => {
			if (context?.previousData) {
				utils.table.getById.setData({ id: tableId }, context.previousData);
			}
			// Show the editing state again on error
			setIsAddingRow(true);
		},
		onSettled: () => {
			utils.table.getById.invalidate({ id: tableId });
		}
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
				tableId: tableId
			};

			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					columns: [...old.columns, optimisticColumn],
					// Add empty cell values for existing rows
					rows: old.rows.map(row => ({
						...row,
						cellValues: [...row.cellValues, {
							id: `temp-cell-${Date.now()}-${row.id}`,
							columnId: optimisticColumn.id,
							rowId: row.id,
							textValue: null,
							numberValue: null,
							column: optimisticColumn
						}]
					}))
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
					columns: old.columns.map(col => 
						col.id === context?.optimisticColumn.id ? result : col
					),
					rows: old.rows.map(row => ({
						...row,
						cellValues: row.cellValues.map(cell =>
							cell.column.id === context?.optimisticColumn.id
								? { ...cell, column: result }
								: cell
						)
					}))
				};
			});
		},
		onError: (err, variables, context) => {
			if (context?.previousData) {
				utils.table.getById.setData({ id: tableId }, context.previousData);
			}
		},
		onSettled: () => {
			utils.table.getById.invalidate({ id: tableId });
		}
	});

	const deleteRowMutation = api.table.deleteRow.useMutation({
		onMutate: async (variables) => {
			await utils.table.getById.cancel({ id: tableId });
			const previousData = utils.table.getById.getData({ id: tableId });

			utils.table.getById.setData({ id: tableId }, (old) => {
				if (!old) return old;
				return {
					...old,
					rows: old.rows.filter(row => row.id !== variables.rowId)
				};
			});

			return { previousData };
		},
		onError: (err, variables, context) => {
			if (context?.previousData) {
				utils.table.getById.setData({ id: tableId }, context.previousData);
			}
		},
		onSettled: () => {
			utils.table.getById.invalidate({ id: tableId });
		}
	});

	// Handle cell value updates using the queue
	const handleCellUpdate = useCallback(
		(
			rowId: string,
			columnId: string,
			value: string | number,
		) => {
			// Find the column to determine the type
			const column = columns.find((col) => col.id === columnId);
			if (!column) return;

			// Queue the update with proper typing
			if (column.type === "TEXT") {
				queueCellUpdate(rowId, columnId, String(value), undefined);
			} else if (column.type === "NUMBER") {
				queueCellUpdate(rowId, columnId, undefined, Number(value));
			}
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
				cell: ({ getValue, row, column, table }: CellContext<TableData, unknown>) => {
					const cellValue = getValue() as CellValue | undefined;
					const value = cellValue?.textValue ?? cellValue?.numberValue ?? "";

					return (
						<EditableCell
							value={value}
							row={row}
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
					row.cellValues.find(
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
			enablePinning: true,
			meta: {
				className:
					"sticky right-0 z-10 bg-gray-50 p-0 text-center font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 items-center justify-center text-xl",
			},
		},
	];

	const table = useReactTable({
		data,
		columns: columnDefs,
		getCoreRowModel: getCoreRowModel(),
		enableColumnPinning: true,
		initialState: {
			columnPinning: {
				right: ["add-column"],
			},
		},
	});

	const submitNewRow = () => {
		// Check if there's any data to submit
		const hasData = Object.values(newRowData).some(value => value.trim() !== "");
		
		if (!hasData) {
			// If no data, just cancel the add operation
			handleCancelAdd();
			return;
		}

		const cellValues = columns.map((col) => ({
			columnId: col.id,
			textValue: col.type === "TEXT" ? (newRowData[col.id] || "") : undefined,
			numberValue:
				col.type === "NUMBER" && newRowData[col.id]
					? Number.parseFloat(newRowData[col.id] ?? "0")
					: undefined,
		}));

		addRowMutation.mutate({
			tableId,
			cellValues,
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
			<div className="relative overflow-hidden rounded-lg border border-gray-200">
				<table className="w-full" key={`table-${columns.length}-${columns.map(c => c.id).join('-')}`}>
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
												)}
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
					<span className="font-medium">{data.length}</span>
					<span>records</span>
				</div>
			</div>
		</div>
	);
}
