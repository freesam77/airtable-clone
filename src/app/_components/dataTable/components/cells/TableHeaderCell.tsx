import type { Header as TableHeader } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { memo, useMemo } from "react";
import { cn } from "~/lib/utils";
import type { TableData } from "~/types/dataTable";
import { ColumnHeaderMenu } from "../../ColumnHeaderMenu";

interface TableHeaderCellProps {
	header: TableHeader<TableData, unknown>;
	columnName: string;
	onRename: (id: string, newName: string) => void;
	onDuplicate: (id: string) => void;
	onDelete: (id: string) => void;
	onHide?: (id: string) => void;
	disabledRename?: boolean;
	disabledDuplicate?: boolean;
	disabledDelete?: boolean;
}

export const TableHeaderCell = memo(
	function TableHeaderCell({
		header,
		columnName,
		onRename,
		onDuplicate,
		onDelete,
		onHide,
		disabledRename,
		disabledDuplicate,
		disabledDelete,
	}: TableHeaderCellProps) {
		const headerContext = useMemo(() => header.getContext(), [header]);
		const isRowNumber = header.column.id === "row-number";

		return (
			<th
				key={header.id}
				className={cn(
					"group relative sticky top-0 z-40 border-gray-200 border-r bg-white p-2 text-left text-gray-700 text-sm transition-colors after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:border-gray-200 after:border-b after:content-[''] hover:bg-gray-50",
				)}
			>
				<div
					className={cn("flex items-center gap-2", isRowNumber && "inline")}
				>
					{header.isPlaceholder
						? null
						: flexRender(header.column.columnDef.header, headerContext)}

					{!isRowNumber && (
						<ColumnHeaderMenu
							columnId={header.column.id}
							columnName={columnName}
							onRename={onRename}
							onDuplicate={onDuplicate}
							onDelete={onDelete}
							onHide={onHide}
							disabledRename={disabledRename}
							disabledDuplicate={disabledDuplicate}
							disabledDelete={disabledDelete}
						/>
					)}
				</div>
			</th>
		);
	},
	(prevProps, nextProps) => {
		const prev = prevProps.header;
		const next = nextProps.header;
		return (
			prev.id === next.id &&
			prev.isPlaceholder === next.isPlaceholder &&
			prev.column.id === next.column.id &&
			prev.column.columnDef.meta?.className ===
				next.column.columnDef.meta?.className &&
			prevProps.disabledRename === nextProps.disabledRename &&
			prevProps.disabledDuplicate === nextProps.disabledDuplicate &&
			prevProps.onRename === nextProps.onRename &&
			prevProps.onDuplicate === nextProps.onDuplicate &&
			prevProps.onDelete === nextProps.onDelete
		);
	},
);
