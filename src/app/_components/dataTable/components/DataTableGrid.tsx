import {
	type Header as TableHeader,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { cn } from "~/lib/utils";
import { rowMatchesQuery } from "~/lib/tableFilter";
import type { ColumnMeta, TableData } from "~/types/dataTable";
import type { GridCell } from "../hooks/useDataTableState";
import { ColumnHeaderMenu } from "../ColumnHeaderMenu";
import { ROW_HEIGHT } from "../utils/constants";

interface DataTableGridProps {
	columnDefs: any[];
	rowsWithOptimistic: TableData[];
	searchValue: string;
	orderedColumns: ColumnMeta[];
	selectedCellKeys: Set<string>;
	fillPreviewKeys: Set<string>;
	activeCellKey: string | null;
	hasRangeSelection: boolean;
	hoveredRowId: string | null;
	showCheckboxes: boolean;
	matchKeys: Set<string>;
	activeMatch: any;
	scrollParentRef: React.RefObject<HTMLDivElement | null>;
	onCellPointerDown: (
		event: any,
		cell: GridCell,
		isSelectable: boolean,
	) => void;
	onCellPointerEnter: (cell: GridCell, isSelectable: boolean) => void;
	onDoubleClick: (cell: GridCell) => void;
	onFillPointerDown: (event: any, cell: GridCell) => void;
	onKeyDown: (event: any) => void;
	onMouseDown: () => void;
	onRowMouseEnter: (rowId: string) => void;
	onRowMouseLeave: () => void;
	onDeleteRows: (rowId: string) => Promise<void>;
	onRenameColumn: (id: string) => void;
	onDuplicateColumn: (id: string) => void;
	onDeleteColumn: (id: string) => void;
	columnIndexLookup: Map<string, number>;
	renameColumnMutation: any;
	duplicateColumnMutation: any;
}

const MemoHeaderContent = memo(
	function MemoHeaderContent({
		header,
		onRename,
		onDuplicate,
		onDelete,
		disabledRename,
		disabledDuplicate,
	}: {
		header: TableHeader<TableData, unknown>;
		onRename: (id: string) => void;
		onDuplicate: (id: string) => void;
		onDelete: (id: string) => void;
		disabledRename?: boolean;
		disabledDuplicate?: boolean;
	}) {
		const headerContext = header.getContext();

		return (
			<th
				key={header.id}
				className={cn(
					"group relative sticky top-0 z-40 border-gray-200 border-r bg-white p-2 text-left text-gray-700 text-sm transition-colors after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:border-gray-200 after:border-b after:content-[''] hover:bg-gray-50",
				)}
			>
				<div
					className={cn(
						"flex items-center gap-2",
						header.column.id === "row-number" && "inline",
					)}
				>
					{header.isPlaceholder
						? null
						: flexRender(header.column.columnDef.header, headerContext)}

					{header.column.id !== "row-number" && (
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


export const DataTableGrid = memo(function DataTableGrid({
	columnDefs,
	rowsWithOptimistic,
	searchValue,
	orderedColumns,
	selectedCellKeys,
	fillPreviewKeys,
	activeCellKey,
	hasRangeSelection,
	hoveredRowId,
	showCheckboxes,
	matchKeys,
	activeMatch,
	scrollParentRef,
	onCellPointerDown,
	onCellPointerEnter,
	onDoubleClick,
	onFillPointerDown,
	onKeyDown,
	onMouseDown,
	onRowMouseEnter,
	onRowMouseLeave,
	onDeleteRows,
	onRenameColumn,
	onDuplicateColumn,
	onDeleteColumn,
	columnIndexLookup,
	renameColumnMutation,
	duplicateColumnMutation,
}: DataTableGridProps) {
	const table = useReactTable<TableData>({
		data: rowsWithOptimistic,
		columns: columnDefs,
		getCoreRowModel: getCoreRowModel(),
		state: { globalFilter: searchValue },
		globalFilterFn: (row, _columnId, filterValue) =>
			rowMatchesQuery(row.original, orderedColumns, String(filterValue ?? "")),
		enableColumnPinning: true,
		initialState: {
			columnPinning: {
				left: ["row-number"],
			},
		},
	});

	const filteredRowsCount = rowsWithOptimistic.length;

	const rowVirtualizer = useVirtualizer({
		count: filteredRowsCount,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 10,
		getItemKey: (index) => {
			const row = rowsWithOptimistic[index];
			return `${row?.id ?? `loader-${index}`}-${
				showCheckboxes ? "checkbox" : "row-number"
			}`;
		},
	});

	return (
		<div
			className="relative flex min-h-0 flex-1 overflow-x-auto overflow-y-auto border-gray-200 bg-white outline-none"
			ref={scrollParentRef}
			onKeyDown={onKeyDown}
			onMouseDown={onMouseDown}
		>
			<table
				className="table-fixed border-separate border-spacing-0 self-start"
				key={`table-${columnDefs.length}`}
			>
				<colgroup>
					{table.getVisibleLeafColumns?.().map((col) => (
						<col
							key={col.id}
							className={cn("w-[150px]", col.columnDef.meta?.className)}
						/>
					))}
				</colgroup>
				<thead className="sticky top-0 z-30 border-gray-300 border-b bg-white">
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map((header) => {
								const isRowNumber = header.column.id === "row-number";
								return (
									<ContextMenu key={header.id}>
										<ContextMenuTrigger asChild>
											<MemoHeaderContent
												header={header}
												onRename={onRenameColumn}
												onDuplicate={onDuplicateColumn}
												onDelete={onDeleteColumn}
												disabledRename={renameColumnMutation.isPending}
												disabledDuplicate={duplicateColumnMutation.isPending}
											/>
										</ContextMenuTrigger>
										{!header.isPlaceholder && !isRowNumber && (
											<ContextMenuContent className="w-64 bg-white p-0">
												<div className="p-2">
													<ContextMenuItem
														onClick={() => onRenameColumn(header.column.id)}
														className="w-full rounded px-2 py-2 text-left hover:bg-gray-50"
													>
														Rename column
													</ContextMenuItem>
													<ContextMenuItem
														onClick={() => onDuplicateColumn(header.column.id)}
														className="w-full rounded px-2 py-2 text-left hover:bg-gray-50"
													>
														Duplicate column
													</ContextMenuItem>
													<ContextMenuItem
														onClick={() => onDeleteColumn(header.column.id)}
														className="w-full rounded px-2 py-2 text-left text-red-600 hover:bg-red-50"
													>
														Delete column
													</ContextMenuItem>
												</div>
											</ContextMenuContent>
										)}
									</ContextMenu>
								);
							})}
						</tr>
					))}
				</thead>
				<tbody>
					{(() => {
						const virtualItems = rowVirtualizer.getVirtualItems();
						const paddingTop = virtualItems.length ? virtualItems[0]!.start : 0;
						const paddingBottom = virtualItems.length
							? rowVirtualizer.getTotalSize() -
								virtualItems[virtualItems.length - 1]!.end
							: 0;
						const visibleColCount =
							(table.getVisibleLeafColumns() as any)?.length ?? 0;
						return (
							<>
								{paddingTop > 0 && (
									<tr>
										<td
											colSpan={visibleColCount}
											style={{ height: paddingTop }}
											className="border-0 p-0"
										/>
									</tr>
								)}
								{virtualItems.map((vItem) => {
									const row = table.getRowModel().rows[vItem.index];
									return (
										<ContextMenu key={vItem.key}>
											<ContextMenuTrigger asChild>
												<tr
													data-index={vItem.index}
													className={cn(
														"cursor-default transition-colors",
														hoveredRowId === row?.original.id && "bg-gray-50",
													)}
													style={{ height: ROW_HEIGHT }}
													onMouseEnter={() => {
														if (row?.original.id) {
															onRowMouseEnter(row.original.id);
														}
													}}
													onMouseLeave={onRowMouseLeave}
												>
													{row?.getVisibleCells().map((cell) => {
														const key = `${row?.original.id}|${cell.column.id}`;
														const isMatch =
															Boolean(searchValue) && matchKeys.has(key);
														const isActiveSearchCell =
															Boolean(activeMatch) &&
															activeMatch?.rowId === row?.original.id &&
															activeMatch?.columnId === cell.column.id;
														const rowId = row?.original.id;
														const isSelectableCell =
															Boolean(rowId) &&
															columnIndexLookup.has(cell.column.id);
														const isGridActive =
															isSelectableCell && activeCellKey === key;
														const isSelected =
															isSelectableCell && selectedCellKeys.has(key);
														const isFillHighlighted =
															isSelectableCell && fillPreviewKeys.has(key);
														const backgroundClass = isFillHighlighted
															? "bg-blue-100"
															: hasRangeSelection && isSelected
																? "bg-blue-50"
																: isActiveSearchCell
																	? "bg-yellow-200"
																	: isMatch
																		? "bg-yellow-100"
																		: "";
														return (
															<td
																key={cell.id}
																className={cn(
																	"relative w-[150px] border-gray-200 border-r border-b px-2 text-gray-900 text-sm leading-none",
																	cell.column.columnDef.meta?.className,
																	backgroundClass,
																)}
																data-cell={key}
																onPointerDown={(event) => {
																	if (!rowId) return;
																	onCellPointerDown(
																		event,
																		{
																			rowId,
																			columnId: cell.column.id,
																		},
																		isSelectableCell,
																	);
																}}
																onPointerEnter={() => {
																	if (!rowId) return;
																	onCellPointerEnter(
																		{
																			rowId,
																			columnId: cell.column.id,
																		},
																		isSelectableCell,
																	);
																}}
																onDoubleClick={(event) => {
																	if (!rowId || !isSelectableCell) return;
																	event.stopPropagation();
																	onDoubleClick({
																		rowId,
																		columnId: cell.column.id,
																	});
																}}
															>
																{isGridActive && (
																	<>
																		<div className="-inset-0.5 pointer-events-none absolute border-2 border-blue-500" />
																		<span
																			data-fill-handle
																			className="absolute right-0 bottom-0 z-30 size-2 translate-x-1/2 translate-y-1/2 cursor-crosshair border border-blue-600 bg-white shadow-sm"
																			onPointerDown={(event) => {
																				if (!rowId) return;
																				onFillPointerDown(event, {
																					rowId,
																					columnId: cell.column.id,
																				});
																			}}
																		/>
																	</>
																)}
																{flexRender(
																	cell.column.columnDef.cell,
																	cell.getContext(),
																)}
															</td>
														);
													})}
												</tr>
											</ContextMenuTrigger>

											{row && (
												<ContextMenuContent className="w-48">
													<ContextMenuItem
														onClick={() => onDeleteRows(row?.original.id)}
														className="text-red-600 focus:bg-red-50 focus:text-red-600"
													>
														Delete row
													</ContextMenuItem>
												</ContextMenuContent>
											)}
										</ContextMenu>
									);
								})}
								{paddingBottom > 0 && (
									<tr>
										<td
											colSpan={visibleColCount}
											style={{ height: paddingBottom }}
											className="border-0 p-0"
										/>
									</tr>
								)}
							</>
						);
					})()}
				</tbody>
			</table>
		</div>
	);
});

