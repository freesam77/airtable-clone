"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useRef, useState } from "react";
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
import { AddColumnDropdown } from "./add-column-dropdown";

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

type TableData = {
	id: string;
	position: number;
	cellValues: Array<{
		id: string;
		textValue: string | null;
		numberValue: number | null;
		column: {
			id: string;
			name: string;
			type: "TEXT" | "NUMBER";
		};
	}>;
};

interface DataTableProps {
	tableId: string;
	data: TableData[];
	columns: Array<{
		id: string;
		name: string;
		type: "TEXT" | "NUMBER";
		position: number;
	}>;
}

export function DataTable({ tableId, data, columns }: DataTableProps) {
	const [isAddingRow, setIsAddingRow] = useState(false);
	const [newRowData, setNewRowData] = useState<Record<string, string>>({});
	const addRowRef = useRef<HTMLTableRowElement | null>(null);

	const utils = api.useUtils();
	const addRowMutation = api.table.addRow.useMutation({
		onSuccess: () => {
			utils.base.invalidate();
			setIsAddingRow(false);
			setNewRowData({});
		},
	});

	const addColumnMutation = api.table.addColumn.useMutation({
		onSuccess: () => {
			utils.base.invalidate();
		},
	});

	const deleteRowMutation = api.table.deleteRow.useMutation({
		onSuccess: () => {
			utils.base.invalidate();
		},
	});


	// Create column definitions dynamically based on the table structure
	const columnDefs: ColumnDef<TableData>[] = [
		// Data columns
		...columns
			.sort((a, b) => a.position - b.position)
			.map((col) => ({
				id: col.id,
				accessorKey: col.id,
				header: () => (
					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="flex items-center justify-center w-4 h-4 text-xs text-muted-foreground bg-muted rounded">
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
				cell: ({ row }: { row: { original: TableData } }) => {
					const cellValue = row.original.cellValues.find(
						(cv: { column: { id: string } }) => cv.column.id === col.id,
					);
					const value = cellValue?.textValue ?? cellValue?.numberValue ?? "";
					return <span>{String(value)}</span>;
				},
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
							className="cursor-pointer w-full h-full hover:bg-gray-100 transition-colors"
						>
							+
						</button>
					}
				/>
			),
			cell: () => null, // Empty cell for data rows
			enablePinning: true,
			meta: {
				className: "sticky right-0 z-10 bg-gray-50 p-0 text-center font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 items-center justify-center text-xl",
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
		const cellValues = columns.map((col) => ({
			columnId: col.id,
			textValue: col.type === "TEXT" ? newRowData[col.id] : undefined,
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

	return (
		<div className="flex-1 bg-white">
			<div className="relative overflow-hidden rounded-lg border border-gray-200">
				<table className="w-full">
					<thead className="border-gray-200 border-b bg-gray-50">
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className={cn(
											"border-gray-200 border-r px-4 py-3 text-left font-medium text-gray-700 text-sm last:border-r-0",
											header.column.columnDef.meta?.className
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
													cell.column.columnDef.meta?.className
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
					<tr className="border-t border-gray-200 bg-white">
						{columns
							.sort((a, b) => a.position - b.position)
							.map((col, index) => (
								<td
									key={col.id}
									className={cn(
										"border-gray-200 border-r px-4 py-3 text-gray-900 text-sm last:border-r-0",
										index === 0 && "border-b-0" // Remove bottom border for first cell
									)}
								>
									{index === 0 ? (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<button
														type="button"
														onClick={handleAddRow}
														className="flex h-8 w-8 items-center justify-center text-xl text-gray-600 hover:bg-gray-50 hover:text-gray-800 cursor-pointer"
													>
														+
													</button>
												</TooltipTrigger>
												<TooltipContent>
													<p>You can also insert a new record anywhere by pressing Shift-Enter</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									) : null}
								</td>
							))}
						{/* Add Column cell */}
						<td className="sticky right-0 z-10 w-[50px] border border-gray-200 border-l-0 border-b-0 bg-white px-4 py-3 text-center">
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
