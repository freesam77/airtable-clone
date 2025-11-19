import { memo } from "react";
import type { ColumnType } from "~/types/column";
import type { FilterCondition } from "./filters/Filters";
import type { SortCondition } from "./filters/Sorts";
import type { ViewUpdatePatch } from "../hooks/useViewFilter";
import { ViewsHeader } from "./views/ViewsHeader";

interface DataTableToolbarProps {
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
}

export const DataTableToolbar = memo(function DataTableToolbar(
	props: DataTableToolbarProps,
) {
	return <ViewsHeader {...props} />;
});
