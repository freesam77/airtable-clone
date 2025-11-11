"use client";

import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { useEffect, useRef } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { EditableCell } from "../editableCell";

export type ColumnType = "TEXT" | "NUMBER";

export type ColumnMeta = {
	id: string;
	name: string;
	type: ColumnType;
	required: boolean;
	position: number;
	tableId: string;
};

export type Cell = {
	id: string;
	columnId: string;
	value: string | null;
	rowId: string;
	column: ColumnMeta;
};

export type TableData = {
	id: string;
	position: number;
	createdAt: Date;
	updatedAt: Date;
	tableId: string;
	cells: Array<Cell>;
};

const getColumnTypeIcon = (type: ColumnType) => (type === "TEXT" ? "A" : "#");
const getColumnTypeLabel = (type: ColumnType) =>
	type === "TEXT" ? "Single line text" : "Number";

type CreateColumnDefsParams = {
	columns: ColumnMeta[];
	displayData: TableData[];
	selectedRowIds: Set<string>;
	setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	showCheckboxes: boolean;
	setShowCheckboxes: React.Dispatch<React.SetStateAction<boolean>>;
	handleCellUpdate: (
		rowId: string,
		columnId: string,
		value: string | number,
	) => void;
};

export function createColumnDefs({
	columns,
	displayData,
	selectedRowIds,
	setSelectedRowIds,
	showCheckboxes,
	setShowCheckboxes,
	handleCellUpdate,
}: CreateColumnDefsParams): ColumnDef<TableData>[] {
	return [
		{
			id: "row-number",
			header: () => {
				const visibleIds = displayData.map((r) => r.id);
				const someSelected = visibleIds.some((id) => selectedRowIds.has(id));

				const ref = useRef<HTMLInputElement | null>(null);
				useEffect(() => {
					if (ref.current)
						ref.current.indeterminate = !showCheckboxes && someSelected;
				}, [someSelected, showCheckboxes]);

				const toggleAll = (checked: boolean) => {
					setSelectedRowIds((prev) => {
						const next = new Set(prev);
						if (checked) {
							for (const id of visibleIds) next.add(id);
						} else {
							for (const id of visibleIds) next.delete(id);
						}
						return next;
					});
				};

				return (
					<input
						ref={ref}
						type="checkbox"
						aria-label="Select all"
						className="size-4"
						checked={showCheckboxes}
						onChange={(e) => {
							const checked = e.target.checked;
							setShowCheckboxes(checked);
							toggleAll(checked);
						}}
					/>
				);
			},
			cell: ({ row }) => {
				const checked = selectedRowIds.has(row.original.id);
				const onToggle = () =>
					setSelectedRowIds((prev) => {
						const next = new Set(prev);
						if (next.has(row.original.id)) next.delete(row.original.id);
						else next.add(row.original.id);
						return next;
					});
				return (
					<div className="relative flex items-center justify-center">
						{showCheckboxes && (
							<input
								type="checkbox"
								aria-label="Select row"
								className="size-4"
								checked={checked}
								onChange={onToggle}
							/>
						)}
						{!showCheckboxes && (
							<span className="text-gray-500 text-xs">{row.index + 1}</span>
						)}
					</div>
				);
			},
			enableSorting: false,
			meta: {
				className: "w-[60px] border-b bg-white z-10 text-center",
			},
		},
		...columns
			.sort((a, b) => a.position - b.position)
			.map((col) => ({
				id: col.id,
            header: () => (
                <div className="flex min-w-0 items-center">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex size-6 flex-none items-center justify-center text-md text-muted-foreground">
                                    {getColumnTypeIcon(col.type)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{getColumnTypeLabel(col.type)}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <span className="flex-1 truncate whitespace-nowrap font-medium">{col.name}</span>
                </div>
            ),
                cell: ({ getValue, row }: CellContext<TableData, unknown>) => {
                    const cells = getValue() as Cell | undefined;
                    const value = cells?.value || "";
                    return (
                        <EditableCell
                            value={value}
                            rowId={row.original.id}
                            columnId={col.id}
                            type={col.type}
                            handleCellUpdate={handleCellUpdate}
                        />
                    );
                },
				accessorFn: (row: TableData) =>
					row.cells.find(
						(cv: { column: { id: string } }) => cv.column.id === col.id,
					),
			})),
	];
}
