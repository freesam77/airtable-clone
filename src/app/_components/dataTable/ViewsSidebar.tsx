"use client";

import { ChevronDown, Search, Sheet } from "lucide-react";
import { Input } from "~/components/ui/input";

type ViewsSidebarProps = {
	viewName: string;
};

export function ViewsSidebar({ viewName }: ViewsSidebarProps) {
	return (
		<nav className="flex w-[280px] shrink-0 flex-col gap-2 border-gray-200 border-r bg-white px-4 py-3 text-xs">
			<button
				type="button"
				className="flex cursor-pointer items-center gap-2 px-3 text-gray-700 text-sm hover:text-gray-900"
			>
				<span className="text-xl">+</span>
				Create new...
			</button>
			<div className="flex items-center gap-2 px-3">
				<Search className="size-4 text-gray-400" />
				<Input
					placeholder="Find a view"
					className="h-8 w-full pl-0 text-xs shadow-none md:text-xs"
				/>
			</div>
			<div>
				<button
					type="button"
					className="flex w-full items-center gap-2 bg-gray-100 px-3 py-2 text-gray-900"
				>
					<Sheet className="size-4 text-blue-600" />
					<span>{viewName}</span>
					<ChevronDown className="ml-auto size-4" />
				</button>
			</div>
		</nav>
	);
}
