"use client";

import {
	ArrowDownUp,
	ChevronDown,
	Plus,
	Search,
	X,
	HelpCircle,
} from "lucide-react";
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
import type { SortCondition } from "../../filter/Sorts";

type Props = {
	columns: Array<{ id: string; name: string; type: ColumnType }>;
	sorts: SortCondition[];
	onChange: (sorts: SortCondition[]) => void;
	autoSort: boolean;
	onAutoSortChange: (value: boolean) => void;
};

// Field icon component that matches the HiddenFieldsDropdown style
function FieldIcon({ type }: { type: ColumnType }) {
	const symbol = type === "TEXT" ? "A" : "#";
	
	return (
		<span className="flex size-4 items-center justify-center rounded-full border border-gray-200 bg-gray-50 font-semibold text-gray-600">
			{symbol}
		</span>
	);
}


// Reusable header component - just shows "Sort by" title
function SortHeader() {
	return (
		<div className="gap-1 px-3">
			<div className="flex items-center border-gray-200 border-b py-3">
				<div className="text-gray-900 text-xs">Sort by</div>
				<HelpCircle className="size-4 text-gray-400" />
			</div>
		</div>
	);
}

// Reusable field list component
function FieldList({
	filteredColumns,
	onFieldClick,
	sortsSet,
	showSearch = true,
}: {
	filteredColumns: Array<{ id: string; name: string; type: ColumnType }>;
	onFieldClick: (columnId: string, type: ColumnType) => void;
	sortsSet: Set<string>;
	showSearch?: boolean;
}) {
	return (
		<div className="max-h-60 space-y-1 overflow-y-auto">
			{filteredColumns.length === 0 ? (
				<div className="py-6 text-center text-gray-500 text-xs">
					No fields found
				</div>
			) : (
				filteredColumns.map((col) => {
					const isSorted = sortsSet.has(col.id);
					return (
						<button
							key={col.id}
							type="button"
							className="flex w-full items-center gap-2 py-2 text-xs hover:bg-gray-50"
							onClick={() => {
								if (!isSorted || !showSearch) {
									onFieldClick(col.id, col.type);
								}
							}}
							disabled={showSearch && isSorted}
						>
							<FieldIcon type={col.type} />
							<span
								className={cn(
									"flex-1 truncate text-left text-xs",
									showSearch && isSorted && "text-gray-400",
								)}
							>
								{col.name}
							</span>
						</button>
					);
				})
			)}
		</div>
	);
}

// Reusable search input component
function SearchInput({
	query,
	setQuery,
	showSearchIcon = true,
}: {
	query: string;
	setQuery: (query: string) => void;
	showSearchIcon?: boolean;
}) {
	return (
		<div className="relative mb-3 flex items-center border-gray-200">
			{showSearchIcon && <Search className="mr-2 size-4 text-gray-400" />}
			<Input
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Find a field"
				className="h-auto w-full border-0 px-0 py-1 text-xs! shadow-none focus-visible:ring-0"
			/>
		</div>
	);
}

