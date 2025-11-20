import type { Cell } from "./cells";

// Optimized row type without cells (for lazy loading)
export type RowMetadata = {
	id: string;
	position: number;
	updatedAt: Date;
	tableId: string;
};

// Full row type with cells (legacy/backwards compatibility)
export type TableData = {
	id: string;
	position: number;
	createdAt?: Date;
	updatedAt: Date;
	tableId: string;
	cells: Array<Cell>;
};
