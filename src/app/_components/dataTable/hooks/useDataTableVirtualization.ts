import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import type { TableData } from "~/types/dataTable";
import {
	MAX_PAGE_SIZE,
	MIN_PAGE_SIZE,
	ROW_HEIGHT,
} from "../utils/constants";

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

interface UseDataTableVirtualizationParams {
	rowsWithOptimistic: TableData[];
	showCheckboxes: boolean;
	scrollParentRef: React.RefObject<HTMLDivElement | null>;
	rowsInfinite: any;
	setPageSize: React.Dispatch<React.SetStateAction<number>>;
	totalRowCount?: number; // Total count of all rows in the table
	totalLoadedRowCount?: number; // Total count of loaded rows (including viewport data)
	viewportFetching?: {
		ensureViewportData: (firstVisible: number, lastVisible: number) => void;
		getRowAtIndex: (index: number) => TableData | null;
		isViewportLoading: (firstVisible: number, lastVisible: number) => boolean;
	};
}

export function useDataTableVirtualization({
	rowsWithOptimistic,
	showCheckboxes,
	scrollParentRef,
	rowsInfinite,
	setPageSize,
	totalRowCount,
	totalLoadedRowCount,
	viewportFetching,
}: UseDataTableVirtualizationParams) {
	// Track current viewport position for scroll-responsive fetching
	const lastViewportRef = useRef({ start: 0, end: 0 });
	const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const updatePageSize = useCallback(() => {
		const height = scrollParentRef.current?.clientHeight ?? 0;
		if (!height) return;
		const target = clamp(
			Math.ceil(height / ROW_HEIGHT) * 2,
			MIN_PAGE_SIZE,
			MAX_PAGE_SIZE,
		);
		setPageSize((prev) => (prev === target ? prev : target));
	}, [scrollParentRef, setPageSize]);

	useEffect(() => {
		updatePageSize();
	}, [updatePageSize]);

	// Use total row count for proper virtualization, fallback to loaded data
	const virtualRowCount = totalRowCount ?? rowsWithOptimistic.length;
	const loadedRowsCount = totalLoadedRowCount ?? rowsWithOptimistic.length;
	const filteredRowsCount = virtualRowCount; // For compatibility

	const rowVirtualizer = useVirtualizer({
		count: virtualRowCount,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 20, // Increased for better performance with placeholders
		getItemKey: (index) => {
			const row = rowsWithOptimistic[index];
			return `${row?.id ?? `placeholder-${index}`}-${
				showCheckboxes ? "checkbox" : "row-number"
			}`;
		},
		onChange: (instance) => {
			updatePageSize();
			const vItems = instance.getVirtualItems();
			if (!vItems.length) return;

			const firstVisibleIndex = vItems[0]?.index ?? 0;
			const lastVisibleIndex = vItems[vItems.length - 1]?.index ?? 0;
			const currentViewport = { start: firstVisibleIndex, end: lastVisibleIndex };

			// Check if user has scrolled significantly (viewport-responsive fetching)
			const previousViewport = lastViewportRef.current;
			const viewportChanged = Math.abs(currentViewport.start - previousViewport.start) > 10 ||
								  Math.abs(currentViewport.end - previousViewport.end) > 10;

			// Update viewport tracking
			lastViewportRef.current = currentViewport;

			// Clear any pending fetch if viewport changed significantly
			if (viewportChanged && fetchTimeoutRef.current) {
				clearTimeout(fetchTimeoutRef.current);
				fetchTimeoutRef.current = null;
			}

			// Use viewport-specific fetching for immediate data where user is looking
			if (viewportFetching && totalRowCount && firstVisibleIndex < totalRowCount) {
				// Always ensure viewport data is available, especially on significant viewport changes
				viewportFetching.ensureViewportData(firstVisibleIndex, lastVisibleIndex);
				
				// Log for debugging
				if (viewportChanged) {
					console.log(`Viewport changed: fetching data for rows ${firstVisibleIndex}-${lastVisibleIndex}`);
				}
			}

			// Fallback: Continue infinite scrolling for sequential data loading
			if (loadedRowsCount > 0 && !viewportFetching) {
				const bufferSize = 50;
				const criticalEndIndex = lastVisibleIndex + bufferSize;
				const urgentFetch = criticalEndIndex >= loadedRowsCount - 25;
				
				if (urgentFetch && rowsInfinite.hasNextPage && !rowsInfinite.isFetchingNextPage) {
					const fetchDelay = viewportChanged ? 0 : 100;
					
					if (fetchDelay === 0) {
						rowsInfinite.fetchNextPage();
					} else {
						fetchTimeoutRef.current = setTimeout(() => {
							if (rowsInfinite.hasNextPage && !rowsInfinite.isFetchingNextPage) {
								rowsInfinite.fetchNextPage();
							}
						}, fetchDelay);
					}
				}
			}
		},
	});

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (fetchTimeoutRef.current) {
				clearTimeout(fetchTimeoutRef.current);
			}
		};
	}, []);

	return {
		rowVirtualizer,
		filteredRowsCount,
		loadedRowsCount,
		totalRowCount: virtualRowCount,
		updatePageSize,
	};
}
