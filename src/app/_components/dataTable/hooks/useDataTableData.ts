import { useCallback, useEffect, useMemo, useState } from "react";
import {
	BULK_JOB_COMPLETED_EVENT,
	BULK_JOB_STARTED_EVENT,
	type BulkJobCompletedDetail,
	type BulkJobStartDetail,
} from "~/lib/bulkJobEvents";
import { api } from "~/trpc/react";
import type { TableData } from "~/types/dataTable";
import { MAX_CACHED_PAGES } from "../utils/constants";
import { buildOptimisticRows } from "../utils/dataGenerationUtils";

interface UseDataTableDataParams {
	tableId: string;
	pageSize: number;
}

export function useDataTableData({
	tableId,
	pageSize,
}: UseDataTableDataParams) {
	const [optimisticRows, setOptimisticRows] = useState<TableData[]>([]);

	const utils = api.useUtils();

	// Fetch table metadata for columns
	const { data: tableColumn, isLoading: tableColumnLoading } =
		api.table.getTableColumnType.useQuery(
			{ id: tableId },
			{
				retry: (failureCount, error) => {
					if (error?.data?.code === "UNAUTHORIZED") {
						return false;
					}
					return failureCount < 3;
				},
			},
		);

	const { data: rowCountData } = api.table.getRowCount.useQuery(
		{ id: tableId },
		{
			retry: (failureCount, error) => {
				if (error?.data?.code === "UNAUTHORIZED") {
					return false;
				}
				return failureCount < 3;
			},
		},
	);

	const infiniteQueryInput = useMemo(() => {
		const input: Parameters<
			typeof api.table.getInfiniteRows.useInfiniteQuery
		>[0] = {
			id: tableId,
			limit: pageSize,
		};
		return input;
	}, [tableId, pageSize]);

	const rowsInfinite = api.table.getInfiniteRows.useInfiniteQuery(
		infiniteQueryInput,
		{
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			getPreviousPageParam: (firstPage) => firstPage.prevCursor,
		},
	);

	useEffect(() => {
		utils.table.getInfiniteRows.setInfiniteData(infiniteQueryInput, (old) => {
			if (!old || old.pages.length <= MAX_CACHED_PAGES) return old;
			const start = old.pages.length - MAX_CACHED_PAGES;
			return {
				...old,
				pages: old.pages.slice(start),
				pageParams: old.pageParams.slice(start),
			};
		});
	}, [
		rowsInfinite.dataUpdatedAt,
		infiniteQueryInput,
		utils.table.getInfiniteRows,
	]);

	// Flatten paged rows for the table
	const data = useMemo(
		() => rowsInfinite.data?.pages.flatMap((p) => p.items) ?? [],
		[rowsInfinite.data],
	);

	const columns = tableColumn?.columns || [];

	// Stable ordered columns list used for filtering and match navigation
	const orderedColumns = useMemo(
		() => [...columns].sort((a, b) => a.position - b.position),
		[columns],
	);

	const { refetch: refetchRows } = rowsInfinite;

	// Handle optimistic row events
	useEffect(() => {
		const handleJobStart = (event: Event) => {
			const detail = (event as CustomEvent<BulkJobStartDetail>).detail;
			if (!detail || detail.tableId !== tableId) return;
			if (!orderedColumns.length) return;
			const optimistic = buildOptimisticRows({
				columns: orderedColumns,
				count: detail.count,
				startPosition: detail.startRowCount,
				tableId,
				jobId: detail.jobId,
			});
			setOptimisticRows((prev) => [
				...prev.filter((row) => row.id !== detail.jobId),
				...optimistic,
			]);
		};

		const handleJobComplete = (event: Event) => {
			const detail = (event as CustomEvent<BulkJobCompletedDetail>).detail;
			if (!detail || detail.tableId !== tableId) return;
			setOptimisticRows((prev) =>
				prev.filter((row) => row.id !== detail.jobId),
			);
			refetchRows();
			utils.table.getTableColumnType.invalidate({ id: tableId });
			utils.table.getRowCount.invalidate({ id: tableId });
		};

		window.addEventListener(
			BULK_JOB_STARTED_EVENT,
			handleJobStart as EventListener,
		);
		window.addEventListener(
			BULK_JOB_COMPLETED_EVENT,
			handleJobComplete as EventListener,
		);

		return () => {
			window.removeEventListener(
				BULK_JOB_STARTED_EVENT,
				handleJobStart as EventListener,
			);
			window.removeEventListener(
				BULK_JOB_COMPLETED_EVENT,
				handleJobComplete as EventListener,
			);
		};
	}, [
		orderedColumns,
		tableId,
		refetchRows,
		utils.table.getTableColumnType,
		utils.table.getRowCount,
	]);

	// Optimistic update function for immediate UI feedback
	const handleOptimisticUpdate = useCallback(
		(rowId: string, columnId: string, value?: string | number) => {
			const stringValue = typeof value === "number" ? String(value) : value;
			const normalized = stringValue === "" ? null : stringValue;
			utils.table.getInfiniteRows.setInfiniteData(infiniteQueryInput, (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						items: page.items.map((row) =>
							row.id === rowId
								? {
										...row,
										cells: row.cells.map((cell) =>
											cell.columnId === columnId
												? { ...cell, value: normalized ?? null }
												: cell,
										),
									}
								: row,
						),
					})),
				};
			});
		},
		[utils.table.getInfiniteRows, infiniteQueryInput],
	);

	return {
		data,
		columns,
		orderedColumns,
		optimisticRows,
		tableColumn,
		tableColumnLoading,
		rowCountData,
		infiniteQueryInput,
		rowsInfinite,
		utils,
		handleOptimisticUpdate,
	};
}
