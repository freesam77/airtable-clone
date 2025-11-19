import { memo, useMemo } from "react";
import type { Header as TableHeader } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { cn } from "~/lib/utils";
import type { TableData } from "~/types/dataTable";
import { ColumnHeaderMenu } from "../../ColumnHeaderMenu";

interface TableHeaderCellProps {
	header: TableHeader<TableData, unknown>;
	onRename: (id: string) => void;
	onDuplicate: (id: string) => void;
	onDelete: (id: string) => void;
	disabledRename?: boolean;
	disabledDuplicate?: boolean;
}

export const TableHeaderCell = memo(
	function TableHeaderCell({
		header,
		onRename,
		onDuplicate,
		onDelete,
		disabledRename,
		disabledDuplicate,
	}: TableHeaderCellProps) {
		const headerContext = useMemo(() => header.getContext(), [header]);
		const isRowNumber = header.column.id === "row-number";

		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<th
						key={header.id}
						className={cn(
							"group relative sticky top-0 z-40 border-gray-200 border-r bg-white p-2 text-left text-gray-700 text-sm transition-colors after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:border-gray-200 after:border-b after:content-[''] hover:bg-gray-50",
						)}
					>
						<div
							className={cn(
								"flex items-center gap-2",
								isRowNumber && "inline",
							)}
						>
							{header.isPlaceholder
								? null
								: flexRender(header.column.columnDef.header, headerContext)}

							{!isRowNumber && (
								<ColumnHeaderMenu
									columnId={header.column.id}
									onRename={onRename}
									onDuplicate={onDuplicate}
									onDelete={onDelete}
									disabledRename={disabledRename}
									disabledDuplicate={disabledDuplicate}
								/>
							)}
						</div>
					</th>
				</ContextMenuTrigger>
				{!header.isPlaceholder && !isRowNumber && (
					<ContextMenuContent className="w-64 bg-white p-0">
						<div className="p-2">
							<ContextMenuItem
								onClick={() => onRename(header.column.id)}
								className="w-full rounded px-2 py-2 text-left hover:bg-gray-50"
							>
								Rename column
							</ContextMenuItem>
							<ContextMenuItem
								onClick={() => onDuplicate(header.column.id)}
								className="w-full rounded px-2 py-2 text-left hover:bg-gray-50"
							>
								Duplicate column
							</ContextMenuItem>
							<ContextMenuItem
								onClick={() => onDelete(header.column.id)}
								className="w-full rounded px-2 py-2 text-left text-red-600 hover:bg-red-50"
							>
								Delete column
							</ContextMenuItem>
						</div>
					</ContextMenuContent>
				)}
			</ContextMenu>
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