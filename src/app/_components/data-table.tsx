"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import type { Contact } from "~/lib/fake-data";
import { cn } from "~/lib/utils";

interface DataTableProps {
	data: Contact[];
	columns: ColumnDef<Contact>[];
}

export function DataTable({ data, columns }: DataTableProps) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

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
							<tr
								key={row.id}
								className={cn(
									"hover:bg-gray-50",
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
						))}
					</tbody>
				</table>
			</div>
			<div className="p-4 flex items-center justify-between text-gray-500 text-sm">
				<div className="flex items-center gap-2">
					<span className="font-medium">{data.length}</span>
					<span>records</span>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm">
						+ Add
					</Button>
				</div>
			</div>
		</div>
	);
}
