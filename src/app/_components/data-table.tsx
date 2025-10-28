"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

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

	const utils = api.useUtils();
	const addRowMutation = api.table.addRow.useMutation({
		onSuccess: () => {
			utils.table.getAll.invalidate();
			setIsAddingRow(false);
			setNewRowData({});
		},
	});

	const deleteRowMutation = api.table.deleteRow.useMutation({
		onSuccess: () => {
			utils.table.getAll.invalidate();
		},
	});

	// Create column definitions dynamically based on the table structure
	const columnDefs: ColumnDef<TableData>[] = columns
		.sort((a, b) => a.position - b.position)
		.map((col) => ({
			accessorKey: col.id,
			header: col.name,
			cell: ({ row }) => {
				const cellValue = row.original.cellValues.find(
					(cv) => cv.column.id === col.id,
				);
				const value = cellValue?.textValue ?? cellValue?.numberValue ?? "";
				return <span>{String(value)}</span>;
			},
		}));

	const table = useReactTable({
		data,
		columns: columnDefs,
		getCoreRowModel: getCoreRowModel(),
	});

	const handleAddRow = () => {
		if (isAddingRow) {
			// Submit the new row
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
		} else {
			// Start adding a new row
			setIsAddingRow(true);
		}
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
			<div className="overflow-hidden rounded-lg border border-gray-200">
				<table className="w-full">
					<thead className="border-gray-200 border-b bg-gray-50">
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className="border-gray-200 border-r px-4 py-3 text-left font-medium text-gray-700 text-sm last:border-r-0"
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
											"hover:bg-gray-50 cursor-default",
											index % 2 === 0 ? "bg-white" : "bg-gray-50/30",
										)}
									>
										{row.getVisibleCells().map((cell) => (
											<td
												key={cell.id}
												className="border-gray-200 border-r px-4 py-3 text-gray-900 text-sm last:border-r-0"
											>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</td>
										))}
									</tr>
								</ContextMenuTrigger>
								<ContextMenuContent className="w-48">
									<ContextMenuItem
										onClick={() => handleDeleteRow(row.original.id)}
										className="text-red-600 focus:text-red-600 focus:bg-red-50"
									>
										Delete row
									</ContextMenuItem>
								</ContextMenuContent>
							</ContextMenu>
						))}
						{isAddingRow && (
							<tr className="bg-blue-50">
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
												onChange={(e) => handleInputChange(col.id, e.target.value)}
												className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
												placeholder={`Enter ${col.name.toLowerCase()}`}
											/>
										</td>
									))}
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<div className="flex items-center justify-between p-4 text-sm text-gray-500">
				<div className="flex items-center gap-2">
					<span className="font-medium">{data.length}</span>
					<span>records</span>
				</div>
				<div className="flex items-center gap-2">
					{isAddingRow && (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCancelAdd}
								disabled={addRowMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								variant="default"
								size="sm"
								onClick={handleAddRow}
								disabled={addRowMutation.isPending}
							>
								{addRowMutation.isPending ? "Adding..." : "Save"}
							</Button>
						</>
					)}
					{!isAddingRow && (
						<Button variant="outline" size="sm" onClick={handleAddRow}>
							+ Add
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
