"use client";

import type { CellContext, ColumnDef, RowData } from "@tanstack/react-table";
import { GripVertical } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { EditableCell } from "./components/cells/EditableCell";

import type { Cell, TableData } from "~/types/dataTable";
import {
	createCellKey,
	findCellInRow,
	resolveCellValue,
} from "./utils/cellUtils";
import { getColumnTypeIcon, getColumnTypeLabel } from "./utils/columnUtils";
import {
	hasPartialSelection,
	toggleAllRowsSelection,
	toggleSingleRowSelection,
} from "./utils/rowSelectionUtils";

declare module "@tanstack/react-table" {
	interface ColumnMeta<TData extends RowData, TValue> {
		table?: string;
		className?: string;
		type?: string;
		name?: string;
		position?: number;
	}
}

type RowNumberHeaderProps = {
	displayDataIds: string[];
	selectedRowIds: Set<string>;
	setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	showCheckboxes: boolean;
	setShowCheckboxes: React.Dispatch<React.SetStateAction<boolean>>;
};

const RowNumberHeader = memo(function RowNumberHeader({
	displayDataIds,
	selectedRowIds,
	setSelectedRowIds,
	showCheckboxes,
	setShowCheckboxes,
}: RowNumberHeaderProps) {
	const visibleIds = displayDataIds;
	const someSelected = hasPartialSelection(visibleIds, selectedRowIds);

	const ref = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		if (ref.current)
			ref.current.indeterminate = !showCheckboxes && someSelected;
	}, [someSelected, showCheckboxes]);

	const toggleAll = (checked: boolean) => {
		toggleAllRowsSelection(checked, visibleIds, setSelectedRowIds);
	};

	return (
		<input
			ref={ref}
			type="checkbox"
			aria-label="Select all"
			className="flex size-4 w-full items-center"
			checked={showCheckboxes}
			onChange={(e) => {
				const checked = e.target.checked;
				setShowCheckboxes(checked);
				toggleAll(checked);
			}}
		/>
	);
});

const RowNumberCell = memo(function RowNumberCell({
	rowId,
	rowNumber,
	checked,
	isHovered,
	showCheckboxes,
	onToggle,
}: {
	rowId: string;
	rowNumber: number;
	checked: boolean;
	isHovered: boolean;
	showCheckboxes: boolean;
	onToggle: () => void;
}) {
	const isSelected = checked;
	const showRowCheckbox = showCheckboxes || isHovered || isSelected;
	const showGrip = isHovered && showRowCheckbox;

	return (
		<div className="relative flex items-center justify-center gap-1">
			{showGrip && (
				<button
					type="button"
					disabled
					className="absolute left-0 flex cursor-not-allowed items-center justify-center opacity-60"
					aria-label="Drag row (disabled)"
				>
					<GripVertical className="size-3 text-gray-400" />
				</button>
			)}
			{showRowCheckbox && (
				<input
					type="checkbox"
					aria-label="Select row"
					className="size-4"
					checked={checked}
					onChange={onToggle}
				/>
			)}
			{!showRowCheckbox && (
				<span className="text-gray-500 text-xs">{rowNumber}</span>
			)}
		</div>
	);
});

const ColumnHeaderLabel = memo(function ColumnHeaderLabel({
	col,
}: {
	col: any;
}) {
	return (
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
			<span className="flex-1 truncate whitespace-nowrap font-medium">
				{col.name}
			</span>
		</div>
	);
});

type CreateColumnDefsParams = {
	columns: any[];
	displayData: TableData[];
	rowNumberMap: Map<string, number>;
	selectedRowIds: Set<string>;
	setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	showCheckboxes: boolean;
	setShowCheckboxes: React.Dispatch<React.SetStateAction<boolean>>;
	hoveredRowId: string | null;
	editingCell: { rowId: string; columnId: string } | null;
	onCommitEdit: (
		rowId: string,
		columnId: string,
		value: string,
		previousValue: string | number | null,
	) => void;
	onCancelEdit: () => void;
	onNavigate: (
		cell: { rowId: string; columnId: string },
		direction: "forward" | "backward",
	) => void;
	getInitialEditValue: (cell: { rowId: string; columnId: string }) =>
		| string
		| null;
	onInitialValueConsumed: () => void;
};

export function createColumnDefs({
	columns,
	displayData,
	rowNumberMap,
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
	onInitialValueConsumed,
}: CreateColumnDefsParams): ColumnDef<TableData>[] {
	return [
		{
			id: "row-number",
			header: () => (
				<RowNumberHeader
					displayDataIds={displayData.map((r) => r.id)}
					selectedRowIds={selectedRowIds}
					setSelectedRowIds={setSelectedRowIds}
					showCheckboxes={showCheckboxes}
					setShowCheckboxes={setShowCheckboxes}
				/>
			),
			cell: ({ row }) => {
				const checked = selectedRowIds.has(row.original.id);
				const isHovered = hoveredRowId === row.original.id;
				const rowNumber = rowNumberMap.get(row.original.id) ?? row.index + 1;
				const onToggle = () =>
					toggleSingleRowSelection(row.original.id, setSelectedRowIds);
				return (
					<RowNumberCell
						rowId={row.original.id}
						rowNumber={rowNumber}
						checked={checked}
						isHovered={isHovered}
						showCheckboxes={showCheckboxes}
						onToggle={onToggle}
					/>
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
				header: () => <ColumnHeaderLabel col={col} />,
				cell: ({ getValue, row }: CellContext<TableData, unknown>) => {
					const cells = getValue() as Cell | undefined;
					const value = resolveCellValue(cells);
					const cellIdentity = {
						rowId: row.original.id,
						columnId: col.id,
					};
					const isEditing =
						editingCell?.rowId === cellIdentity.rowId &&
						editingCell?.columnId === cellIdentity.columnId;
					const initialValue = isEditing
						? getInitialEditValue(cellIdentity)
						: null;
					return (
						<EditableCell
							value={value}
							cellKey={createCellKey(cellIdentity.rowId, cellIdentity.columnId)}
							isEditing={isEditing}
							type={col.type}
							onCommit={(nextValue: string, previousValue) =>
								onCommitEdit(
									cellIdentity.rowId,
									cellIdentity.columnId,
									nextValue,
									previousValue,
								)
							}
							onCancel={onCancelEdit}
							onNavigate={(direction) => onNavigate(cellIdentity, direction)}
							initialValue={initialValue ?? undefined}
							onInitialValueConsumed={onInitialValueConsumed}
						/>
					);
				},
				accessorFn: (row: TableData) => findCellInRow(row, col.id),
			})),
	];
}
