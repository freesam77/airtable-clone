"use client";

import { ArrowUpDown, ChevronDown, GripVertical, Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import type { ColumnType } from "~/types/column";
import type { SortCondition } from "./Sorts";

type Props = {
	columns: Array<{ id: string; name: string; type: ColumnType }>;
	sorts: SortCondition[];
	onChange: (sorts: SortCondition[]) => void;
	autoSort: boolean;
	onAutoSortChange: (value: boolean) => void;
};

export function SortsDropdown({
	columns,
	sorts,
	autoSort,
	onChange,
	onAutoSortChange,
}: Props) {
	const isActive = sorts.length > 0;
	const label = isActive
		? `Sorted by ${sorts.length} field${sorts.length > 1 ? "s" : ""}`
		: "Sort";

	const addSort = () => {
		const first = columns[0];
		if (!first) return;
		onChange([
			...sorts,
			{
				id: `s-${Date.now()}`,
				columnId: first.id,
				type: first.type,
				dir: "asc",
			},
		]);
	};

	const updateSort = (
		id: string,
		patch: Partial<{
			columnId: string;
			type: ColumnType;
			dir: "asc" | "desc";
		}>,
	) => {
		onChange(sorts.map((s) => (s.id === id ? { ...s, ...patch } : s)));
	};

	const removeSort = (id: string) => {
		onChange(sorts.filter((s) => s.id !== id));
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"cursor-pointer gap-2 px-2",
						isActive
							? "bg-orange-100 text-orange-900 hover:bg-orange-100"
							: "hover:bg-gray-100",
					)}
				>
					<ArrowUpDown
						className={cn("size-4", isActive && "text-orange-900")}
					/>
					<span className="max-w-[320px] truncate text-sm">{label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[560px] bg-white p-0">
				<div className="p-4">
					<div className="pb-2 font-medium text-gray-900 text-sm">Sort by</div>
					{sorts.length === 0 ? (
						<div className="flex items-start justify-between text-gray-500 text-sm">
							<span>No sorts are applied</span>
						</div>
					) : null}

					<div className="space-y-2 py-2">
						{sorts.map((s) => (
							<div key={s.id} className="flex items-center gap-3">
								<div className="relative flex-1">
									<select
										className="h-8 w-full appearance-none rounded-none border border-gray-300 bg-white px-2 pr-8 text-sm"
										value={s.columnId}
										onChange={(e) => {
											const nextCol = columns.find(
												(c) => c.id === e.target.value,
											)!;
											updateSort(s.id, {
												columnId: nextCol.id,
												type: nextCol.type,
											});
										}}
									>
										{columns.map((c) => (
											<option key={c.id} value={c.id}>
												{c.name}
											</option>
										))}
									</select>
									<ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 size-4 text-gray-500" />
								</div>
								<div className="relative flex-1">
									<select
										className="h-8 w-full appearance-none rounded-none border border-gray-300 bg-white px-2 pr-8 text-sm"
										value={s.dir}
										onChange={(e) =>
											updateSort(s.id, {
												dir: e.target.value as "asc" | "desc",
											})
										}
									>
										<option value="asc">
											{s.type === "TEXT" ? "A → Z" : "1 → 9"}
										</option>
										<option value="desc">
											{s.type === "TEXT" ? "Z → A" : "9 → 1"}
										</option>
									</select>
									<ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 size-4 text-gray-500" />
								</div>
								<button
									type="button"
									className="flex h-8 w-8 items-center justify-center p-2 text-gray-600 hover:bg-gray-50"
									onClick={() => removeSort(s.id)}
									aria-label="Remove sort"
									title="Remove sort"
								>
									<X className="h-4 w-4" />
								</button>
								{sorts.length > 1 && (
									<button
										type="button"
										className="flex h-8 w-8 items-center justify-center p-2 text-gray-600 hover:bg-gray-50"
										aria-label="More options"
										title="More options"
									>
										<GripVertical className="h-4 w-4" />
									</button>
								)}
							</div>
						))}
					</div>

					<div className="flex items-center justify-between pt-2 text-sm">
						<div className="flex items-center gap-4">
							<button
								type="button"
								className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
								onClick={addSort}
							>
								<Plus className="h-4 w-4" /> Add another sort
							</button>
						</div>
					</div>

					<div className="mt-4 flex items-center gap-2">
						<Switch
							checked={autoSort}
							onCheckedChange={(checked) => onAutoSortChange(checked)}
							aria-label="Toggle automatic sort"
							className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
						/>
						<span className="text-gray-700 text-sm">
							Automatically sort records
						</span>
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
