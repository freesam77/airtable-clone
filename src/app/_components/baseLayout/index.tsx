"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { DataTable } from "../dataTable";
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
	const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
	const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
	const [newTableName, setNewTableName] = useState("");

	const { base } = api;

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

	const createTable = base.createTable.useMutation({
		onSuccess: (newTable) => {
			void refetchBases();
			if (newTable?.id) setSelectedTableId(newTable.id);
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

	// bulkAddRows mutation and handlers moved to TopNav

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
		<div className="flex">
			<div className="relative z-50 flex w-16 shrink-0 items-start justify-center border-r bg-white pt-5">
				<Image
					src="/airtable-logo.svg"
					className="h-6 cursor-pointer"
					width={30}
					height={10}
					onClick={() => router.push("/dashboard")}
					alt={"Home"}
				/>
			</div>
			<div className="w-full">
				{/* Inline conditional content */}
				<div className="flex h-screen flex-1 flex-col bg-gray-50">
					{basesLoading ? (
						<div className="text-gray-500">Loading...</div>
					) : !selectedBase ? (
						<div className="text-gray-500">No bases found.</div>
					) : !currentTable ? (
						<div className="text-gray-500">
							{initialTableId
								? "Preparing your table…"
								: "No table selected. Please select a table from the sidebar."}
						</div>
					) : (
						<>
							<TopNav
								selectedBase={selectedBase}
								selectedTableId={selectedTableId}
								handleTableSelect={handleTableSelect}
								newTableName={newTableName}
								setNewTableName={setNewTableName}
								handleCreateTable={handleCreateTable}
								createTable={createTable}
							/>

							<DataTable tableId={currentTable.id} />
						</>
					)}
				</div>
			</div>
		</div>
	);
}
