import type { ColumnType } from "../column";

export type ColumnMeta = {
	id: string;
	name: string;
	type: ColumnType;
	required: boolean;
	position: number;
	tableId: string;
};