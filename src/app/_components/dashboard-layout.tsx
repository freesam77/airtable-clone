"use client";

import { ArrowUpDown, Filter, Group, Palette, Plus } from "lucide-react";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { api } from "~/trpc/react";
import { DataTable } from "./data-table";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
	user: Session["user"];
}

export function DashboardLayout({ user }: DashboardLayoutProps) {
	const [rowCount, setRowCount] = useState(5);
	const { data: tables, isLoading, refetch } = api.table.getAll.useQuery(undefined, {
		retry: (failureCount, error) => {
			// Don't retry if it's an auth error
			if (error?.data?.code === "UNAUTHORIZED") {
				return false;
			}
			return failureCount < 3;
		},
	});
	const generateRows = api.table.generateRows.useMutation({
		onSuccess: () => {
			void refetch();
		},
	});

	const getUserInitials = (name: string | null | undefined) => {
		if (!name) return "U";
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	// Get the first table for now (in a real app, you'd have table selection)
	const currentTable = tables?.[0];

	const handleGenerateRows = () => {
		if (currentTable) {
			generateRows.mutate({
				tableId: currentTable.id,
				count: rowCount,
			});
		}
	};

	const handleSignOut = () => {
		signOut({ callbackUrl: "/" });
	};

	if (isLoading) {
		return (
			<div className="flex h-screen bg-gray-50">
				<Sidebar user={user} />
				<div className="flex flex-1 items-center justify-center">
					<div className="text-gray-500">Loading...</div>
				</div>
			</div>
		);
	}

	if (!currentTable) {
		return (
			<div className="flex h-screen bg-gray-50">
				<Sidebar user={user} />
				<div className="flex flex-1 items-center justify-center">
					<div className="text-gray-500">No tables found.</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen bg-gray-50">
			<Sidebar user={user} />

			<div className="flex flex-1 flex-col">
				{/* Top Navigation Bar */}
				<div className="border-gray-200 border-b bg-white px-6 py-3">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-xl font-semibold text-gray-900">
								{currentTable.name}
							</h1>
							{currentTable.description && (
								<p className="text-sm text-gray-500">{currentTable.description}</p>
							)}
						</div>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-2">
								<input
									type="number"
									value={rowCount}
									onChange={(e) => setRowCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
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
							<button
								type="button"
								onClick={handleSignOut}
								className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-sm text-white hover:bg-blue-700"
							>
								Log out
							</button>
						</div>
					</div>
				</div>

				{/* Main Content */}
				<div className="flex-1 p-6">
					<div className="mb-4 flex items-center justify-between">
						<div className="flex items-center gap-4">
							<button type="button" className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<Filter size={16} />
								Hide fields
							</button>
							<button type="button" className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<Filter size={16} />
								Filter
							</button>
							<button type="button" className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<Group size={16} />
								Group
							</button>
							<button type="button" className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<ArrowUpDown size={16} />
								Sort
							</button>
							<button type="button" className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<Palette size={16} />
								Color
							</button>
						</div>
					</div>

					<DataTable
						tableId={currentTable.id}
						data={currentTable.rows}
						columns={currentTable.columns}
					/>
				</div>
			</div>
		</div>
	);
}
