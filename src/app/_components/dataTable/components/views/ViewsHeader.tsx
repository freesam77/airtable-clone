"use client";

import {
	ChevronDown,
	Download,
	Edit3,
	EyeOff,
	ExternalLink,
	List,
	Menu,
	Copy,
	Settings,
	FileText,
	Shield,
	Trash2,
	PaintBucket,
	Sheet,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
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
	const [isRenaming, setIsRenaming] = useState(false);
	const [editValue, setEditValue] = useState(viewName);
	const [open, setOpen] = useState(false);

	const handleRenameTable = () => {
		setIsRenaming(true);
		setEditValue(viewName);
	};

	const handleSaveRename = () => {
		if (editValue.trim() && editValue.trim() !== viewName) {
			onRenameView(editValue.trim());
		}
		setIsRenaming(false);
		setOpen(false);
	};

	const handleCancelRename = () => {
		setIsRenaming(false);
		setEditValue(viewName);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSaveRename();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			handleCancelRename();
		}
	};

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
				<DropdownMenu open={open} onOpenChange={setOpen}>
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
						{isRenaming ? (
							<div className="space-y-3 p-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Table name
									</label>
									<Input
										value={editValue}
										onChange={(e) => setEditValue(e.target.value)}
										onKeyDown={handleKeyDown}
										autoFocus
										className="h-8 text-sm"
									/>
								</div>
								
								<div className="text-gray-600 text-xs">
									Please enter the table's name.
								</div>
								
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										onClick={handleCancelRename}
										className="px-3 py-1 text-xs"
                                        size="sm"
									>
										Cancel
									</Button>
									<Button
										onClick={handleSaveRename}
										disabled={!editValue.trim()}
										className="bg-blue-500 text-white text-xs"
                                        size="sm"
									>
										Save
									</Button>
								</div>
							</div>
						) : (
							<div className="p-1">
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={() => console.log('Import data')}
								>
									<Download className="size-4" />
									Import data
								</button>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={handleRenameTable}
								>
									<Edit3 className="size-4" />
									Rename table
								</button>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={() => console.log('Hide table')}
								>
									<EyeOff className="size-4" />
									Hide table
								</button>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={() => console.log('Manage fields')}
								>
									<Settings className="size-4" />
									Manage fields
								</button>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={onDuplicateView}
								>
									<Copy className="size-4" />
									Duplicate table
								</button>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={() => console.log('Configure data dependencies')}
								>
									<ExternalLink className="size-4" />
									Configure data dependencies
								</button>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={() => console.log('Edit table description')}
								>
									<FileText className="size-4" />
									Edit table description
								</button>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={() => console.log('Edit table permissions')}
								>
									<Shield className="size-4" />
									Edit table permissions
								</button>

								<DropdownMenuSeparator />

								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
									onClick={() => console.log('Clear data')}
								>
									<Trash2 className="size-4" />
									Clear data
								</button>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
									disabled={!canDeleteView}
									onClick={() => {
										if (!canDeleteView) return;
										if (
											confirm(`Delete table "${viewName}"? This cannot be undone.`)
										) {
											onDeleteView();
										}
									}}
								>
									<Trash2 className="size-4" />
									Delete table
								</button>
							</div>
						)}
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
