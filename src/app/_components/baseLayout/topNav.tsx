"use client";
import {
	Calendar,
	ChevronDown,
	ChevronRight,
	Cloud,
	Database,
	ExternalLink,
	FileSpreadsheet,
	Folder,
	MoreHorizontal,
	Plus,
	Star,
} from "lucide-react";
import { Check, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { showToast } from "~/components/ui/toast";
import { BULK_JOB_COMPLETED_EVENT, BULK_JOB_STARTED_EVENT, type BulkJobStartDetail } from "~/lib/bulkJobEvents";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type Table = { id: string; name: string };
type Base = {
	id: string;
	name: string;
	description?: string | null;
	tables: Table[];
};

interface TopNavProps {
	selectedBase: Base;
	selectedTableId: string | null;
	handleTableSelect: (tableId: string) => void;
	newTableName: string;
	setNewTableName: (name: string) => void;
	handleCreateTable: () => void;
	createTable: { isPending: boolean };
}

export const TopNav = ({
	selectedBase,
	selectedTableId,
	handleTableSelect,
	newTableName,
	setNewTableName,
	handleCreateTable,
	createTable,
}: TopNavProps) => {
	const utils = api.useUtils();
	const bulkAddRows = api.table.bulkAddRows.useMutation({
		onMutate: async (variables) => {
			if (!variables?.tableId) return undefined;
			const jobId =
				typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: `job-${Date.now()}`;
			let startRowCount = 0;
			try {
				const result = await utils.table.getRowCount.fetch({
					id: variables.tableId,
				});
				startRowCount = result?.count ?? 0;
			} catch (error) {
				console.error("Failed to get current row count", error);
			}
			const detail: BulkJobStartDetail = {
				tableId: variables.tableId,
				jobId,
				count: variables.count,
				startRowCount,
			};
			dispatchJobStart(detail);
			return { jobDetail: detail };
		},
		onSuccess: async (result, variables, context) => {
			const tableName =
				selectedBase.tables.find(
					(table) => table.id === (variables?.tableId ?? ""),
				)?.name ?? "table";

			if (result?.queued) {
				const rowCount = variables?.count
					? variables.count.toLocaleString()
					: "Bulk";
				const ticket = result.messageId ? ` (job ${result.messageId})` : "";
				showToast(
					`${rowCount} rows queued for ${tableName}${ticket}. We'll add them in the background.`,
					{ variant: "success" },
				);
				if (context?.jobDetail) {
					startJobPolling(context.jobDetail);
				}
			} else if (typeof result?.created === "number") {
				showToast(
					`Added ${result.created.toLocaleString()} rows to ${tableName}.`,
					{ variant: "success" },
				);
				if (context?.jobDetail) {
					dispatchJobComplete(
						context.jobDetail.tableId,
						context.jobDetail.jobId,
					);
				}
			}

			await utils.base.getAll.invalidate();
		},
		onError: (error, _variables, context) => {
			showToast(error.message ?? "Failed to add new rows.", {
				variant: "error",
			});
			if (context?.jobDetail) {
				dispatchJobComplete(context.jobDetail.tableId, context.jobDetail.jobId);
			}
		},
	});
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

	// Delete table mutation
	const deleteTable = api.table.delete.useMutation({
		onSuccess: async (_res, variables) => {
			// Try to switch to another available table if we deleted the active one
			if (variables?.id && selectedTableId === variables.id) {
				const fallback = selectedBase.tables.find((t) => t.id !== variables.id);
				if (fallback) {
					handleTableSelect(fallback.id);
				}
			}
			await utils.base.getAll.invalidate();
		},
	});

	// Rename table
	const renameTable = api.table.update.useMutation({
		onSuccess: async () => {
			await utils.base.getAll.invalidate();
		},
	});

	// Duplicate table
	const duplicateTable = api.table.duplicate.useMutation({
		onSuccess: async (newTable) => {
			await utils.base.getAll.invalidate();
			if (newTable?.id) {
				handleTableSelect(newTable.id);
			}
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
	// Add or import dropdown state
	const [importMenuOpen, setImportMenuOpen] = useState(false);
	const [importInlineOpen, setImportInlineOpen] = useState(false);
	const bulkJobPolls = useRef<Map<string, number>>(new Map());

	useEffect(() => {
		return () => {
			bulkJobPolls.current.forEach((intervalId) => {
				window.clearInterval(intervalId);
			});
			bulkJobPolls.current.clear();
		};
	}, []);

	const dispatchJobStart = useCallback((detail: BulkJobStartDetail) => {
		window.dispatchEvent(
			new CustomEvent(BULK_JOB_STARTED_EVENT, {
				detail,
			}),
		);
	}, []);

	const dispatchJobComplete = useCallback(
		(tableId: string, jobId: string) => {
			const existing = bulkJobPolls.current.get(jobId);
			if (existing) {
				window.clearInterval(existing);
				bulkJobPolls.current.delete(jobId);
			}
			window.dispatchEvent(
				new CustomEvent(BULK_JOB_COMPLETED_EVENT, {
					detail: { tableId, jobId },
				}),
			);
		},
		[],
	);

	const startJobPolling = useCallback(
		(detail: BulkJobStartDetail) => {
			const runCheck = async () => {
				try {
					const result = await utils.table.getRowCount.fetch({
						id: detail.tableId,
					});
					if (result?.count === undefined) return;
					if (result.count >= detail.startRowCount + detail.count) {
						dispatchJobComplete(detail.tableId, detail.jobId);
					}
				} catch (error) {
					console.error("Bulk job polling failed", error);
				}
			};

			runCheck();

			const intervalId = window.setInterval(runCheck, 4000);
			bulkJobPolls.current.set(detail.jobId, intervalId);
		},
		[dispatchJobComplete, utils.table.getRowCount],
	);

	useEffect(() => {
		setNameDraft(selectedBase.name);
		setDescDraft(selectedBase.description ?? "");
	}, [selectedBase.name, selectedBase.description]);

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
			<div className="relative border-b px-3 pt-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button type="button" className="flex items-center gap-2">
									<Folder
										size={32}
										className="mr-1 rounded-md border bg-blue-600 p-[5px] text-white"
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
						className="flex h-12 gap-2 text-gray-600 text-sm"
					>
						<button
							type="button"
							onClick={() => setCenterTab("Data")}
							className={`border-b-2 px-1 pb-1 ${
								centerTab === "Data"
									? "border-blue-700 font-semibold text-gray-900"
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
									? "border-blue-700 font-semibold text-gray-900"
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
									? "border-blue-700 font-semibold text-gray-900"
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
									? "border-blue-700 font-semibold text-gray-900"
									: "border-transparent hover:text-gray-900"
							}`}
						>
							Forms
						</button>
					</nav>
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => {
									const id = selectedTableId ?? selectedBase.tables[0]?.id;
									if (!id) return;
									bulkAddRows.mutate({ tableId: id, count: 100_000 });
								}}
								disabled={bulkAddRows.isPending}
								className="btn-share"
							>
								<Plus size={16} />
								{bulkAddRows.isPending ? "Adding rows..." : "Add 100K Rows"}
							</button>
							<button
								type="button"
								onClick={() => {
									const id = selectedTableId ?? selectedBase.tables[0]?.id;
									if (!id) return;
									bulkAddRows.mutate({ tableId: id, count: 100 });
								}}
								disabled={bulkAddRows.isPending}
								className="btn-share"
							>
								<Plus size={16} />
								{bulkAddRows.isPending ? "Adding rows..." : "Add 100 Rows"}
							</button>
							<button
								type="button"
								onClick={handleShare}
								className="btn-share bg-blue-600 text-white"
							>
								Share
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Table tabs + switcher */}
			<div className="flex items-center justify-between border-gray-200 border-b-2 bg-blue-50">
				<div className="flex items-center">
					{selectedBase.tables.map((table, tableIndex) => {
						const isActive = selectedTableId === table.id;
						// Active tab: render with trailing dropdown trigger, mirroring column menu styling
						return (
							<div
								key={table.id}
								className={cn(
									"flex border-separate border-spacing-0 items-center justify-between gap-2 rounded-tr-sm border-x border-t px-3 py-2 font-medium text-sm",
									isActive
										? "-mb-0.5 z-10 border-gray-300 bg-white text-gray-900"
										: "border-transparent bg-transparent text-gray-600 hover:bg-slate-200 hover:text-gray-900",
									tableIndex !== 0 && "rounded-t-sm",
								)}
							>
								<button
									type="button"
									onClick={() => handleTableSelect(table.id)}
									className="cursor-pointer"
								>
									{table.name}
								</button>
								{isActive && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												className="cursor-pointer"
												aria-label="Table menu"
											>
												<ChevronDown size={16} />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="start"
											className="w-64 bg-white p-0"
										>
											<div className="p-2">
												<button
													type="button"
													className="w-full cursor-pointer rounded px-2 py-2 text-left hover:bg-gray-50"
													onClick={() => {
														const name = prompt("Rename table", table.name);
														if (name?.trim()) {
															renameTable.mutate({
																id: table.id,
																name: name.trim(),
															});
														}
													}}
													disabled={renameTable.isPending}
												>
													Rename table
												</button>
												<button
													type="button"
													className="w-full cursor-pointer rounded px-2 py-2 text-left hover:bg-gray-50"
													onClick={() =>
														duplicateTable.mutate({ id: table.id })
													}
													disabled={duplicateTable.isPending}
												>
													Duplicate table
												</button>
												<button
													type="button"
													className="w-full cursor-pointer rounded px-2 py-2 text-left text-red-600 hover:bg-red-50"
													onClick={() => deleteTable.mutate({ id: table.id })}
												>
													Delete table
												</button>
											</div>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						);
					})}

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
								className="ml-4 cursor-pointer border-gray-300 border-l pl-3 text-gray-600"
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
											onCancel={() => setShowAddInline(false)}
											isPending={createTable.isPending}
										/>
									</div>
								)}
							</div>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Add or import menu matching production layout */}
					<DropdownMenu
						open={importMenuOpen}
						onOpenChange={(o) => {
							setImportMenuOpen(o);
							if (!o) setImportInlineOpen(false);
						}}
					>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="ml-4 flex cursor-pointer items-center gap-2 px-2 text-gray-600 text-sm"
							>
								<Plus size={14} /> Add or import
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="w-[320px] bg-white p-0"
						>
							<div className="py-2">
								<DropdownMenuLabel className="px-2 py-1">
									Add a blank table
								</DropdownMenuLabel>
								<div className="px-1">
									{importInlineOpen ? (
										<CreateTableInlineInput
											newTableName={newTableName}
											setNewTableName={setNewTableName}
											handleCreateTable={() => {
												handleCreateTable();
												setImportMenuOpen(false);
												setImportInlineOpen(false);
											}}
											onCancel={() => setImportInlineOpen(false)}
											isPending={createTable.isPending}
										/>
									) : (
										<DropdownMenuItem
											onSelect={(e) => {
												e.preventDefault();
												setImportInlineOpen(true);
											}}
											className="cursor-pointer"
										>
											Start from scratch
										</DropdownMenuItem>
									)}
								</div>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="px-2 py-1">
									Add from other sources
								</DropdownMenuLabel>
								<DropdownMenuItem
									disabled
									className="cursor-not-allowed opacity-60"
								>
									<Database className="mr-2 h-4 w-4" /> Airtable base
									<span className="ml-auto rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
										Team
									</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled
									className="cursor-not-allowed opacity-60"
								>
									<FileSpreadsheet className="mr-2 h-4 w-4" /> CSV file
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled
									className="cursor-not-allowed opacity-60"
								>
									<Calendar className="mr-2 h-4 w-4" /> Google Calendar
									<span className="ml-auto rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
										Team
									</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled
									className="cursor-not-allowed opacity-60"
								>
									<FileSpreadsheet className="mr-2 h-4 w-4" /> Google Sheets
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled
									className="cursor-not-allowed opacity-60"
								>
									<FileSpreadsheet className="mr-2 h-4 w-4" /> Microsoft Excel
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled
									className="cursor-not-allowed opacity-60"
								>
									<Cloud className="mr-2 h-4 w-4" /> Salesforce
									<span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
										Business
									</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled
									className="cursor-not-allowed opacity-60"
								>
									<FileSpreadsheet className="mr-2 h-4 w-4" /> Smartsheet
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled
									className="cursor-not-allowed opacity-60"
								>
									<span className="mr-2 flex h-4 w-4 items-center justify-center">
										<ChevronRight className="h-3 w-3" />
									</span>
									26 more sources…
								</DropdownMenuItem>
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<button
					type="button"
					className="flex cursor-pointer items-center gap-2 border-gray-300 pr-3 text-gray-600 text-sm"
				>
					Tools
					<ChevronDown size={14} />
				</button>
			</div>
		</div>
	);
};

