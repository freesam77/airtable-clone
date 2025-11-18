import { useCallback, useEffect, useMemo, useState } from "react";

// Minimal shapes needed by the hook (keeps it reusable and typed)
type RowLike = {
	id: string;
	cells: Array<{
		column?: { id: string };
		columnId?: string;
		value?: string | null;
	}>;
};

type ColumnLike = { id: string };

export type TableMatch = { rowId: string; columnId: string };

interface UseTableSearchNavigationOptions {
	rows: RowLike[];
	columns: ColumnLike[];
	searchValue: string;
	scrollIntoView?: boolean;
}

/**
 * Provides global-search match indexing + navigation for a table.
 * - Computes matching cells from rows/columns and the current search value
 * - Tracks an active match and exposes next/prev controls
 * - Optionally scrolls the active match into view
 */
export function useTableSearchNavigation({
	rows,
	columns,
	searchValue,
	scrollIntoView = true,
}: UseTableSearchNavigationOptions) {
	// Normalize inputs
	const query = useMemo(() => searchValue.trim().toLowerCase(), [searchValue]);
	const columnIdSet = useMemo(
		() => new Set(columns.map((c) => c.id)),
		[columns],
	);

	// Compute all matching cells for the current query in top-left → bottom-right order
	const matches = useMemo<TableMatch[]>(() => {
		if (!query) return [];
		const found: TableMatch[] = [];
		for (const row of rows) {
			// Iterate columns in the provided order to respect visual left→right
			for (const col of columns) {
				if (!columnIdSet.has(col.id)) continue;
				const cv = row.cells.find((c) => {
					const cid = c.column?.id ?? c.columnId;
					return cid === col.id;
				});
				if (!cv) continue;
				const t = (cv.value ?? "").toLowerCase();
				if (t.includes(query)) {
					found.push({ rowId: row.id, columnId: col.id });
				}
			}
		}
		return found;
	}, [rows, columns, query, columnIdSet]);

	// Fast lookup for highlighting
	const matchKeys = useMemo(
		() => new Set(matches.map((m) => `${m.rowId}|${m.columnId}`)),
		[matches],
	);

	// Active match state
	const [activeMatchIndex, setActiveMatchIndex] = useState(0);

	// Reset active index only when the query changes
	useEffect(() => {
		setActiveMatchIndex(0);
	}, []);

	const activeMatch = useMemo(() => {
		if (matches.length === 0) return undefined;
		return matches[Math.min(activeMatchIndex, matches.length - 1)];
	}, [matches, activeMatchIndex]);

	// Navigation
	const gotoNextMatch = useCallback(() => {
		if (matches.length === 0) return;
		setActiveMatchIndex((i) => (i + 1) % matches.length);
	}, [matches]);

	const gotoPrevMatch = useCallback(() => {
		if (matches.length === 0) return;
		setActiveMatchIndex((i) => (i - 1 + matches.length) % matches.length);
	}, [matches]);

	// Auto-scroll active match into view
	useEffect(() => {
		if (!scrollIntoView || !activeMatch) return;
		const { rowId, columnId } = activeMatch;
		const key = `${rowId}|${columnId}`;
		const el = document.querySelector(
			`[data-cell="${key}"]`,
		) as HTMLElement | null;
		el?.scrollIntoView({
			block: "center",
			inline: "nearest",
			behavior: "smooth",
		});
	}, [activeMatch, scrollIntoView]);

	return {
		matches,
		matchKeys,
		activeMatchIndex,
		activeMatch,
		gotoNextMatch,
		gotoPrevMatch,
		setActiveMatchIndex,
	} as const;
}
