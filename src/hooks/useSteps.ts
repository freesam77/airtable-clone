import { useCallback, useRef } from "react";

export type CellHistoryChange = {
	rowId: string;
	columnId: string;
	previousValue: string | null;
	nextValue: string | null;
};

type UndoStep = CellHistoryChange[];

export function useSteps(limit = 100) {
	const undoSteps = useRef<UndoStep[]>([]);
	const redoSteps = useRef<UndoStep[]>([]);

	const pushStep = useCallback(
		(changes: UndoStep) => {
			if (changes.length === 0) return;
			undoSteps.current.push(changes);
			if (undoSteps.current.length > limit) {
				undoSteps.current.shift();
			}
			redoSteps.current = [];
		},
		[limit],
	);

	const popUndoStep = useCallback(() => {
		const step = undoSteps.current.pop();
		if (step) {
			redoSteps.current.push(step);
		}
		return step;
	}, []);

	const popRedoStep = useCallback(() => {
		const step = redoSteps.current.pop();
		if (step) {
			undoSteps.current.push(step);
		}
		return step;
	}, []);

	return {
		pushStep,
		popUndoStep,
		popRedoStep,
	} as const;
}
