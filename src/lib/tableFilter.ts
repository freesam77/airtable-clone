// Readable, reusable helpers for table-wide search filtering

export type RowLike = {
  id: string;
  cells: Array<{
    column: { id: string };
    value?: string | null;
  }>;
};

export type ColumnLike = { id: string };

// Internal helpers -----------------------------------------------------------

/** Normalize a search query to a lowercase string. Empty/whitespace → "". */
function normalizeQuery(query: string): string {
  return (query ?? "").toString().trim().toLowerCase();
}

/** Get a cell's string value in lowercase; null/undefined → "". */
function cellText(value: string | null | undefined): string {
  return (value ?? "").toString().toLowerCase();
}

// Public API ----------------------------------------------------------------

/**
 * Check whether a row matches a query.
 * A row "matches" if at least one of its cells (within the given columns)
 * contains the query text (case-insensitive, substring match).
 */
export function rowMatchesQuery(
  row: RowLike,
  columns: ColumnLike[],
  query: string,
): boolean {
  const q = normalizeQuery(query);
  if (!q) return true; // No query → keep all rows

  // Look for any cell in the provided column order that includes the query
  return columns.some((col) => {
    const cell = row.cells.find((c) => c.column.id === col.id);
    return cellText(cell?.value).includes(q);
  });
}

/**
 * Filter a list of rows, keeping only those that match the query.
 * Uses the same logic as rowMatchesQuery for consistency.
 */
export function filterRowsByQuery<T extends RowLike>(
  rows: T[],
  columns: ColumnLike[],
  query: string,
): T[] {
  const q = normalizeQuery(query);
  if (!q) return rows;
  return rows.filter((row) => rowMatchesQuery(row, columns, q));
}
