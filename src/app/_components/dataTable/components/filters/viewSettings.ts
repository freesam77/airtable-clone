import type { FilterCondition } from "./Filters";
import type { SortCondition } from "./Sorts";

export type ViewSettingsPayload = {
	version: number;
	filters: FilterCondition[];
	sorts: Array<SortCondition & { id?: string }>;
	hiddenColumnIds: string[];
	autoSort: boolean;
	groups?: unknown[];
};

export const defaultViewSettings: ViewSettingsPayload = {
	version: 1,
	filters: [],
	sorts: [],
	hiddenColumnIds: [],
	autoSort: true,
};

export function parseViewSettings(raw: unknown): ViewSettingsPayload {
	if (!raw || typeof raw !== "object") {
		return defaultViewSettings;
	}

	const viewSettings = raw as Partial<ViewSettingsPayload>;

	const sorts = Array.isArray(viewSettings.sorts)
		? viewSettings.sorts.map((sort, index) => ({
				...sort,
				id:
					typeof sort.id === "string"
						? sort.id
						: `sort-${sort.columnId ?? index}-${index}-${Math.random().toString(36).slice(2, 6)}`,
			}))
		: [];

	return {
		version:
			typeof viewSettings.version === "number" ? viewSettings.version : 1,
		filters: Array.isArray(viewSettings.filters) ? viewSettings.filters : [],
		sorts,
		hiddenColumnIds: Array.isArray(viewSettings.hiddenColumnIds)
			? viewSettings.hiddenColumnIds.filter(
					(id): id is string => typeof id === "string",
				)
			: [],
		autoSort:
			typeof viewSettings.autoSort === "boolean" ? viewSettings.autoSort : true,
		groups: Array.isArray(viewSettings.groups)
			? viewSettings.groups
			: undefined,
	};
}
