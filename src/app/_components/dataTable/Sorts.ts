import orderBy from "lodash-es/orderBy";

export type SortDirection = "asc" | "desc";

export type SortCondition = {
	columnId: string;
	type: "TEXT" | "NUMBER";
	dir: SortDirection;
};

type Row = {
	cells: Array<{ columnId: string; value: string | null }>;
};

type Column = { id: string; type: "TEXT" | "NUMBER" };

export function applySorts<T extends Row>(
	rows: T[],
	_columns: Column[],
	sorts: SortCondition[],
	autoSort: boolean,
): T[] {
	if (!autoSort || sorts.length === 0) return rows;

	// Helpers
	const getCellValue = (row: T, columnId: string) =>
		row.cells.find((c) => c.columnId === columnId)?.value;

	const normalizeValue = (value: unknown) => {
		if (value == null || String(value).trim() === "")
			return Number.POSITIVE_INFINITY;
		return value;
	};

	const getSortValue = (row: T, sort: SortCondition) => {
		const raw = normalizeValue(getCellValue(row, sort.columnId));

		if (raw === Number.POSITIVE_INFINITY) return raw;
		if (sort.type === "NUMBER") {
			const num = Number(raw);
			return Number.isNaN(num) ? String(raw).toLowerCase() : num;
		}
		return String(raw).toLowerCase();
	};

	// Construct iteratees & directions
	const iteratees = sorts.map((sort) => (row: T) => getSortValue(row, sort));
	const directions = sorts.map((sort) => sort.dir);

	return orderBy(rows, iteratees, directions);
}
