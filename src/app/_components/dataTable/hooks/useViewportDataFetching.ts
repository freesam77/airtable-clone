import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";
import type { TableData } from "~/types/dataTable";

interface UseViewportDataFetchingParams {
	tableId: string;
	totalRowCount: number;
	existingData: TableData[];
}

interface DataWindow {
	start: number;
	end: number;
	data: TableData[];
	loading: boolean;
}

export function useViewportDataFetching({
	tableId,
	totalRowCount,
	existingData,
}: UseViewportDataFetchingParams) {
	// Track loaded data windows
	const [dataWindows, setDataWindows] = useState<Map<number, DataWindow>>(new Map());
	const [isLoading, setIsLoading] = useState(false);
	const loadingRanges = useRef<Set<string>>(new Set());

	const utils = api.useUtils();

	// Track pending fetch promises to enable awaiting
	const pendingFetches = useRef<Map<string, Promise<void>>>(new Map());

	// Function to fetch a specific range of data
	const fetchRange = useCallback(async (startIndex: number, endIndex: number) => {
		const rangeKey = `${startIndex}-${endIndex}`;
		
		// If already fetching, return the existing promise
		if (loadingRanges.current.has(rangeKey) && pendingFetches.current.has(rangeKey)) {
			console.log(`Already fetching range ${rangeKey}, waiting for completion`);
			await pendingFetches.current.get(rangeKey);
			return;
		}

		console.log(`Starting fetch for range ${rangeKey}`);
		loadingRanges.current.add(rangeKey);
		setIsLoading(true);
		
		const fetchPromise = (async () => {
			try {
				const limit = endIndex - startIndex + 1;
				console.log(`Calling API: offset=${startIndex}, limit=${Math.min(limit, 500)}`);
				
				const result = await utils.table.getRowsByRange.fetch({
					id: tableId,
					offset: startIndex,
					limit: Math.min(limit, 500), // API limit
				});

				console.log(`Fetch successful: got ${result.items.length} items for range ${startIndex}-${startIndex + result.items.length - 1}`);

				setDataWindows(prev => {
					const newMap = new Map(prev);
					newMap.set(startIndex, {
						start: startIndex,
						end: startIndex + result.items.length - 1,
						data: result.items,
						loading: false,
					});
					console.log(`Updated dataWindows, now have ${newMap.size} windows covering ranges:`, 
						Array.from(newMap.values()).map(w => `${w.start}-${w.end}`));
					return newMap;
				});
			} catch (error) {
				console.error("Failed to fetch viewport range:", error);
			} finally {
				loadingRanges.current.delete(rangeKey);
				pendingFetches.current.delete(rangeKey);
				if (loadingRanges.current.size === 0) {
					setIsLoading(false);
				}
			}
		})();

		pendingFetches.current.set(rangeKey, fetchPromise);
		await fetchPromise;
	}, [tableId, utils.table.getRowsByRange]);

	// Get data for current viewport with aggressive prefetching
	const ensureViewportData = useCallback((firstVisible: number, lastVisible: number) => {
		console.log(`ensureViewportData called: ${firstVisible}-${lastVisible}, total: ${totalRowCount}`);
		
		const bufferSize = 100; // Buffer above and below viewport
		const fetchStart = Math.max(0, firstVisible - bufferSize);
		const fetchEnd = Math.min(totalRowCount - 1, lastVisible + bufferSize);

		// Check if we have data for this range
		let needsFetch = false;
		let missingRanges: { start: number; end: number }[] = [];
		let currentMissingStart = -1;
		
		for (let i = fetchStart; i <= fetchEnd; i++) {
			const hasData = existingData[i] || Array.from(dataWindows.values()).some(
				window => i >= window.start && i <= window.end
			);
			if (!hasData) {
				if (currentMissingStart === -1) {
					currentMissingStart = i;
				}
				needsFetch = true;
			} else {
				if (currentMissingStart !== -1) {
					missingRanges.push({ start: currentMissingStart, end: i - 1 });
					currentMissingStart = -1;
				}
			}
		}
		
		// Handle case where missing range extends to the end
		if (currentMissingStart !== -1) {
			missingRanges.push({ start: currentMissingStart, end: fetchEnd });
		}

		console.log(`Data check: needsFetch=${needsFetch}, existingData.length=${existingData.length}, dataWindows.size=${dataWindows.size}`);

		if (needsFetch && missingRanges.length > 0) {
			// Fetch the most critical missing range (containing the viewport center)
			const viewportCenter = Math.floor((firstVisible + lastVisible) / 2);
			let targetRange = missingRanges[0]!; // We know missingRanges.length > 0
			
			// Find the missing range that contains or is closest to the viewport center
			for (const range of missingRanges) {
				if (viewportCenter >= range.start && viewportCenter <= range.end) {
					targetRange = range;
					break;
				}
				if (Math.abs(range.start - viewportCenter) < Math.abs(targetRange.start - viewportCenter)) {
					targetRange = range;
				}
			}
			
			// Calculate optimal fetch range that covers the target range
			const chunkSize = 200;
			const chunkStart = Math.floor(targetRange.start / chunkSize) * chunkSize;
			const chunkEnd = Math.min(totalRowCount - 1, chunkStart + chunkSize - 1);
			
			console.log(`Fetching chunk for missing range ${targetRange.start}-${targetRange.end}: ${chunkStart}-${chunkEnd}`);
			fetchRange(chunkStart, chunkEnd);
		}
	}, [existingData, dataWindows, totalRowCount, fetchRange]);

	// Get row at specific index with fallback to placeholder
	const getRowAtIndex = useCallback((index: number): TableData | null => {
		// First check existing data
		if (existingData[index]) {
			return existingData[index];
		}

		// Then check data windows
		for (const window of dataWindows.values()) {
			if (index >= window.start && index <= window.end) {
				const localIndex = index - window.start;
				return window.data[localIndex] || null;
			}
		}

		return null; // Return null for placeholder rendering
	}, [existingData, dataWindows]);

	// Check if data is loading for viewport
	const isViewportLoading = useCallback((firstVisible: number, lastVisible: number) => {
		return loadingRanges.current.size > 0;
	}, []);

	// Clear all cached viewport data
	const clearViewportCache = useCallback(() => {
		console.log('Clearing viewport cache');
		setDataWindows(new Map());
		loadingRanges.current.clear();
		pendingFetches.current.clear();
		setIsLoading(false);
	}, []);

	// Calculate total rows loaded across all windows
	const totalViewportRowsLoaded = useMemo(() => {
		let totalRows = 0;
		for (const window of dataWindows.values()) {
			totalRows += window.data.length;
		}
		return totalRows;
	}, [dataWindows]);

	return {
		ensureViewportData,
		getRowAtIndex,
		isViewportLoading,
		clearViewportCache,
		loadedWindows: dataWindows.size,
		totalViewportRowsLoaded,
		isLoading,
	};
}