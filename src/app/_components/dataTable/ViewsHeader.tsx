"use client";


import {
	ArrowUpDown,
	ChevronDown,
	ChevronUp,
	FolderTree,
	Menu,
	Palette,
	Search,
	Share2,
	Sheet,
	X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import type { FilterCondition } from "./filter/Filters";
import { FiltersDropdown } from "./filter/FiltersDropdown";
import { HiddenFieldsDropdown } from "./filter/HiddenFieldsDropdown";
import type { SortCondition } from "./filter/Sorts";
import { SortsDropdown } from "./filter/SortsDropdown";
import type { ViewUpdatePatch } from "./filter/useViewFilter";

type ViewsHeaderProps = {
	viewName: string;
	onRenameView: (name: string) => void;
	onDuplicateView: () => void;
	onDeleteView: () => void;
	canDeleteView: boolean;
	onToggleSidebar: () => void;
	searchOpen: boolean;
	setSearchOpen: (open: boolean) => void;
	// Minimal shape for the table object we use
	table: { getState: () => any; setGlobalFilter: (v: any) => void };
	matchesCount: number;
	activeMatchIndex: number;
	gotoPrevMatch: () => void;
	gotoNextMatch: () => void;
	columns: Array<{ id: string; name: string; type: "TEXT" | "NUMBER" }>;
	filters: FilterCondition[];
	sorts?: SortCondition[];
	autoSort?: boolean;
	hiddenColumnIds: string[];
	onUpdateView: (patch: ViewUpdatePatch) => void;
};

export function ViewsHeader({
	viewName,
	onRenameView,
	onDuplicateView,
	onDeleteView,
	canDeleteView,
	onToggleSidebar,
	searchOpen,
	setSearchOpen,
	table,
	matchesCount,
	activeMatchIndex,
	gotoPrevMatch,
	gotoNextMatch,
	columns,
	filters,
	sorts = [],
	autoSort = true,
	hiddenColumnIds,
	onUpdateView,
}: ViewsHeaderProps) {
	// filter UI moved to FiltersDropdown
	return (
		<div className="flex items-center justify-between border-b bg-white px-3">
			<div className="flex gap-1">
				<button
					type="button"
					onClick={onToggleSidebar}
					className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-50"
					aria-label="Toggle views sidebar"
				>
					<Menu className="size-4 cursor-pointer" />
				</button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex items-center gap-2 rounded px-2 py-1 text-gray-700 text-sm hover:bg-gray-50"
						>
							<Sheet className="size-4 text-blue-600" />
							{viewName}
							<ChevronDown className="size-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-64 bg-white p-0">
						<div className="p-2">
							<button
								type="button"
								className="w-full rounded px-2 py-2 text-left hover:bg-gray-50"
								onClick={() => {
									const name = prompt("Rename view", viewName);
									if (name?.trim()) onRenameView(name.trim());
								}}
							>
								Rename view
							</button>
							<button
								type="button"
								className="w-full rounded px-2 py-2 text-left hover:bg-gray-50"
								onClick={onDuplicateView}
							>
								Duplicate view
							</button>
						<button
							type="button"
							className="w-full rounded px-2 py-2 text-left text-red-600 hover:bg-red-50 disabled:opacity-50"
							disabled={!canDeleteView}
							onClick={() => {
								if (!canDeleteView) return;
								if (confirm(`Delete view "${viewName}"? This cannot be undone.`)) {
									onDeleteView();
								}
							}}
						>
								Delete view
							</button>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="flex items-center justify-end gap-1 p-1 text-gray-500">
				<HiddenFieldsDropdown
					columns={columns}
					hiddenColumnIds={hiddenColumnIds}
					onChange={(next) => onUpdateView({ hiddenColumnIds: next })}
				/>
				<FiltersDropdown
					columns={columns}
					filters={filters}
					onChange={(next) => onUpdateView({ filters: next })}
				/>
				<Button
					variant="ghost"
					size="sm"
					className="cursor-pointer gap-2 px-2 hover:bg-gray-100"
				>
					<FolderTree className="size-4" />
					<span className="text-sm">Group</span>
				</Button>
				<SortsDropdown
					columns={columns}
					sorts={sorts}
					autoSort={autoSort}
					onChange={(next) => onUpdateView({ sorts: next })}
					onAutoSortChange={(value) => onUpdateView({ autoSort: value })}
				/>
				<Button
					variant="ghost"
					size="sm"
					className="cursor-pointer gap-2 px-2 hover:bg-gray-100"
				>
					<Palette className="size-4" />
					<span className="text-sm">Color</span>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="cursor-pointer gap-2 px-2 hover:bg-gray-100"
				>
					<Share2 className="size-4" />
					<span className="text-sm">Share and sync</span>
				</Button>
				<DropdownMenu open={searchOpen} onOpenChange={setSearchOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="cursor-pointer">
							<Search />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-full bg-white">
						<div className="flex items-center gap-3">
							<Input
								id="table-search"
								type="text"
								value={String(table.getState().globalFilter ?? "")}
								onChange={(e) => table.setGlobalFilter(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === "NumpadEnter") {
										e.preventDefault();
										e.stopPropagation();
										if (e.shiftKey) gotoPrevMatch();
										else gotoNextMatch();
									}
								}}
								placeholder="Find in view"
								autoFocus
							/>
							<div className="min-w-20 text-center text-gray-500 text-xs">
								{matchesCount > 0 &&
									`${activeMatchIndex + 1} / ${matchesCount}`}
							</div>
							<div className="flex gap-1">
								<Button
									variant="outline"
									size="icon"
									onClick={gotoPrevMatch}
									disabled={matchesCount === 0}
									aria-label="Previous match"
								>
									<ChevronUp className="size-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									onClick={gotoNextMatch}
									disabled={matchesCount === 0}
									aria-label="Next match"
								>
									<ChevronDown className="size-4" />
								</Button>
							</div>
							<Button
								variant="ghost"
								className="cursor-pointer"
								onClick={() => setSearchOpen(false)}
							>
								<X />
							</Button>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
