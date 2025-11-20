import { memo } from "react";

interface DataTableStatusBarProps {
	footerRowCount: number;
	showApproximate: boolean;
	loadedCount?: number;
	isLoading?: boolean;
}

export const DataTableStatusBar = memo(function DataTableStatusBar({
	footerRowCount,
	showApproximate,
	loadedCount,
	isLoading,
}: DataTableStatusBarProps) {
	const showLoadingInfo = loadedCount && loadedCount < footerRowCount;

	return (
		<div className="w-full border-t bg-white p-4 pl-3 text-xs">
			<span className="flex items-center gap-2">
				<>
					{footerRowCount.toLocaleString()}
					<span className="text-gray-500">{`( ${loadedCount?.toLocaleString()} loaded )`}</span>
					{showLoadingInfo && isLoading && (
						<div className="flex items-center gap-1">
							<div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
							<span className="text-blue-600">Loading more records...</span>
						</div>
					)}
				</>
			</span>
		</div>
	);
});
