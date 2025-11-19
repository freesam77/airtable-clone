import type { Cell, TableData } from "~/types/dataTable";

/**
 * Find a cell value for a specific column in a row
 * @param row - The table row data
 * @param columnId - The column ID to find
 * @returns The cell data or undefined if not found
 */
export const findCellInRow = (row: TableData, columnId: string): Cell | undefined => {
	return row.cells.find((cv: any) => {
		const cellColumnId = cv?.column?.id ?? cv?.columnId;
		return cellColumnId === columnId;
	});
};

/**
 * Get the resolved cell value (handling null/undefined cases)
 * @param cell - The cell data
 * @returns The cell value or null
 */
export const resolveCellValue = (cell: Cell | undefined): string | null => {
	return cell?.value ?? null;
};

/**
 * Create a unique cell key for identification
 * @param rowId - The row ID
 * @param columnId - The column ID
 * @returns A unique key string
 */
export const createCellKey = (rowId: string, columnId: string): string => {
	return `${rowId}|${columnId}`;
};

/**
 * Parse a cell key back into row and column IDs
 * @param cellKey - The cell key string
 * @returns Object with rowId and columnId
 */
export const parseCellKey = (cellKey: string): { rowId: string; columnId: string } => {
	const [rowId, columnId] = cellKey.split('|');
	return { rowId: rowId || '', columnId: columnId || '' };
};