interface CreateTableInlineInputProps {
	newTableName: string;
	setNewTableName: (name: string) => void;
	handleCreateTable: () => void;
	onCancel: () => void;
	isPending: boolean;
}

const CreateTableInlineInput = ({
	newTableName,
	setNewTableName,
	handleCreateTable,
	onCancel,
	isPending,
}: CreateTableInlineInputProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<div className="py-1">
			<DropdownMenuLabel className="px-2">Create table</DropdownMenuLabel>
			<div className="px-2 pt-1 pb-2">
				<Input
					type="text"
					placeholder="Table name"
					value={newTableName}
					onChange={(e) => setNewTableName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							handleCreateTable();
						} else if (e.key === "Escape") {
							setNewTableName("");
							onCancel();
						}
					}}
					ref={inputRef}
				/>
			</div>
			<div className="flex items-center gap-2 px-2 pb-2">
				<button
					type="button"
					onClick={handleCreateTable}
					disabled={!newTableName.trim() || isPending}
					className="rounded bg-blue-500 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
				>
					Add
				</button>
				<button
					type="button"
					onClick={() => {
						setNewTableName("");
						onCancel();
					}}
					className="rounded bg-red-500 px-2 py-1 text-sm text-white hover:bg-red-700"
				>
					Cancel
				</button>
			</div>
		</div>
	);
};
