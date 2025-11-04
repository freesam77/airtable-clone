"use client";
import { useEffect, useRef, useState } from "react";
import {
	Plus,
	Folder,
	ChevronDown,
	ChevronRight,
	Star,
	ExternalLink,
	MoreHorizontal,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Check, Search, LayoutGrid, ChevronDown as SmallChevronDown } from "lucide-react";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { api } from "~/trpc/react";
import { showToast } from "~/components/ui/toast";

type Table = { id: string; name: string };
type Base = {
	id: string;
	name: string;
	description?: string | null;
	tables: Table[];
};

interface TopNavProps {
	selectedBase: Base;
	rowCount: number;
	setRowCount: (value: number) => void;
	handleGenerateRows: () => void;
	generateRows: { isPending: boolean };
	selectedTableId: string | null;
	handleTableSelect: (tableId: string) => void;
	showCreateTable: boolean;
	setShowCreateTable: (show: boolean) => void;
	newTableName: string;
	setNewTableName: (name: string) => void;
	handleCreateTable: () => void;
	createTable: { isPending: boolean };
}

export const TopNav = ({
	selectedBase,
	rowCount,
	setRowCount,
	handleGenerateRows,
	generateRows,
	selectedTableId,
	handleTableSelect,
	showCreateTable,
	setShowCreateTable,
	newTableName,
	setNewTableName,
	handleCreateTable,
	createTable,
}: TopNavProps) => {
	const utils = api.useUtils();
	const updateBase = api.base.update.useMutation({
		// Optimistic update of the base cache
		onMutate: async (variables) => {
			await utils.base.getAll.cancel();
			const previous = utils.base.getAll.getData();

			utils.base.getAll.setData(undefined, (old) => {
				if (!old) return old;
				return old.map((b) =>
					b.id === variables.id
						? {
								...b,
								name: variables.name ?? b.name,
								description: variables.description ?? b.description,
							}
						: b,
				);
			});

			return { previous };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.previous) {
				utils.base.getAll.setData(undefined, ctx.previous);
			}
		},
		onSettled: async () => {
			await utils.base.getAll.invalidate();
		},
	});

	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState(selectedBase.name);
	const [editingDesc, setEditingDesc] = useState(false);
	const [descDraft, setDescDraft] = useState(selectedBase.description ?? "");
	const [centerTab, setCenterTab] = useState<
		"Data" | "Automations" | "Interfaces" | "Forms"
	>("Data");
    const [tableMenuOpen, setTableMenuOpen] = useState(false);
    const [tableSearch, setTableSearch] = useState("");
    const [showAddInline, setShowAddInline] = useState(false);
    const [viewName, setViewName] = useState("Grid view");

	useEffect(() => {
		setNameDraft(selectedBase.name);
		setDescDraft(selectedBase.description ?? "");
	}, [selectedBase.id, selectedBase.name, selectedBase.description]);

	const commitName = () => {
		const trimmed = nameDraft.trim();
		if (!trimmed || trimmed === selectedBase.name) {
			setEditingName(false);
			return;
		}
		updateBase.mutate({ id: selectedBase.id, name: trimmed });
		setEditingName(false);
	};

	const commitDesc = () => {
		if (descDraft === (selectedBase.description ?? "")) {
			setEditingDesc(false);
			return;
		}
		updateBase.mutate({ id: selectedBase.id, description: descDraft });
		setEditingDesc(false);
	};

	const handleShare = async () => {
		navigator.clipboard.writeText(window.location.toString());
		showToast("Link copied to clipboard", { variant: "success" });
	};

	return (
		<div>
			{/* Base name and description */}
			<div className="relative border-b px-6 pt-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button type="button" className="flex items-center gap-2">
									<Folder
										size={32}
										className="mr-1 rounded-md border p-[5px]"
									/>
									{editingName ? (
										<input
											value={nameDraft}
											onChange={(e) => setNameDraft(e.target.value)}
											onBlur={commitName}
											onKeyDown={(e) => {
												if (e.key === "Enter") commitName();
												if (e.key === "Escape") {
													setNameDraft(selectedBase.name);
													setEditingName(false);
												}
											}}
											className="w-64 rounded border border-gray-300 px-2 py-1 text-lg"
										/>
									) : (
										<h1
											className="font-semibold text-gray-900 text-xl hover:underline"
											onClick={(e) => {
												e.preventDefault();
												setEditingName(true);
											}}
										>
											{selectedBase.name}
										</h1>
									)}
									<ChevronDown
										size={20}
										color="gray"
										className="cursor-pointer"
									/>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="start"
								className="w-[560px] bg-white p-0 px-4"
							>
								<div className="p-6">
									<div className="flex items-center justify-between">
										{editingName ? (
											<input
												value={nameDraft}
												onChange={(e) => setNameDraft(e.target.value)}
												onBlur={commitName}
												onKeyDown={(e) => {
													if (e.key === "Enter") commitName();
													if (e.key === "Escape") {
														setNameDraft(selectedBase.name);
														setEditingName(false);
													}
												}}
												className="w-full max-w-[360px] rounded border border-gray-300 px-2 py-1 text-xl"
												autoFocus
											/>
										) : (
											<h2
												className="font-semibold text-2xl text-gray-900 hover:underline"
												onClick={() => setEditingName(true)}
											>
												{selectedBase.name}
											</h2>
										)}
										<div className="flex items-center gap-3 text-gray-500">
											<Star className="h-4 w-4" />
											<ExternalLink className="h-4 w-4" />
											<MoreHorizontal className="h-4 w-4" />
										</div>
									</div>
								</div>
								<div className="border-gray-200 border-t" />
								<div className="px-6 py-3">
									<details className="group">
										<summary className="flex cursor-pointer list-none items-center gap-2 py-2 font-medium">
											<ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
											Appearance
										</summary>
									</details>
								</div>
								<div className="border-gray-200 border-t" />
								<div className="px-6 py-3">
									<details open className="group">
										<summary className="flex cursor-pointer list-none items-center gap-2 py-2 font-medium">
											<ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
											Base guide
										</summary>
										<div className="mt-2 space-y-4 text-gray-600">
											{editingDesc ? (
												<textarea
													value={descDraft}
													onChange={(e) => setDescDraft(e.target.value)}
													onBlur={commitDesc}
													onKeyDown={(e) => {
														if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
															commitDesc();
														if (e.key === "Escape") {
															setDescDraft(selectedBase.description ?? "");
															setEditingDesc(false);
														}
													}}
													rows={10}
													className="w-full resize-y rounded border border-blue-300 bg-gray-50 p-3 text-sm focus:border-blue-500 focus:outline-none"
												/>
											) : selectedBase.description ? (
												<p
													className="whitespace-pre-line hover:underline"
													onClick={() => setEditingDesc(true)}
												>
													{selectedBase.description}
												</p>
											) : (
												<p
													className="whitespace-pre-line hover:underline"
													onClick={() => setEditingDesc(true)}
												>
													Click to enter base's description
												</p>
											)}
										</div>
									</details>
								</div>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					{/* Center section: Data | Automations | Interfaces | Forms */}
					<nav
						aria-label="Base sections"
						className="flex h-12 gap-6 text-gray-600 text-sm"
					>
						<button
							type="button"
							onClick={() => setCenterTab("Data")}
							className={`border-b-2 px-1 pb-1 ${
								centerTab === "Data"
									? "border-green-700 font-semibold text-gray-900"
									: "border-transparent hover:text-gray-900"
							}`}
						>
							Data
						</button>
						<button
							type="button"
							onClick={() => setCenterTab("Automations")}
							disabled
							className={`border-b-2 px-1 pb-1 ${
								centerTab === "Automations"
									? "border-green-700 font-semibold text-gray-900"
									: "border-transparent hover:text-gray-900"
							}`}
						>
							Automations
						</button>
						<button
							type="button"
							onClick={() => setCenterTab("Interfaces")}
							disabled
							className={`border-b-2 px-1 pb-1 ${
								centerTab === "Interfaces"
									? "border-green-700 font-semibold text-gray-900"
									: "border-transparent hover:text-gray-900"
							}`}
						>
							Interfaces
						</button>
						<button
							type="button"
							onClick={() => setCenterTab("Forms")}
							disabled
							className={`border-b-2 px-1 pb-1 ${
								centerTab === "Forms"
									? "border-green-700 font-semibold text-gray-900"
									: "border-transparent hover:text-gray-900"
							}`}
						>
							Forms
						</button>
					</nav>
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
								className="btn-share"
							>
								<Plus size={16} />
								{generateRows.isPending ? "Generating..." : "Generate Rows"}
							</button>
							<button type="button" onClick={handleShare} className="btn-share">
								Share
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Table tabs + switcher */}
			<div className="border-gray-200 border-b bg-gray-50">
				<div className="flex items-center gap-1">
					{selectedBase.tables.map((table) => (
						<button
							type="button"
							key={table.id}
							onClick={() => handleTableSelect(table.id)}
							className={`rounded-t-sm border-x border-t px-3 py-2 font-medium text-sm ${
								selectedTableId === table.id
									? "border-gray-300 bg-white text-gray-900"
									: "border-transparent bg-transparent text-gray-600 hover:text-gray-900"
							}`}
						>
							{table.name}
						</button>
					))}

					{/* Chevron opens table switcher */}
					<DropdownMenu
						open={tableMenuOpen}
						onOpenChange={(o) => {
							setTableMenuOpen(o);
							if (!o) {
								setTableSearch("");
								setShowAddInline(false);
							}
						}}
					>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="cursor-pointer px-2 text-gray-600"
							>
								<ChevronDown size={14} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="w-[420px] bg-white p-0"
						>
							<div className="p-3">
								<div className="relative">
									<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 h-4 w-4 text-gray-400" />
									<Input
										placeholder="Find a table"
										value={tableSearch}
										onChange={(e) => setTableSearch(e.target.value)}
										className="pl-8"
									/>
								</div>
							</div>
							<div className="border-gray-200 border-t" />
							<div className="max-h-72 overflow-auto p-2">
								{selectedBase.tables
									.filter((t) =>
										t.name.toLowerCase().includes(tableSearch.toLowerCase()),
									)
									.map((t) => (
										<button
											key={t.id}
											type="button"
											onClick={() => {
												handleTableSelect(t.id);
												setTableMenuOpen(false);
											}}
											className={`flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-50 ${selectedTableId === t.id ? "bg-gray-100" : ""}`}
										>
											{selectedTableId === t.id && (
												<Check className="h-4 w-4" />
											)}
											<span>{t.name}</span>
										</button>
									))}
							</div>
							<div className="border-gray-200 border-t" />
							<div className="p-2">
								{!showAddInline ? (
									<button
										type="button"
										className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-50"
										onClick={() => {
											setShowAddInline(true);
											setShowCreateTable(true);
										}}
									>
										<Plus size={14} /> Add table
									</button>
								) : (
									<div className="px-2 py-2">
										<CreateTableInlineInput
											newTableName={newTableName}
											setNewTableName={setNewTableName}
											handleCreateTable={() => {
												handleCreateTable();
												setTableMenuOpen(false);
												setShowAddInline(false);
											}}
											setShowCreateTable={(v) => {
												setShowCreateTable(v);
												if (!v) {
													setShowAddInline(false);
												}
											}}
											isPending={createTable.isPending}
										/>
									</div>
								)}
							</div>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Add or import triggers same menu in add mode */}
					<button
						type="button"
						onClick={() => {
							setTableMenuOpen(true);
							setShowAddInline(true);
							setShowCreateTable(true);
						}}
						className="flex cursor-pointer items-center gap-2 px-2 text-gray-600 text-sm"
					>
						<Plus size={14} /> Add or import
					</button>
				</div>
			</div>

            {/* Inner navbar removed (moved into DataTable) */}
		</div>
	);
};

interface CreateTableInlineInputProps {
	newTableName: string;
	setNewTableName: (name: string) => void;
	handleCreateTable: () => void;
	setShowCreateTable: (show: boolean) => void;
	isPending: boolean;
}

const CreateTableInlineInput = ({
	newTableName,
	setNewTableName,
	handleCreateTable,
	setShowCreateTable,
	isPending,
}: CreateTableInlineInputProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
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
				ref={inputRef}
			/>
			<button
				type="button"
				onClick={handleCreateTable}
				disabled={!newTableName.trim() || isPending}
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
	);
};
