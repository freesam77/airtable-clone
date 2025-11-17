import { AsyncQueuer } from "@tanstack/pacer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

	// Keep unstable function references in refs so the queuer instance
	// doesn't need to be re-created every render.
	const mutateRef = useRef(updateCellMutation.mutateAsync);
	useEffect(() => {
		mutateRef.current = updateCellMutation.mutateAsync;
	}, [updateCellMutation.mutateAsync]);

	const invalidateRef = useRef(utils.table.getTableColumnType.invalidate);
	useEffect(() => {
		invalidateRef.current = utils.table.getTableColumnType.invalidate;
	}, [utils.table.getTableColumnType.invalidate]);
	const [hasPendingChanges, setHasPendingChanges] = useState(false);
	const pendingCountRef = useRef(0);
	const rowIdMapRef = useRef(new Map<string, string>());

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
						const resolveRowId = async (rowId: string) => {
							const existing = rowIdMapRef.current.get(rowId);
							if (existing) return existing;

							return rowId;
						};

						const mappedRowId = await resolveRowId(update.rowId);
						await mutateRef.current({
							rowId: mappedRowId,
							columnId: update.columnId,
							// normalize empty string to null so it clears the value
							value: valueStr === "" ? null : valueStr,
						});
						invalidateRef.current({ id: tableId });
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
		// Keep the queue instance stable across renders. Recreate only when tableId changes.
		[tableId],
	);

	const queueCellUpdate = useCallback(
		(rowId: string, columnId: string, value?: string | number) => {
			// Apply optimistic update immediately
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
				setHasPendingChanges(true);
			}
		},
		[onOptimisticUpdate, queuer],
	);

	const flushPendingUpdates = useCallback(async () => {
		await queuer.flush();
		// Reset pending count after manual flush
		pendingCountRef.current = 0;
		setHasPendingChanges(false);
	}, [queuer]);

	// Prevent page refresh when there are unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (hasPendingChanges) {
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

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [hasPendingChanges, flushPendingUpdates]);

	// Clean up on unmount
	// Stop the queue only when unmounting or when the tableId (and thus queuer) changes.
	useEffect(() => () => queuer.stop(), [queuer]);

	// Public API to remap optimistic temp row IDs to actual persisted IDs
	const remapRowId = useCallback(
		(tempRowId: string, realRowId: string) => {
			if (!tempRowId || !realRowId || tempRowId === realRowId) return;
			rowIdMapRef.current.set(tempRowId, realRowId);

			// Also rewrite any pending items so they point to the real row id
			const pending = queuer.peekPendingItems();
			if (pending.length > 0) {
				queuer.clear();
				for (const item of pending) {
					const mapped = {
						...item,
						rowId: item.rowId === tempRowId ? realRowId : item.rowId,
					};
					queuer.addItem(mapped);
				}
			}
		},
		[queuer],
	);

	return {
		queueCellUpdate,
		flushPendingUpdates,
		pendingUpdatesCount: pendingCountRef.current,
		isProcessing: queuer.store.state.activeItems.length > 0,
		hasPendingChanges,
		remapRowId,
	};
}