export function SortsDropdown({
	columns,
	sorts,
	autoSort,
	onChange,
	onAutoSortChange,
}: Props) {
	const [query, setQuery] = useState("");
	const [selectedSort, setSelectedSort] = useState<SortCondition | null>(null);
	const [showAddSortList, setShowAddSortList] = useState(false);

	const isActive = sorts.length > 0;
	const label = isActive
		? `Sorted by ${sorts.length} field${sorts.length > 1 ? "s" : ""}`
		: "Sort";

	const sortsSet = useMemo(
		() => new Set(sorts.map((s) => s.columnId)),
		[sorts],
	);

	const filteredColumns = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return columns;
		return columns.filter((col) => col.name.toLowerCase().includes(normalized));
	}, [columns, query]);

	const addSort = (columnId: string, type: ColumnType) => {
		const newSort: SortCondition = {
			id: `s-${Date.now()}`,
			columnId,
			type,
			dir: "asc",
		};
		onChange([...sorts, newSort]);
		setShowAddSortList(false);
		setQuery("");
	};

	const updateSort = (
		id: string,
		patch: Partial<{
			columnId: string;
			type: ColumnType;
			dir: "asc" | "desc";
		}>,
	) => {
		const updatedSorts = sorts.map((s) =>
			s.id === id ? { ...s, ...patch } : s,
		);
		onChange(updatedSorts);
		if (selectedSort?.id === id) {
			setSelectedSort({ ...selectedSort, ...patch });
		}
	};

	const removeSort = (id: string) => {
		const newSorts = sorts.filter((s) => s.id !== id);
		onChange(newSorts);

		// If we removed the currently selected sort or removed all sorts, clear selection
		if (selectedSort?.id === id || newSorts.length === 0) {
			setSelectedSort(null);
		}

		// If we removed all sorts, also reset the add sort list state
		if (newSorts.length === 0) {
			setShowAddSortList(false);
		}
	};

	const getDirectionLabel = (dir: "asc" | "desc", type: ColumnType) => {
		if (type === "TEXT") {
			return dir === "asc" ? "A → Z" : "Z → A";
		}
		return dir === "asc" ? "1 → 9" : "9 → 1";
	};

	// Three states:
	// 1. Initial field list (when no sorts exist)
	// 2. Sort configuration view (when editing a sort)
	// 3. Add another sort field list (when adding to existing sorts)
	const showInitialFieldList =
		sorts.length === 0 && !selectedSort && !showAddSortList;
	const showSortConfig = selectedSort !== null;
	const showAddFieldList = showAddSortList;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"cursor-pointer gap-1 rounded-sm px-2",
						isActive
							? "bg-orange-100 text-gray-700 hover:bg-orange-100"
							: "hover:bg-gray-100",
					)}
				>
					<ArrowDownUp
						className={cn("size-4", isActive && "text-gray-700")}
					/>
					<span className="max-w-[320px] truncate text-xs">{label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[320px] bg-white p-0 text-xs"
			>
				{/* State 1: Initial field list (no sorts exist) */}
				{showInitialFieldList && (
					<div>
						<SortHeader />
						<div className="p-3">
							<SearchInput
								query={query}
								setQuery={setQuery}
								showSearchIcon={true}
							/>
							<FieldList
								filteredColumns={filteredColumns}
								onFieldClick={addSort}
								sortsSet={sortsSet}
								showSearch={false}
							/>
						</div>
					</div>
				)}

				{/* State 2: Add another sort field list (no search icon) */}
				{showAddFieldList && (
					<div>
						<SortHeader />
						<div className="p-3">
							<SearchInput
								query={query}
								setQuery={setQuery}
								showSearchIcon={false}
							/>
							<FieldList
								filteredColumns={filteredColumns}
								onFieldClick={addSort}
								sortsSet={sortsSet}
								showSearch={true}
							/>
						</div>
					</div>
				)}

				{/* State 3: Sort configuration view */}
				{showSortConfig && (
					<div>
						<SortHeader />
						<div className="p-3">
							{selectedSort && (
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<FieldIcon type={selectedSort.type} />
										<span className="text-xs font-medium">
											{
												columns.find((c) => c.id === selectedSort.columnId)
													?.name
											}
										</span>
									</div>

									<div className="space-y-2">
										<div className="grid grid-cols-2 gap-2">
											<button
												type="button"
												className={cn(
													"border px-2 py-2 text-xs",
													selectedSort.dir === "asc"
														? "border-blue-500 bg-blue-50 text-blue-700"
														: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
												)}
												onClick={() =>
													updateSort(selectedSort.id, { dir: "asc" })
												}
											>
												{getDirectionLabel("asc", selectedSort.type)}
											</button>
											<button
												type="button"
												className={cn(
													"border px-2 py-2 text-xs",
													selectedSort.dir === "desc"
														? "border-blue-500 bg-blue-50 text-blue-700"
														: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
												)}
												onClick={() =>
													updateSort(selectedSort.id, { dir: "desc" })
												}
											>
												{getDirectionLabel("desc", selectedSort.type)}
											</button>
										</div>
									</div>

									<div className="flex items-center justify-between pt-1">
										<span className="text-gray-700 text-xs font-medium">
											Automatically sort records
										</span>
										<Switch
											checked={autoSort}
											onCheckedChange={(checked) => onAutoSortChange(checked)}
											aria-label="Toggle automatic sort"
											className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{/* State 4: Main sort management view (when sorts exist but no specific config open) */}
				{sorts.length > 0 && !showSortConfig && !showAddFieldList && (
					<div>
						<SortHeader />
						<div className="p-3 space-y-3">
							{sorts.map((sort) => {
								const column = columns.find((c) => c.id === sort.columnId);
								if (!column) return null;

								return (
									<div key={sort.id} className="flex items-center gap-2">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="outline"
													className="h-8 flex-1 justify-between px-2 text-xs font-normal"
												>
													<div className="flex items-center gap-2">
														<FieldIcon type={column.type} />
														<span className="truncate">{column.name}</span>
													</div>
													<ChevronDown className="h-3 w-3 text-gray-500" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent className="w-48">
												{columns.map((col) => (
													<button
														key={col.id}
														className="flex w-full items-center gap-2 px-2 py-1 text-xs hover:bg-gray-50"
														onClick={() =>
															updateSort(sort.id, {
																columnId: col.id,
																type: col.type,
															})
														}
													>
														<FieldIcon type={col.type} />
														<span className="truncate">{col.name}</span>
													</button>
												))}
											</DropdownMenuContent>
										</DropdownMenu>

										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="outline"
													className="h-8 flex-1 justify-between px-2 text-xs font-normal"
												>
													<span>{getDirectionLabel(sort.dir, sort.type)}</span>
													<ChevronDown className="h-3 w-3 text-gray-500" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent className="w-24">
												<button
													className="flex w-full px-2 py-1 text-xs hover:bg-gray-50"
													onClick={() => updateSort(sort.id, { dir: "asc" })}
												>
													{getDirectionLabel("asc", sort.type)}
												</button>
												<button
													className="flex w-full px-2 py-1 text-xs hover:bg-gray-50"
													onClick={() => updateSort(sort.id, { dir: "desc" })}
												>
													{getDirectionLabel("desc", sort.type)}
												</button>
											</DropdownMenuContent>
										</DropdownMenu>

										<button
											type="button"
											className="flex h-8 w-8 items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600"
											onClick={() => removeSort(sort.id)}
										>
											<X className="h-3 w-3" />
										</button>
									</div>
								);
							})}

							<button
								type="button"
								className="flex w-full items-center gap-2 py-2 text-blue-600 hover:text-blue-700 text-xs"
								onClick={() => setShowAddSortList(true)}
							>
								<Plus className="h-4 w-4" />
								Add another sort
							</button>

							<div className="flex items-center justify-between pt-2">
								<span className="text-gray-700 text-xs font-medium">
									Automatically sort records
								</span>
								<Switch
									checked={autoSort}
									onCheckedChange={(checked) => onAutoSortChange(checked)}
									aria-label="Toggle automatic sort"
									className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
								/>
							</div>
						</div>
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
