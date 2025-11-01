"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { api } from "~/trpc/react";
import { AppSidebar } from "../app-sidebar";
import { DataTable } from "../data-table";
import { TopNav } from "./topNav";

interface DashboardLayoutProps {
	initialBaseId?: string;
	initialTableId?: string;
}

export function BaseLayout({
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

	// Base selection handled via URL params and sidebar

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
					<TopNav
						selectedBase={selectedBase}
						rowCount={rowCount}
						setRowCount={setRowCount}
						handleGenerateRows={handleGenerateRows}
						generateRows={generateRows}
						selectedTableId={selectedTableId}
						handleTableSelect={handleTableSelect}
						showCreateTable={showCreateTable}
						setShowCreateTable={setShowCreateTable}
						newTableName={newTableName}
						setNewTableName={setNewTableName}
						handleCreateTable={handleCreateTable}
						createTable={createTable}
					/>

					{/* Main Content */}
					<div className="flex-1 p-6">
						<DataTable tableId={currentTable.id} />
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
