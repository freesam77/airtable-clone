"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { type RouterOutputs, api } from "~/trpc/react";
import type { FilterCondition } from "./Filters";
import type { SortCondition } from "./Sorts";
import { defaultViewSettings, parseViewSettings } from "./viewSettings";

export type ViewRecord = RouterOutputs["view"]["listByTable"][number];
type ViewList = RouterOutputs["view"]["listByTable"];

export type ViewUpdatePatch = Partial<{
	filters: FilterCondition[];
	sorts: SortCondition[];
	hiddenColumnIds: string[];
	autoSort: boolean;
}>;

type FilterState = {
	filters: FilterCondition[];
	sorts: SortCondition[];
	hiddenColumnIds: string[];
	autoSort: boolean;
};

type ViewFilterState = FilterState & {
	selectedViewId: string | null;
};

const baseFilterState: FilterState = {
	filters: defaultViewSettings.filters,
	sorts: defaultViewSettings.sorts,
	hiddenColumnIds: defaultViewSettings.hiddenColumnIds,
	autoSort: defaultViewSettings.autoSort,
};

const initialState: ViewFilterState = {
	selectedViewId: null,
	...baseFilterState,
};

type Action =
	| { type: "SET_SELECTED_VIEW"; viewId: string | null }
	| { type: "SET_VIEW_STATE"; viewId: string | null; payload: FilterState }
	| { type: "UPDATE_STATE"; patch: ViewUpdatePatch };

const ensureSortIds = (sorts: SortCondition[]): SortCondition[] =>
	sorts.map((sort, index) => ({
		...sort,
		id:
			sort.id ??
			[
				"sort",
				sort.columnId,
				String(index),
				Math.random().toString(36).slice(2, 6),
			].join("-"),
	}));

const buildSettingsObject = (state: FilterState) => ({
	version: 1,
	filters: state.filters,
	sorts: state.sorts,
	hiddenColumnIds: state.hiddenColumnIds,
	autoSort: state.autoSort,
});

const toJsonSettings = (state: FilterState): ViewRecord["settings"] =>
	buildSettingsObject(state) as unknown as ViewRecord["settings"];

const reducer = (state: ViewFilterState, action: Action): ViewFilterState => {
	switch (action.type) {
		case "SET_SELECTED_VIEW":
			return { ...state, selectedViewId: action.viewId };
		case "SET_VIEW_STATE":
			return {
				selectedViewId: action.viewId,
				filters: action.payload.filters,
				sorts: action.payload.sorts,
				hiddenColumnIds: action.payload.hiddenColumnIds,
				autoSort: action.payload.autoSort,
			};
		case "UPDATE_STATE":
			return {
				...state,
				filters: action.patch.filters ?? state.filters,
				sorts: action.patch.sorts ?? state.sorts,
				hiddenColumnIds: action.patch.hiddenColumnIds ?? state.hiddenColumnIds,
				autoSort: action.patch.autoSort ?? state.autoSort,
			};
		default:
			return state;
	}
};

