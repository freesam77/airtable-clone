"use client";

import { Plus } from "lucide-react";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { DataTable } from "./data-table";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarInset } from "~/components/ui/sidebar";

interface BaseLayoutProps {
	user: Session["user"];
	selectedTableId: string;
	selectedBaseId: string;
}

export function BaseLayout({ user, selectedTableId, selectedBaseId }: BaseLayoutProps) {
	const router = useRouter();
	const [rowCount, setRowCount] = useState(5);

	const utils = api.useUtils();

	const generateRows = api.table.generateRows.useMutation({
		onSuccess: () => {
			utils.table.getById.invalidate({ id: selectedTableId });
		},
	});

	const handleGenerateRows = () => {
		generateRows.mutate({
			tableId: selectedTableId,
			count: rowCount,
		});
	};

	const handleTableSelect = (tableId: string) => {
		// Navigate to the new base/table URL
		router.push(`/${selectedBaseId}/${tableId}`);
	};

	// Note: Table creation should be handled by parent component or separate page

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<div className="flex h-screen flex-1 flex-col bg-gray-50">
					{/* Top Navigation Bar */}
					<div className="border-gray-200 border-b bg-white">
						{/* Base name and description */}
						<div className="px-6 py-3">
							<div className="flex items-center justify-between">
								<div>
									<h1 className="font-semibold text-gray-900 text-xl">
										Table View
									</h1>
								</div>
								<div className="flex items-center gap-3">
									<div className="flex items-center gap-2">
										<input
											type="number"
											value={rowCount}
											onChange={(e) =>
												setRowCount(
													Math.max(
														1,
														Math.min(100, Number.parseInt(e.target.value) || 1),
													),
												)
											}
											className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
											min="1"
											max="100"
										/>
										<button
											type="button"
											onClick={handleGenerateRows}
											disabled={generateRows.isPending}
											className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 font-medium text-sm text-white hover:bg-green-700 disabled:opacity-50"
										>
											<Plus size={16} />
											{generateRows.isPending ? "Generating..." : "Generate Rows"}
										</button>
									</div>
								</div>
							</div>
						</div>

					</div>

					{/* Main Content */}
					<div className="flex-1 p-6">
						<DataTable tableId={selectedTableId} />
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
