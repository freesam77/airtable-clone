import { memo } from "react";

interface DataTableStatusBarProps {
	footerRowCount: number;
	showApproximate: boolean;
}

export const DataTableStatusBar = memo(function DataTableStatusBar({
	footerRowCount,
	showApproximate,
}: DataTableStatusBarProps) {
	return (
		<div className="w-full border-t bg-white p-4 pl-3 text-xs">
			<span>
				{footerRowCount.toLocaleString()}
				{showApproximate ? "+" : ""} records
			</span>
		</div>
	);
});
