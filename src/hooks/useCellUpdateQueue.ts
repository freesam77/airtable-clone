import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AsyncQueuer } from "@tanstack/pacer";
import { api } from "~/trpc/react";

interface CellUpdate {
    rowId: string;
    columnId: string;
    value?: string | number;
}

interface UseCellUpdateQueueProps {
	tableId: string;
	onOptimisticUpdate: (
		rowId: string,
		columnId: string,
		value?: string | number,
	) => void;
}

export function useCellUpdateQueue({
	tableId,
	onOptimisticUpdate,
}: UseCellUpdateQueueProps) {
	const utils = api.useUtils();
	const updateCellMutation = api.table.updateCell.useMutation();
	const [hasPendingChanges, setHasPendingChanges] = useState(false);
	const pendingCountRef = useRef(0);

	// Create async queuer for processing cell updates
	const queuer = useMemo(
		() =>
            new AsyncQueuer<CellUpdate>(
                async (update) => {
                    try {
                        const valueStr =
                            typeof update.value === "number"
                                ? String(update.value)
                                : update.value;
                        await updateCellMutation.mutateAsync({
                            rowId: update.rowId,
                            columnId: update.columnId,
                            value: valueStr,
                        });
                        utils.table.getById.invalidate({ id: tableId });
                    } finally {
						// Decrement pending count when item finishes (success or error)
						pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
						const pending = pendingCountRef.current > 0;
						console.log(
							"Item finished - pending count:",
							pendingCountRef.current,
							"hasPendingChanges:",
							pending,
						);
						setHasPendingChanges(pending);
					}
				},
				{
					key: `cellUpdateQueue${tableId}`,
					concurrency: 1,
					started: true,
					wait: 500,
					onError: (error, item) =>
						console.error("Cell update failed:", error, item),
				},
			),
		[tableId, updateCellMutation, utils.table.getById],
	);

	const queueCellUpdate = useCallback(
		(rowId: string, columnId: string, value?: string | number) => {
			// Apply optimistic update immediately
            console.log({rowId})
			onOptimisticUpdate(rowId, columnId, value);

			// Deduplicate: remove existing update for same cell
			const cellKey = `${rowId}-${columnId}`;
			const existingItems = queuer.peekPendingItems();
			const filteredItems = existingItems.filter(
				(item) => `${item.rowId}-${item.columnId}` !== cellKey,
			);

			// Check if this is a new cell update (not a duplicate)
			const isNewCellUpdate = !existingItems.some(
				(item) => `${item.rowId}-${item.columnId}` === cellKey,
			);

			// Update queue with latest value only
			queuer.clear();
			for (const item of filteredItems) {
				queuer.addItem(item);
			}
			queuer.addItem({ rowId, columnId, value: value });

			// Only increment pending count for new cell updates
			if (isNewCellUpdate) {
				pendingCountRef.current++;
				console.log(
					"New cell update queued - pending count:",
					pendingCountRef.current,
				);
				setHasPendingChanges(true);
			} else {
				console.log(
					"Existing cell update replaced - pending count unchanged:",
					pendingCountRef.current,
				);
			}
		},
		[onOptimisticUpdate, queuer],
	);

	const flushPendingUpdates = useCallback(async () => {
		await queuer.flush();
		// Reset pending count after manual flush
		pendingCountRef.current = 0;
		setHasPendingChanges(false);
		console.log("Manual flush completed - pending count reset to 0");
	}, [queuer]);

	// Prevent page refresh when there are unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			console.log(
				"beforeunload triggered, hasPendingChanges:",
				hasPendingChanges,
			);
			if (hasPendingChanges) {
				console.log("Preventing page unload due to pending changes");
				// Attempt to flush pending updates before leaving
				flushPendingUpdates();

				// Show browser warning about unsaved changes
				const message =
					"You have unsaved changes. Are you sure you want to leave?";
				event.preventDefault();
				event.returnValue = message;
				return message;
			}
		};

		console.log(
			"Setting up beforeunload listener, hasPendingChanges:",
			hasPendingChanges,
		);
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			console.log("Removing beforeunload listener");
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [hasPendingChanges, flushPendingUpdates]);

	// Clean up on unmount
	useEffect(() => () => queuer.stop(), [queuer]);

	return {
		queueCellUpdate,
		flushPendingUpdates,
		pendingUpdatesCount: pendingCountRef.current,
		isProcessing: queuer.store.state.activeItems.length > 0,
		hasPendingChanges,
	};
}
