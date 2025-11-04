"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { DataTable } from "../dataTable";
import { TopNav } from "./topNav";
import { Database } from "lucide-react";
import { Button } from "~/components/ui/button";

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
			if (newTable?.id) setSelectedTableId(newTable.id);
			setShowCreateTable(false);
			setNewTableName("");
			// Navigate to the new table
			if (selectedBaseId) {
				if (newTable?.id) router.push(`/${selectedBaseId}/${newTable.id}`);
			}
		},
	});

	// Sync selected base/table with URL params, and fall back sensibly
	useEffect(() => {
		// 1) Keep state in sync with route params when they change
		if (initialBaseId && selectedBaseId !== initialBaseId) {
			setSelectedBaseId(initialBaseId);
		}
		if (initialTableId && selectedTableId !== initialTableId) {
			setSelectedTableId(initialTableId);
		}

		if (!bases || bases.length === 0) return;

		// 2) If base still unset, pick the first available
		if (!initialBaseId && !selectedBaseId) {
			const firstBase = bases[0];
			if (firstBase) setSelectedBaseId(firstBase.id);
		}

		// 3) If table still unset (no param and no selection), pick the first in active base
		const activeBaseId = selectedBaseId ?? initialBaseId ?? null;
		if (!initialTableId && !selectedTableId && activeBaseId) {
			const baseObj = bases.find((b) => b.id === activeBaseId);
			const firstTable = baseObj?.tables[0];
			if (firstTable) setSelectedTableId(firstTable.id);
		}
	}, [bases, selectedBaseId, selectedTableId, initialBaseId, initialTableId]);

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
		// Avoid redundant state updates and navigations
		if (selectedTableId === tableId) return;
		setSelectedTableId(tableId);
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

	return (
		<div className="flex h-full">
			<div className="flex w-15 justify-center border pt-5">
				<Button
					className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
					onClick={() => router.push("/dashboard")}
				>
					<Database className="h-4 w-4 cursor-pointer" />
				</Button>
			</div>
			<div>
				{/* Inline conditional content */}
				{basesLoading ? (
					<div className="flex h-screen flex-1 items-center justify-center">
						<div className="text-gray-500">Loading...</div>
					</div>
				) : !selectedBase ? (
					<div className="flex h-screen flex-1 items-center justify-center">
						<div className="text-gray-500">No bases found.</div>
					</div>
				) : !currentTable ? (
					<div className="flex h-screen flex-1 items-center justify-center">
						<div className="text-gray-500">
							{initialTableId
								? "Preparing your table…"
								: "No table selected. Please select a table from the sidebar."}
						</div>
					</div>
				) : (
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
				)}
			</div>
		</div>
	);
}
