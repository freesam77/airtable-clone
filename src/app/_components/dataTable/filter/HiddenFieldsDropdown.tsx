"use client";

import { EyeOff, GripVertical, HelpCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import type { ColumnType } from "~/types/column";

type Column = { id: string; name: string; type: ColumnType };

type Props = {
	columns: Column[];
	hiddenColumnIds: string[];
	onChange: (hiddenIds: string[]) => void;
};

const columnTypeSymbol = (type: ColumnType) => (type === "TEXT" ? "A" : "#");

export function HiddenFieldsDropdown({
	columns,
	hiddenColumnIds,
	onChange,
}: Props) {
	const [query, setQuery] = useState("");
	const hiddenCount = hiddenColumnIds.length;
	const hiddenSet = useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);
	const isActive = hiddenCount > 0;
	const buttonLabel = isActive
		? `${hiddenCount} hidden field${hiddenCount > 1 ? "s" : ""}`
		: "Hide fields";

	const filteredColumns = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return columns;
		return columns.filter((col) => col.name.toLowerCase().includes(normalized));
	}, [columns, query]);

	const toggleColumn = (columnId: string) => {
		onChange(
			hiddenColumnIds.includes(columnId)
				? hiddenColumnIds.filter((id) => id !== columnId)
				: [...hiddenColumnIds, columnId],
		);
	};

	const hideAll = () => onChange(columns.map((c) => c.id));
	const showAll = () => onChange([]);

	const disableHideAll = columns.length === 0 || hiddenCount === columns.length;
	const disableShowAll = columns.length === 0 || hiddenCount === 0;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"cursor-pointer gap-2 px-2",
						isActive
							? "bg-blue-100 text-blue-900 hover:bg-blue-100"
							: "hover:bg-gray-100",
					)}
					aria-pressed={isActive}
				>
					<EyeOff className="size-4" />
					<span className="text-sm">{buttonLabel}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[320px] bg-white p-0 text-sm"
			>
				<div className="p-3">
					<div className="relative mb-3">
						<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 size-4 text-gray-400" />
						<Input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Find a field"
							className="h-9 w-full rounded-md bg-gray-50 pr-10 pl-8 text-sm"
						/>
						<HelpCircle className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 size-4 text-gray-400" />
					</div>
					<div className="max-h-64 space-y-1 overflow-auto">
						{filteredColumns.length === 0 ? (
							<div className="py-6 text-center text-gray-500 text-xs">
								No fields found
							</div>
						) : (
							filteredColumns.map((col) => {
								const isHidden = hiddenSet.has(col.id);
								return (
									<div
										key={col.id}
										className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-50"
									>
										<Switch
											checked={!isHidden}
											onCheckedChange={() => toggleColumn(col.id)}
											aria-label={isHidden ? "Show field" : "Hide field"}
											className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
										/>
										<span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-gray-200 bg-gray-50 font-semibold text-gray-600 text-xs">
											{columnTypeSymbol(col.type)}
										</span>
										<span
											className={cn(
												"flex-1 truncate",
												isHidden ? "text-gray-400" : "text-gray-800",
											)}
										>
											{col.name}
										</span>
										<GripVertical className="size-4 text-gray-300" />
									</div>
								);
							})
						)}
					</div>
				</div>
				<div className="flex gap-2 border-t px-3 pt-2 pb-3">
					<button
						type="button"
						onClick={hideAll}
						disabled={disableHideAll}
						className="flex-1 rounded border border-gray-200 bg-gray-100 py-2 text-center text-gray-700 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Hide all
					</button>
					<button
						type="button"
						onClick={showAll}
						disabled={disableShowAll}
						className="flex-1 rounded border border-gray-200 bg-gray-100 py-2 text-center text-gray-700 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Show all
					</button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
