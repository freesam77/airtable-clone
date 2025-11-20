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

						// Check if this row still exists in the current cache before attempting update
						const infiniteInput = { id: tableId, limit: 500 };
						const infiniteData =
							utils.table.getInfiniteRows.getInfiniteData(infiniteInput);
						const rowExists = infiniteData?.pages
							.flatMap((page) => page.items)
							.some((row) => row.id === mappedRowId || row.id === update.rowId);

						if (!rowExists && !mappedRowId.startsWith("temp-")) {
							console.warn(
								`Skipping cell update for deleted row: ${mappedRowId}`,
							);
							return; // Skip this update - row was deleted
						}

						await mutateRef.current({
							rowId: mappedRowId,
							columnId: update.columnId,
							// normalize empty string to null so it clears the value
							value: valueStr === "" ? null : valueStr,
						});
						invalidateRef.current({ id: tableId });
					} catch (error: any) {
						// Handle race condition where row was deleted
						if (
							error?.message?.includes("Row not found") ||
							error?.message?.includes("access denied")
						) {
							console.warn(
								`Row ${update.rowId} was deleted before cell update could complete:`,
								error.message,
							);
							// Don't throw - just log the race condition and continue
							return;
						}
						// Re-throw other errors that should be handled
						console.error("Cell update failed:", error, update);
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
					wait: 0, // Changed from 500ms to 0ms for immediate processing
					onError: (error: any, item) => {
						// Error logging is handled in the try/catch block above
						// This onError is just for unhandled cases
						if (
							!error?.message?.includes("Row not found") &&
							!error?.message?.includes("access denied")
						) {
							console.error("Unhandled cell update error:", error, item);
						}
					},
				},
			),
		// Keep the queue instance stable across renders. Recreate only when tableId changes.
		[tableId],
	);

	const queueCellUpdate = useCallback(
		(rowId: string, columnId: string, value?: string | number) => {
			// Apply optimistic update immediately
			onOptimisticUpdate(rowId, columnId, value);

			// Safer approach: just add the item and let the queuer handle deduplication
			// The AsyncQueuer should handle duplicate keys properly
			const cellKey = `${rowId}-${columnId}`;
			const existingItems = queuer.peekPendingItems();
			const isNewCellUpdate = !existingItems.some(
				(item) => `${item.rowId}-${item.columnId}` === cellKey,
			);

			// Simply add the new item - AsyncQueuer will process them in order
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

	const cancelCellUpdate = useCallback(
		(rowId: string, columnId: string) => {
			const cellKey = `${rowId}-${columnId}`;
			const existingItems = queuer.peekPendingItems();
			const filteredItems = existingItems.filter(
				(item) => `${item.rowId}-${item.columnId}` !== cellKey,
			);

			// Count how many updates we're canceling for this cell
			const canceledCount = existingItems.filter(
				(item) => `${item.rowId}-${item.columnId}` === cellKey,
			).length;

			if (canceledCount > 0) {
				// Clear and re-add all items except the canceled ones
				queuer.clear();
				for (const item of filteredItems) {
					queuer.addItem(item);
				}

				// Update pending count
				pendingCountRef.current = Math.max(
					0,
					pendingCountRef.current - canceledCount,
				);
				setHasPendingChanges(pendingCountRef.current > 0);

				console.log(
					`Canceled ${canceledCount} pending update(s) for cell ${cellKey}`,
					"Remaining pending count:",
					pendingCountRef.current,
				);
			}
		},
		[queuer],
	);

	const cancelRowUpdates = useCallback(
		(rowId: string) => {
			const existingItems = queuer.peekPendingItems();
			const filteredItems = existingItems.filter(
				(item) => item.rowId !== rowId,
			);

			// Count how many updates we're canceling for this row
			const canceledCount = existingItems.filter(
				(item) => item.rowId === rowId,
			).length;

			if (canceledCount > 0) {
				// Clear and re-add all items except the canceled ones
				queuer.clear();
				for (const item of filteredItems) {
					queuer.addItem(item);
				}

				// Update pending count
				pendingCountRef.current = Math.max(
					0,
					pendingCountRef.current - canceledCount,
				);
				setHasPendingChanges(pendingCountRef.current > 0);

				console.log(
					`Canceled ${canceledCount} pending update(s) for deleted row ${rowId}`,
					"Remaining pending count:",
					pendingCountRef.current,
				);
			}
		},
		[queuer],
	);

	return {
		queueCellUpdate,
		flushPendingUpdates,
		cancelCellUpdate,
		cancelRowUpdates,
		isProcessing: queuer.store.state.activeItems.length > 0,
		hasPendingChanges,
		remapRowId,
	};
}
