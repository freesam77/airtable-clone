"use client";

import { ListFilter, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import type { ColumnType } from "~/types/column";
import type { FilterCondition } from "./Filters";

type Props = {
	columns: Array<{ id: string; name: string; type: ColumnType }>;
	filters: FilterCondition[];
	onChange: (filters: FilterCondition[]) => void;
};

export function FiltersDropdown({ columns, filters, onChange }: Props) {
	const isActive = filters.length > 0;
	const activeColumns = Array.from(
		new Set(
			filters
				.map((f) => columns.find((c) => c.id === f.columnId)?.name)
				.filter((n): n is string => Boolean(n)),
		),
	);
	const activeLabel = isActive
		? `Filtered by ${activeColumns.join(", ")}`
		: "Filter";
	const addCondition = () => {
		const first = columns[0];
		if (!first) return;
		onChange([
			...filters,
			{
				id: `f-${Date.now()}`,
				columnId: first.id,
				type: first.type,
				op: first.type === "TEXT" ? "contains" : ">",
				value: "",
			},
		]);
	};

	const updateFilter = (
		id: string,
		patch: Partial<{
			columnId: string;
			type: ColumnType;
			op: FilterCondition["op"];
			value?: string;
		}>,
	) => {
		onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
	};

	const removeFilter = (id: string) => {
		onChange(filters.filter((f) => f.id !== id));
	};

	const textOps = [
		{ v: "is_empty", l: "is empty" },
		{ v: "is_not_empty", l: "is not empty" },
		{ v: "contains", l: "contains" },
		{ v: "not_contains", l: "does not contain" },
		{ v: "equals", l: "is" },
	];
	const numOps = [
		{ v: "is_empty", l: "is empty" },
		{ v: "is_not_empty", l: "is not empty" },
		{ v: ">", l: "greater than" },
		{ v: "<", l: "less than" },
		{ v: "=", l: "is" },
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"cursor-pointer gap-2 px-2",
						isActive
							? "bg-green-100 text-green-900 hover:bg-green-100"
							: "hover:bg-gray-100",
					)}
				>
					<ListFilter className={cn("size-4", isActive && "text-green-900")} />
					<span className="max-w-[320px] truncate text-xs">{activeLabel}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="bg-white p-0">
				<div className="p-4 text-xs">
					{filters.length === 0 ? (
						<div className="flex items-start justify-between text-gray-500">
							<span>No filter conditions are applied</span>
						</div>
					) : null}
					<div className="space-y-2 pb-1">
						{filters.map((f, idx) => {
							const ops = f.type === "TEXT" ? textOps : numOps;
							const needsValue = !["is_empty", "is_not_empty"].includes(f.op);
							return (
								<div key={f.id} className="flex items-center">
									{idx === 0 ? (
										<span className="min-w-[52px] text-gray-700 ">Where</span>
									) : (
										<select className="h-8 rounded-none border border-gray-300 bg-white px-2 text-gray-700 ">
											<option>and</option>
											<option>or</option>
										</select>
									)}
									<select
										className="h-8 rounded-none border border-gray-300 bg-white px-2 "
										value={f.columnId}
										onChange={(e) => {
											const nextCol = columns.find(
												(c) => c.id === e.target.value,
											)!;
											updateFilter(f.id, {
												columnId: nextCol.id,
												type: nextCol.type,
												op: nextCol.type === "TEXT" ? "contains" : ">",
												value: "",
											});
										}}
									>
										{columns.map((c) => (
											<option key={c.id} value={c.id}>
												{c.name}
											</option>
										))}
									</select>
									<select
										className="h-8 rounded-none border border-gray-300 bg-white px-2 "
										value={f.op}
										onChange={(e) =>
											updateFilter(f.id, {
												op: e.target.value as FilterCondition["op"],
											})
										}
									>
										{ops.map((o) => (
											<option key={o.v} value={o.v}>
												{o.l}
											</option>
										))}
									</select>
									{needsValue && (
										<Input
											className="h-8 min-w-40 flex-1 rounded-none border border-gray-300"
											placeholder={
												f.type === "TEXT" ? "Enter text" : "Enter number"
											}
											value={f.value ?? ""}
											onChange={(e) =>
												updateFilter(f.id, { value: e.target.value })
											}
										/>
									)}
									<button
										type="button"
										className="flex h-8 w-8 items-center justify-center border border-gray-300 text-gray-600 hover:bg-gray-50"
										onClick={() => removeFilter(f.id)}
										aria-label="Remove condition"
										title="Remove condition"
									>
										<Trash2 className="h-4 w-4" />
									</button>
									<button
										type="button"
										className="flex h-8 w-8 items-center justify-center border border-gray-300 text-gray-600 hover:bg-gray-50"
										aria-label="More options"
										title="More options"
									>
										<MoreHorizontal className="h-4 w-4" />
									</button>
								</div>
							);
						})}
					</div>
					<div className="flex items-center justify-between pt-2 text-xs">
						<div className="flex items-center gap-4">
							<button
								type="button"
								className="flex items-center gap-1 text-gray-700 hover:underline"
								onClick={addCondition}
							>
								<Plus className="h-4 w-4" /> Add condition
							</button>
							<button
								type="button"
								className="text-gray-700 opacity-60"
								disabled
							>
								+ Add condition group
							</button>
						</div>
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
