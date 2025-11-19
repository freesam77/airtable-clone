import type { ColumnMeta } from "./columns";

export type Cell = {
	id: string;
	columnId: string;
	value: string | null;
	rowId: string;
	column?: ColumnMeta;
};
