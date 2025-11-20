import { type Cell, type RowData, flexRender } from "@tanstack/react-table";
import { memo, useMemo } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "~/lib/utils";
import type { TableData } from "~/types/dataTable";
import type { GridCell } from "../../hooks/useDataTableState";

declare module "@tanstack/react-table" {
	interface ColumnMeta<TData extends RowData, TValue> {
		table?: string;
		className?: string;
	}
}

interface TableDataCellProps {
	cell: Cell<TableData, unknown>;
	cellKey: string;
	rowId: string;
	isSelectable: boolean;
	isGridActive: boolean;
	isSelected: boolean;
	isFillHighlighted: boolean;
	isMatch: boolean;
	isActiveSearchCell: boolean;
	onPointerDown: (
		event: ReactPointerEvent<HTMLTableCellElement>,
		cell: GridCell,
		isSelectable: boolean,
	) => void;
	onPointerEnter: (cell: GridCell, isSelectable: boolean) => void;
	onDoubleClick: (cell: GridCell) => void;
	onFillPointerDown: (
		event: ReactPointerEvent<HTMLSpanElement>,
		cell: GridCell,
	) => void;
}

export const TableDataCell = memo(function TableDataCell({
	cell,
	cellKey,
	rowId,
	isSelectable,
	isGridActive,
	isSelected,
	isFillHighlighted,
	isMatch,
	isActiveSearchCell,
	onPointerDown,
	onPointerEnter,
	onDoubleClick,
	onFillPointerDown,
}: TableDataCellProps) {
	const backgroundClass = isFillHighlighted
		? "bg-blue-100"
		: isSelected
			? "bg-blue-50"
			: isActiveSearchCell
				? "bg-yellow-200"
				: isMatch
					? "bg-yellow-100"
					: "";

	const gridCell: GridCell = {
		rowId,
		columnId: cell.column.id,
	};

	// Memoize the cell context to prevent unnecessary re-renders
	// Only depend on essential stable identifiers
	const cellValue = cell.getValue();
	const cellContext = useMemo(() => cell.getContext(), [
		cellKey, // More stable than cell.id
		JSON.stringify(cellValue), // Serialize to handle object values
		rowId // More stable than cell.row.original.id
	]);

	return (
		<td
			key={cell.id}
			className={cn(
				"relative w-[150px] border-gray-200 border-r border-b px-2 py-2 text-gray-900 text-sm",
				cell.column.columnDef.meta?.className,
				backgroundClass,
			)}
			data-cell={cellKey}
			onPointerDown={(event) => onPointerDown(event, gridCell, isSelectable)}
			onPointerEnter={() => onPointerEnter(gridCell, isSelectable)}
			onDoubleClick={(event) => {
				if (!isSelectable) return;
				event.stopPropagation();
				onDoubleClick(gridCell);
			}}
		>
			{isGridActive && (
				<>
					<div className="-inset-0.5 pointer-events-none absolute border-2 border-blue-500" />
					<span
						data-fill-handle
						className="absolute right-0 bottom-0 z-30 size-2 translate-x-1/2 translate-y-1/2 cursor-crosshair border border-blue-600 bg-white shadow-sm"
						onPointerDown={(event) => onFillPointerDown(event, gridCell)}
					/>
				</>
			)}
			<div className="truncate whitespace-nowrap overflow-hidden max-w-full">
				{flexRender(cell.column.columnDef.cell, cellContext)}
			</div>
		</td>
	);
});
