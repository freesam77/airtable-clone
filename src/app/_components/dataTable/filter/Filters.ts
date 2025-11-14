import type { ColumnType } from "~/types/column";

export type TextOp =
	| "is_empty"
	| "is_not_empty"
	| "contains"
	| "not_contains"
	| "equals";
export type NumOp = "is_empty" | "is_not_empty" | ">" | "<" | "=";
export type FilterCondition = {
	id: string;
	columnId: string;
	type: ColumnType;
	op: TextOp | NumOp;
	value?: string;
};

type Row = {
	cells: Array<{ columnId: string; value: string | null }>;
};

type Column = { id: string; type: ColumnType };

export function applyFilters<T extends Row>(
	rows: T[],
	columns: Column[],
	searchFilteredRows: T[],
	filters: FilterCondition[],
) {
	if (filters.length === 0) return searchFilteredRows;
	const colById = new Map(columns.map((c) => [c.id, c]));
	return searchFilteredRows.filter((row) =>
		filters.every((f) => {
			const col = colById.get(f.columnId);
			if (!col) return true;
			const cell = row.cells.find((c) => c.columnId === f.columnId);
			const val = cell?.value ?? "";
			const isEmpty =
				val === null || val === undefined || String(val).trim() === "";
			if (f.type === "TEXT") {
				const v = String(val ?? "");
				switch (f.op) {
					case "is_empty":
						return isEmpty;
					case "is_not_empty":
						return !isEmpty;
					case "contains":
						return v
							.toLowerCase()
							.includes(String(f.value ?? "").toLowerCase());
					case "not_contains":
						return !v
							.toLowerCase()
							.includes(String(f.value ?? "").toLowerCase());
					case "equals":
						return v === String(f.value ?? "");
					default:
						return true;
				}
			}
			if (isEmpty) return f.op === "is_empty";
			const num = Number(val);
			if (Number.isNaN(num)) return false;
			const cmp = Number(f.value ?? "");
			switch (f.op) {
				case "is_empty":
					return isEmpty;
				case "is_not_empty":
					return !isEmpty;
				case ">":
					return num > cmp;
				case "<":
					return num < cmp;
				case "=":
					return num === cmp;
				default:
					return true;
			}
		}),
	);
}
