import { useMemo } from "react";
import type { RowMetadata, TableData } from "~/types/dataTable";
import { useLazyCells } from "./useLazyCells";

interface UseOptimizedDataTableParams {
	tableId: string;
	rows: (RowMetadata | TableData)[]; // Support both optimized and legacy rows
	optimisticRows: TableData[];
	visibleRowRange: { start: number; end: number };
}

/**
 * Hook that combines optimized row data with lazy-loaded cells
 * This adapts the new optimized API to work with existing components
 */
export function useOptimizedDataTable({
	tableId,
	rows,
	optimisticRows,
	visibleRowRange,
}: UseOptimizedDataTableParams) {
	// Get visible row IDs for lazy cell loading
	const visibleRowIds = useMemo(() => {
		const allRows = [...rows, ...optimisticRows];
		return allRows
			.slice(visibleRowRange.start, visibleRowRange.end + 10) // Small buffer
			.map(row => row.id);
	}, [rows, optimisticRows, visibleRowRange]);

	// Lazy load cells for visible rows
	const { cellsByRowId, getCellsForRow, hasCellsForRow, isLoading } = useLazyCells({
		tableId,
		visibleRowIds,
		enabled: visibleRowIds.length > 0,
	});

	// Combine row metadata with lazy-loaded cells for compatibility
	const rowsWithCells = useMemo(() => {
		return rows.map(row => {
			// If row already has cells (legacy), use as is
			if ('cells' in row && Array.isArray(row.cells)) {
				return row as TableData;
			}
			
			// Otherwise, lazy load cells
			const cells = getCellsForRow(row.id);
			return {
				...row,
				createdAt: new Date(), // Fallback for missing createdAt
				cells: cells || [],
			} as TableData;
		});
	}, [rows, getCellsForRow]);

	// Combine with optimistic rows (which should already have cells)
	const rowsWithOptimistic = useMemo(() => {
		return [...rowsWithCells, ...optimisticRows];
	}, [rowsWithCells, optimisticRows]);

	return {
		rowsWithOptimistic,
		cellsByRowId,
		getCellsForRow,
		hasCellsForRow,
		isCellsLoading: isLoading,
	};
}