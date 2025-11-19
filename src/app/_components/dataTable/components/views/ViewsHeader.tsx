"use client";

import {
	ChevronDown,
	ExternalLink,
	List,
	Menu,
	PaintBucket,
	Sheet,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { ColumnType } from "~/types/column";
import type { FilterCondition } from "../../components/filters/Filters";
import type { SortCondition } from "../../components/filters/Sorts";
import type { ViewUpdatePatch } from "../../hooks/useViewFilter";
import { FiltersDropdown } from "../filters/FiltersDropdown";
import { HiddenFieldsDropdown } from "../filters/HiddenFieldsDropdown";
import { SortsDropdown } from "../filters/SortsDropdown";
import { SearchMenu } from "../toolbar/SearchMenu";

type ViewsHeaderProps = {
	viewName: string;
	onRenameView: (name: string) => void;
	onDuplicateView: () => void;
	onDeleteView: () => void;
	canDeleteView: boolean;
	onToggleSidebar: () => void;
	searchOpen: boolean;
	setSearchOpen: (open: boolean) => void;
	searchValue: string;
	onSearchValueChange: (value: string) => void;
	matchesCount: number;
	activeMatchIndex: number;
	gotoPrevMatch: () => void;
	gotoNextMatch: () => void;
	columns: Array<{ id: string; name: string; type: ColumnType }>;
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
	searchValue,
	onSearchValueChange,
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
		<div className="flex items-center justify-between bg-white px-3">
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
							className="flex items-center gap-2 rounded px-2 py-1 font-semibold text-gray-700 text-xs hover:bg-gray-50"
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
									if (
										confirm(`Delete view "${viewName}"? This cannot be undone.`)
									) {
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
					<List className="size-4" />
					<span className="text-xs">Group</span>
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
					<PaintBucket className="size-4" />
					<span className="text-xs">Color</span>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="cursor-pointer gap-2 px-2 hover:bg-gray-100"
				>
					<ExternalLink className="size-4" />
					<span className="text-xs">Share and sync</span>
				</Button>
				<SearchMenu
					open={searchOpen}
					onOpenChange={setSearchOpen}
					value={searchValue}
					onValueChange={onSearchValueChange}
					matchesCount={matchesCount}
					activeMatchIndex={activeMatchIndex}
					gotoPrevMatch={gotoPrevMatch}
					gotoNextMatch={gotoNextMatch}
				/>
			</div>
		</div>
	);
}