export function useViewFilter(tableId: string) {
	const [state, dispatch] = useReducer(reducer, initialState);
	const utils = api.useUtils();

	const { data: viewsData, isLoading: viewsLoading } =
		api.view.listByTable.useQuery({ tableId }, { staleTime: 30_000 });

	const views = useMemo(() => viewsData ?? [], [viewsData]);

	useEffect(() => {
		if (views.length === 0) return;
		if (
			!state.selectedViewId ||
			!views.some((v) => v.id === state.selectedViewId)
		) {
			dispatch({ type: "SET_SELECTED_VIEW", viewId: views[0]!.id });
		}
	}, [views, state.selectedViewId]);

	const activeView: ViewRecord | null = useMemo(
		() => views.find((v) => v.id === state.selectedViewId) ?? views[0] ?? null,
		[views, state.selectedViewId],
	);

	const hydratedRef = useRef(false);

	useEffect(() => {
		if (!activeView) return;
		const parsed = parseViewSettings(
			activeView.settings ?? defaultViewSettings,
		);
		hydratedRef.current = true;
		dispatch({
			type: "SET_VIEW_STATE",
			viewId: activeView.id,
			payload: {
				filters: parsed.filters,
				sorts: ensureSortIds(parsed.sorts as SortCondition[]),
				hiddenColumnIds: parsed.hiddenColumnIds,
				autoSort: parsed.autoSort,
			},
		});
	}, [activeView?.id, activeView?.settings]);

	const updateViewSettingsMutation = api.view.updateSettings.useMutation();

	const handleUpdateView = useCallback(
		(patch: ViewUpdatePatch) => {
			const normalized = {
				...patch,
				sorts: patch.sorts ? ensureSortIds(patch.sorts) : undefined,
			};
			const nextState: FilterState = {
				filters: normalized.filters ?? state.filters,
				sorts: normalized.sorts ?? state.sorts,
				hiddenColumnIds: normalized.hiddenColumnIds ?? state.hiddenColumnIds,
				autoSort: normalized.autoSort ?? state.autoSort,
			};
			dispatch({ type: "UPDATE_STATE", patch: normalized });
			if (state.selectedViewId) {
				const payload = buildSettingsObject(nextState);
				const jsonPayload = toJsonSettings(nextState);
				utils.view.listByTable.setData({ tableId }, (prev) => {
					if (!prev) return prev;
					return prev.map((view) =>
						view.id === state.selectedViewId
							? { ...view, settings: jsonPayload }
							: view,
					);
				});
				updateViewSettingsMutation.mutate({
					viewId: state.selectedViewId,
					settings: payload,
				});
			}
		},
		[
			state.filters,
			state.sorts,
			state.hiddenColumnIds,
			state.autoSort,
			state.selectedViewId,
			tableId,
			utils.view.listByTable,
			updateViewSettingsMutation,
		],
	);

	const createViewMutation = api.view.create.useMutation({
		onSuccess: () => void utils.view.listByTable.invalidate({ tableId }),
	});
	const renameViewMutation = api.view.rename.useMutation({
		onSuccess: () => void utils.view.listByTable.invalidate({ tableId }),
	});
	const duplicateViewMutation = api.view.duplicate.useMutation({
		onSuccess: () => void utils.view.listByTable.invalidate({ tableId }),
	});
	const deleteViewMutation = api.view.delete.useMutation({
		onSuccess: () => void utils.view.listByTable.invalidate({ tableId }),
	});
	const reorderViewMutation = api.view.reorder.useMutation({
		onSuccess: () => void utils.view.listByTable.invalidate({ tableId }),
	});

	const handleCreateView = useCallback(() => {
		const tempId = `temp-view-${Math.random().toString(36).slice(2, 8)}`;
		const name = "Grid " + (views.length + 1);
		const tempView: ViewRecord = {
			id: tempId,
			name,
			type: "grid",
			position: views.length,
			tableId,
			settings: toJsonSettings(baseFilterState),
			createdAt: new Date() as unknown as Date,
			updatedAt: new Date() as unknown as Date,
		};
		utils.view.listByTable.setData({ tableId }, (prev) => {
			const list = (prev ?? []) as ViewList;
			return [...list, tempView];
		});
		createViewMutation.mutate(
			{ tableId, name },
			{
				onSuccess: (created) => {
					utils.view.listByTable.setData({ tableId }, (prev) =>
						prev?.map((view) => (view.id === tempId ? created : view)),
					);
				},
			},
		);
	}, [createViewMutation, tableId, views.length, utils.view.listByTable]);

	useEffect(() => {
		if (viewsLoading) return;
		if (views.length === 0 && !createViewMutation.isPending) {
			createViewMutation.mutate({ tableId, name: "Grid view" });
		}
	}, [viewsLoading, views.length, createViewMutation, tableId]);

	const handleRenameView = useCallback(
		(viewId: string, name: string) => {
			const trimmed = name.trim();
			if (!trimmed) return;
			utils.view.listByTable.setData({ tableId }, (prev) => {
				if (!prev) return prev;
				return prev.map((view) =>
					view.id === viewId ? { ...view, name: trimmed } : view,
				);
			});
			renameViewMutation.mutate({ viewId, name: trimmed });
		},
		[renameViewMutation, tableId, utils.view.listByTable],
	);

	const handleDuplicateView = useCallback(
		(viewId: string) => {
			const source = views.find((v) => v.id === viewId);
			if (!source) return;
			const tempId = `temp-view-${Math.random().toString(36).slice(2, 8)}`;
			const duplicatedName = `${source.name} copy`;
			const tempView: ViewRecord = {
				...source,
				id: tempId,
				name: duplicatedName,
				position: views.length,
				createdAt: new Date() as unknown as Date,
				updatedAt: new Date() as unknown as Date,
			};
			utils.view.listByTable.setData({ tableId }, (prev) => {
				const list = (prev ?? []) as ViewList;
				return [...list, tempView];
			});
			duplicateViewMutation.mutate(
				{ viewId },
				{
					onSuccess: (created) => {
						utils.view.listByTable.setData({ tableId }, (prev) =>
							prev?.map((view) => (view.id === tempId ? created : view)),
						);
					},
				},
			);
		},
		[duplicateViewMutation, tableId, views, utils.view.listByTable],
	);

	const handleDeleteView = useCallback(
		(viewId: string) => {
			if (views.length <= 1) return;
			const snapshot = views as ViewList;
			utils.view.listByTable.setData({ tableId }, (prev) =>
				(prev ?? snapshot).filter((view) => view.id !== viewId),
			);
			deleteViewMutation.mutate(
				{ viewId },
				{
					onError: () => {
						utils.view.listByTable.setData({ tableId }, snapshot);
					},
				},
			);
		},
		[deleteViewMutation, views, tableId, utils.view.listByTable],
	);

	const handleSelectView = useCallback((viewId: string) => {
		dispatch({ type: "SET_SELECTED_VIEW", viewId });
	}, []);

	const handleReorderView = useCallback(
		(sourceId: string, targetId: string) => {
			if (sourceId === targetId) return;
			const currentOrder = views.slice();
			const sourceIndex = currentOrder.findIndex((v) => v.id === sourceId);
			const targetIndex = currentOrder.findIndex((v) => v.id === targetId);
			if (sourceIndex === -1 || targetIndex === -1) return;
			const updated = currentOrder.slice();
			const [moved] = updated.splice(sourceIndex, 1);
			if (!moved) return;
			updated.splice(targetIndex, 0, moved);
			utils.view.listByTable.setData({ tableId }, updated);
			reorderViewMutation.mutate({
				tableId,
				orderedIds: updated.map((v) => v.id),
			});
		},
		[views, utils.view.listByTable, tableId, reorderViewMutation],
	);

	return {
		views,
		viewsLoading,
		activeView,
		filters: state.filters,
		sorts: state.sorts,
		hiddenColumnIds: state.hiddenColumnIds,
		autoSort: state.autoSort,
		selectedViewId: state.selectedViewId,
		canDeleteView: views.length > 1,
		handleUpdateView,
		handleSelectView,
		handleCreateView,
		handleRenameView,
		handleDuplicateView,
		handleDeleteView,
		handleReorderView,
	};
}
