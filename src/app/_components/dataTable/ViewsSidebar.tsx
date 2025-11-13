"use client";

import {
	GripVertical,
	MoreHorizontal,
	Plus,
	Search,
	Sheet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";

type SidebarView = RouterOutputs["view"]["listByTable"][number];

type ViewsSidebarProps = {
	views: SidebarView[];
	activeViewId: string | null;
	onSelectView: (id: string) => void;
	onCreateView: () => void;
	onRenameView: (id: string, name: string) => void;
	onDuplicateView: (id: string) => void;
	onDeleteView: (id: string) => void;
	onReorderView: (sourceId: string, targetId: string) => void;
	canDeleteView: boolean;
};

export function ViewsSidebar({
	views,
	activeViewId,
	onSelectView,
	onCreateView,
	onRenameView,
	onDuplicateView,
	onDeleteView,
	onReorderView,
	canDeleteView,
}: ViewsSidebarProps) {
	const [query, setQuery] = useState("");

	const filteredViews = useMemo(() => {
		if (!query.trim()) return views;
		return views.filter((view) =>
			view.name.toLowerCase().includes(query.trim().toLowerCase()),
		);
	}, [query, views]);

	const handleDragStart = (
		event: React.DragEvent<HTMLButtonElement>,
		viewId: string,
	) => {
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", viewId);
	};

	const handleDrop = (
		event: React.DragEvent<HTMLLIElement>,
		targetId: string,
	) => {
		event.preventDefault();
		const sourceId = event.dataTransfer.getData("text/plain");
		if (sourceId) {
			onReorderView(sourceId, targetId);
		}
	};

	return (
		<nav className="flex w-[260px] shrink-0 flex-col gap-3 border-gray-200 border-r bg-white px-4 py-3 text-xs">
			<div className="flex items-center justify-between px-1">
				<h2 className="text-[11px] text-gray-500 uppercase">Views</h2>
				<Button
					variant="ghost"
					size="sm"
					className="flex items-center gap-1 px-2 text-gray-700"
					onClick={onCreateView}
				>
					<Plus className="size-4" />
					New view
				</Button>
			</div>
			<div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
				<Search className="size-4 text-gray-400" />
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Find a view"
					className="h-7 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
				/>
			</div>
			<ul className="space-y-1">
				{filteredViews.map((view) => {
					const isActive = view.id === activeViewId;
					return (
						<li
							key={view.id}
							onDragOver={(event) => event.preventDefault()}
							onDrop={(event) => handleDrop(event, view.id)}
							className={cn(
								"rounded md:text-xs",
								isActive ? "bg-blue-50" : "bg-transparent",
							)}
						>
							<div className="flex items-center gap-2 px-2 py-1.5">
								<button
									type="button"
									className={cn(
										"flex flex-1 items-center gap-2 rounded px-1 py-1 text-left",
										isActive
											? "text-gray-900"
											: "text-gray-600 hover:bg-gray-100",
									)}
									onClick={() => onSelectView(view.id)}
								>
									<Sheet className="size-4 text-blue-600" />
									<span className="flex-1 truncate text-sm">{view.name}</span>
								</button>
								<div className="flex items-center gap-1">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												className="rounded p-1 text-gray-500 hover:bg-gray-100"
											>
												<MoreHorizontal className="size-4" />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent className="w-44" align="end">
											<DropdownMenuItem
												className="cursor-pointer"
												onSelect={() => {
													const next = prompt("Rename view", view.name);
													if (next?.trim()) onRenameView(view.id, next.trim());
												}}
											>
												Rename view
											</DropdownMenuItem>
											<DropdownMenuItem
												className="cursor-pointer"
												onSelect={() => onDuplicateView(view.id)}
											>
												Duplicate view
											</DropdownMenuItem>
											<DropdownMenuItem
												className={cn(
													"cursor-pointer text-red-600 focus:text-red-600",
													!canDeleteView && "pointer-events-none opacity-50",
												)}
												onSelect={() => {
													if (!canDeleteView) return;
													if (
														confirm(
															`Delete view "${view.name}"? This cannot be undone.`,
														)
													) {
														onDeleteView(view.id);
													}
												}}
											>
												Delete view
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
									<button
										type="button"
										className="cursor-grab rounded p-1 text-gray-400 hover:text-gray-600"
										draggable
										onDragStart={(event) => handleDragStart(event, view.id)}
									>
										<GripVertical className="size-4" />
									</button>
								</div>
							</div>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
