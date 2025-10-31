"use client";

import { Plus } from "lucide-react";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { api } from "~/trpc/react";
import { AppSidebar } from "../app-sidebar";
import { DataTable } from "../data-table";
import { TopNav } from "./topNav";

interface DashboardLayoutProps {
	user: Session["user"];
	initialBaseId?: string;
	initialTableId?: string;
}

export function BaseLayout({
	user,
	initialBaseId,
	initialTableId,
}: DashboardLayoutProps) {
	const router = useRouter();
	const [rowCount, setRowCount] = useState(5);
	const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
	const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
	const [showCreateTable, setShowCreateTable] = useState(false);
	const [newTableName, setNewTableName] = useState("");

	const { base, table } = api;

	const {
		data: bases,
		isLoading: basesLoading,
		refetch: refetchBases,
	} = base.getAll.useQuery(undefined, {
		retry: (failureCount, error) => {
			if (error?.data?.code === "UNAUTHORIZED") {
				return false;
			}
			return failureCount < 3;
		},
	});

	const generateRows = table.generateRows.useMutation({
		onSuccess: () => {
			void refetchBases();
		},
	});

	const createTable = base.createTable.useMutation({
		onSuccess: (newTable) => {
			void refetchBases();
			setSelectedTableId(newTable.id);
			setShowCreateTable(false);
			setNewTableName("");
			// Navigate to the new table
			if (selectedBaseId) {
				router.push(`/${selectedBaseId}/${newTable.id}`);
			}
		},
	});

	// Auto-select base and table from URL params or fallback to first available
	useEffect(() => {
		if (bases && bases.length > 0) {
			// If URL params are provided, use them
			if (initialBaseId && !selectedBaseId) {
				const baseFromUrl = bases.find((base) => base.id === initialBaseId);
				if (baseFromUrl) {
					setSelectedBaseId(baseFromUrl.id);

					if (initialTableId) {
						const tableFromUrl = baseFromUrl.tables.find(
							(table) => table.id === initialTableId,
						);
						if (tableFromUrl) {
							setSelectedTableId(tableFromUrl.id);
						} else if (baseFromUrl.tables.length > 0) {
							// Fallback to first table if specified table not found
							const firstTable = baseFromUrl.tables[0];
							if (firstTable) {
								setSelectedTableId(firstTable.id);
							}
						}
					} else if (baseFromUrl.tables.length > 0) {
						// No table specified, use first table
						const firstTable = baseFromUrl.tables[0];
						if (firstTable) {
							setSelectedTableId(firstTable.id);
						}
					}
				}
			}
			// Fallback to first base if no URL params or base not found
			else if (!selectedBaseId && bases.length > 0) {
				const firstBase = bases[0];
				if (firstBase) {
					setSelectedBaseId(firstBase.id);
					const firstTable = firstBase.tables[0];
					if (firstTable) {
						setSelectedTableId(firstTable.id);
					}
				}
			}
		}
	}, [bases, selectedBaseId, initialBaseId, initialTableId]);

	// Get the selected table
	const selectedBase = bases?.find((base) => base.id === selectedBaseId);
	const currentTable = selectedBase?.tables.find(
		(table) => table.id === selectedTableId,
	);

	const handleGenerateRows = () => {
		if (currentTable) {
			generateRows.mutate({
				tableId: currentTable.id,
				count: rowCount,
			});
		}
	};

	const handleBaseSelect = (baseId: string) => {
		setSelectedBaseId(baseId);
		const base = bases?.find((b) => b.id === baseId);
		if (base && base.tables.length > 0) {
			const firstTable = base.tables[0];
			if (firstTable) {
				const firstTableId = firstTable.id;
				setSelectedTableId(firstTableId);
				// Navigate to the new base/table URL
				router.push(`/${baseId}/${firstTableId}`);
			} else {
				setSelectedTableId(null);
			}
		} else {
			setSelectedTableId(null);
		}
	};

	const handleTableSelect = (tableId: string) => {
		setSelectedTableId(tableId);
		// Navigate to the new base/table URL
		if (selectedBaseId) {
			router.push(`/${selectedBaseId}/${tableId}`);
		}
	};

	const handleCreateTable = () => {
		if (newTableName.trim() && selectedBaseId) {
			createTable.mutate({
				baseId: selectedBaseId,
				name: newTableName.trim(),
				description: `Table in ${selectedBase?.name}`,
				columns: [
					{ name: "Name", type: "TEXT" as const, position: 0, required: false },
					{
						name: "Notes",
						type: "TEXT" as const,
						position: 1,
						required: false,
					},
				],
			});
		}
	};

	if (basesLoading) {
		return (
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<div className="flex h-screen flex-1 items-center justify-center">
						<div className="text-gray-500">Loading...</div>
					</div>
				</SidebarInset>
			</SidebarProvider>
		);
	}

	if (!selectedBase) {
		return (
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<div className="flex h-screen flex-1 items-center justify-center">
						<div className="text-gray-500">No bases found.</div>
					</div>
				</SidebarInset>
			</SidebarProvider>
		);
	}

	if (!currentTable) {
		return (
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<div className="flex h-screen flex-1 items-center justify-center">
						<div className="text-gray-500">
							No table selected. Please select a table from the sidebar.
						</div>
					</div>
				</SidebarInset>
			</SidebarProvider>
		);
	}

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
										{selectedBase.name}
									</h1>
									{selectedBase.description && (
										<p className="text-gray-500 text-sm">
											{selectedBase.description}
										</p>
									)}
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
											{generateRows.isPending
												? "Generating..."
												: "Generate Rows"}
										</button>
									</div>
								</div>
							</div>
						</div>

						{/* Table tabs */}
						<div className="border-gray-200 border-b bg-gray-50 px-6">
							<div className="flex items-center gap-1">
								{selectedBase.tables.map((table) => (
									<button
										type="button"
										key={table.id}
										onClick={() => handleTableSelect(table.id)}
										className={`rounded-t border-x border-t px-3 py-2 font-medium text-sm ${
											selectedTableId === table.id
												? "border-gray-300 bg-white text-gray-900"
												: "border-transparent bg-transparent text-gray-600 hover:text-gray-900"
										}`}
									>
										{table.name}
									</button>
								))}
								{showCreateTable ? (
									<div className="ml-2 flex items-center gap-2">
										<input
											type="text"
											placeholder="Table name"
											value={newTableName}
											onChange={(e) => setNewTableName(e.target.value)}
											className="rounded border border-gray-300 px-2 py-1 text-sm"
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													handleCreateTable();
												} else if (e.key === "Escape") {
													setShowCreateTable(false);
													setNewTableName("");
												}
											}}
											autoFocus
										/>
										<button
											type="button"
											onClick={handleCreateTable}
											disabled={!newTableName.trim() || createTable.isPending}
											className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
										>
											Add
										</button>
										<button
											type="button"
											onClick={() => {
												setShowCreateTable(false);
												setNewTableName("");
											}}
											className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-600 text-sm hover:bg-gray-50"
										>
											Cancel
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setShowCreateTable(true)}
										className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-gray-600 text-sm hover:bg-gray-50"
									>
										<Plus size={14} />
									</button>
								)}
							</div>
						</div>
					</div>

					{/* Main Content */}
					<div className="flex-1 p-6">
						<DataTable
							tableId={currentTable.id}
						/>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
