import type { ColumnType } from "~/types/column";

/**
 * Get the icon representation for a column type
 * @param type - The column type
 * @returns String representation of the icon
 */
export const getColumnTypeIcon = (type: ColumnType): string => {
	return type === "TEXT" ? "A" : "#";
};

/**
 * Get the human-readable label for a column type
 * @param type - The column type
 * @returns User-friendly label for the column type
 */
export const getColumnTypeLabel = (type: ColumnType): string => {
	return type === "TEXT" ? "Single line text" : "Number";
};
