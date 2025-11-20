import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useState } from "react";
import type { TableData } from "~/types/dataTable";
import {
	MAX_PAGE_SIZE,
	MIN_PAGE_SIZE,
	NEXT_PAGE_FETCH_THRESHOLD,
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
}

export function useDataTableVirtualization({
	rowsWithOptimistic,
	showCheckboxes,
	scrollParentRef,
	rowsInfinite,
	setPageSize,
}: UseDataTableVirtualizationParams) {
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

	const filteredRowsCount = rowsInfinite.hasNextPage
		? rowsWithOptimistic.length + 1
		: rowsWithOptimistic.length;

	const rowVirtualizer = useVirtualizer({
		count: filteredRowsCount,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 10,
		getItemKey: (index) => {
			const row = rowsWithOptimistic[index];
			return `${row?.id ?? `loader-${index}`}-${
				showCheckboxes ? "checkbox" : "row-number"
			}`;
		},
		onChange: (instance) => {
			updatePageSize();
			const vItems = instance.getVirtualItems();
			if (!vItems.length) return;
			const last = vItems[vItems.length - 1];
			if (!last) return;

			const totalLoadedRows = rowsWithOptimistic.length;

			if (totalLoadedRows > 0) {
				const latestIndex = totalLoadedRows - 1;
				const prefetchThreshold = Math.max(
					latestIndex - NEXT_PAGE_FETCH_THRESHOLD,
					0,
				);
				const crossedPrefetchThreshold = last.index >= prefetchThreshold;
				const loaderIndex = totalLoadedRows;
				const loaderVisible = last.index >= loaderIndex;
				if (
					crossedPrefetchThreshold &&
					loaderVisible &&
					rowsInfinite.hasNextPage &&
					!rowsInfinite.isFetchingNextPage
				) {
					rowsInfinite.fetchNextPage();
				}
			}
		},
	});

	return {
		rowVirtualizer,
		filteredRowsCount,
		updatePageSize,
	};
}
