import { useCallback, useReducer } from "react";

export type GridCell = { rowId: string; columnId: string };
export type SelectionRange = { anchor: GridCell; focus: GridCell };
export type FillPreview = { columnId: string; rows: number[] };

type ValueOrUpdater<T> = T | ((prev: T) => T);

export interface DataTableState {
	activeCell: GridCell | null;
	selection: SelectionRange | null;
	editingCell: GridCell | null;
	fillPreview: FillPreview | null;
}

const initialState: DataTableState = {
	activeCell: null,
	selection: null,
	editingCell: null,
	fillPreview: null,
};

type Action =
	| { type: "SET_ACTIVE_CELL"; value: ValueOrUpdater<GridCell | null> }
	| { type: "SET_SELECTION"; value: ValueOrUpdater<SelectionRange | null> }
	| { type: "SET_EDITING_CELL"; value: ValueOrUpdater<GridCell | null> }
	| { type: "SET_FILL_PREVIEW"; value: ValueOrUpdater<FillPreview | null> };

const resolveUpdate = <T,>(current: T, value: ValueOrUpdater<T>) =>
	typeof value === "function" ? (value as (prev: T) => T)(current) : value;

function reducer(state: DataTableState, action: Action): DataTableState {
	switch (action.type) {
		case "SET_ACTIVE_CELL":
			return { ...state, activeCell: resolveUpdate(state.activeCell, action.value) };
		case "SET_SELECTION":
			return { ...state, selection: resolveUpdate(state.selection, action.value) };
		case "SET_EDITING_CELL":
			return { ...state, editingCell: resolveUpdate(state.editingCell, action.value) };
		case "SET_FILL_PREVIEW":
			return {
				...state,
				fillPreview: resolveUpdate(state.fillPreview, action.value),
			};
		default:
			return state;
	}
}

export function useDataTableState(initial?: Partial<DataTableState>) {
	const [state, dispatch] = useReducer(
		reducer,
		{ ...initialState, ...initial },
	);

	const setActiveCell = useCallback(
		(value: ValueOrUpdater<GridCell | null>) =>
			dispatch({ type: "SET_ACTIVE_CELL", value }),
		[],
	);

	const setSelection = useCallback(
		(value: ValueOrUpdater<SelectionRange | null>) =>
			dispatch({ type: "SET_SELECTION", value }),
		[],
	);

	const setEditingCell = useCallback(
		(value: ValueOrUpdater<GridCell | null>) =>
			dispatch({ type: "SET_EDITING_CELL", value }),
		[],
	);

	const setFillPreview = useCallback(
		(value: ValueOrUpdater<FillPreview | null>) =>
			dispatch({ type: "SET_FILL_PREVIEW", value }),
		[],
	);

	return {
		state,
		setActiveCell,
		setSelection,
		setEditingCell,
		setFillPreview,
	} as const;
}
