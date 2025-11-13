import { useCallback, useRef, useState } from "react";

export type CellHistoryChange = {
	rowId: string;
	columnId: string;
	previousValue: string | null;
	nextValue: string | null;
};

type UndoStep = CellHistoryChange[];

export function useUndoStack(limit = 100) {
	const stackRef = useRef<UndoStep[]>([]);
	const [canUndo, setCanUndo] = useState(false);

	const pushStep = useCallback((changes: UndoStep) => {
		if (changes.length === 0) return;
		stackRef.current.push(changes);
		if (stackRef.current.length > limit) {
			stackRef.current.shift();
		}
		setCanUndo(stackRef.current.length > 0);
	}, [limit]);

	const popStep = useCallback(() => {
		const step = stackRef.current.pop();
		setCanUndo(stackRef.current.length > 0);
		return step;
	}, []);

	const clear = useCallback(() => {
		stackRef.current = [];
		setCanUndo(false);
	}, []);

	return {
		pushStep,
		popStep,
		canUndo,
		clear,
	} as const;
}
