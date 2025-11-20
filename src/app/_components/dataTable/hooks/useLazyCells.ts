import { useCallback, useMemo } from "react";
import { api } from "~/trpc/react";

interface UseLazyCellsParams {
	tableId: string;
	visibleRowIds: string[];
	enabled?: boolean;
}

/**
 * Hook for lazy loading cells for visible rows
 * This implements the lazy cell loading pattern from the optimization plan
 */
export function useLazyCells({
	tableId,
	visibleRowIds,
	enabled = true,
}: UseLazyCellsParams) {
	// Only fetch cells for visible rows, batch them efficiently
	const batchedRowIds = useMemo(() => {
		// Limit batch size to prevent huge requests
		return visibleRowIds.slice(0, 100);
	}, [visibleRowIds]);

	const { data: cellsByRowId, isLoading, error } = api.table.getCellsByRowIds.useQuery(
		{
			tableId,
			rowIds: batchedRowIds,
		},
		{
			enabled: enabled && batchedRowIds.length > 0,
			staleTime: 2 * 60 * 1000, // 2 minutes cache
			gcTime: 5 * 60 * 1000, // 5 minutes in memory
			retry: (failureCount, error) => {
				if (error?.data?.code === "UNAUTHORIZED") {
					return false;
				}
				return failureCount < 2;
			},
		},
	);

	// Helper function to get cells for a specific row
	const getCellsForRow = useCallback((rowId: string) => {
		return cellsByRowId?.[rowId] || [];
	}, [cellsByRowId]);

	// Helper to check if cells are loaded for a row
	const hasCellsForRow = useCallback((rowId: string) => {
		return Boolean(cellsByRowId?.[rowId]);
	}, [cellsByRowId]);

	return {
		cellsByRowId: cellsByRowId || {},
		getCellsForRow,
		hasCellsForRow,
		isLoading,
		error,
	};
}