"use client";

import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Grid3X3,
	Menu,
	Plus,
	Search,
} from "lucide-react";
import type { Session } from "next-auth";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface SidebarProps {
	className?: string;
	user?: Session["user"];
}

export function Sidebar({ className, user }: SidebarProps) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

	const getUserInitials = (name: string | null | undefined) => {
		if (!name) return "U";
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	return (
		<div
			className={cn(
				"flex flex-col border-gray-200 border-r bg-white transition-all duration-300",
				isSidebarCollapsed ? "w-12" : "w-64",
				className,
			)}
		>
			<div className="border-gray-200 border-b p-4">
				<div className="mb-4 flex items-center justify-between">
					<div
						className={cn(
							"flex items-center gap-2",
							isSidebarCollapsed && "hidden",
						)}
					>
						{user?.image ? (
							<img
								src={user.image}
								alt={user.name || "User"}
								className="h-8 w-8 rounded-full"
							/>
						) : (
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
								<span className="font-semibold text-sm text-white">
									{getUserInitials(user?.name)}
								</span>
							</div>
						)}
						<span className="font-semibold text-gray-900">
							{user?.name || "User"}
						</span>
					</div>
					<Button
						onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
						variant="ghost"
						size="icon"
						className="h-8 w-8"
					>
						{isSidebarCollapsed ? (
							<Menu size={16} />
						) : (
							<ChevronLeft size={16} />
						)}
					</Button>
				</div>

				{!isSidebarCollapsed && (
					<div className="flex items-center gap-2">
						<Button variant="secondary" className="flex-1 justify-start">
							<Plus size={16} className="mr-2" />
							Create new...
						</Button>
					</div>
				)}
			</div>

			{!isSidebarCollapsed && (
				<div className="p-4">
					<div className="relative mb-4">
						<Search
							className="-translate-y-1/2 absolute top-1/2 left-3 transform text-gray-400"
							size={16}
						/>
						<input
							type="text"
							placeholder="Find a view"
							className="w-full rounded-md border border-gray-300 py-2 pr-4 pl-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div className="space-y-1">
						<div className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-gray-700 text-sm">
							<Grid3X3 size={16} />
							<span>Grid view</span>
						</div>

						<Button
							variant="ghost"
							className="w-full justify-start"
							onClick={() => setIsCollapsed(!isCollapsed)}
						>
							{isCollapsed ? (
								<ChevronRight size={16} />
							) : (
								<ChevronDown size={16} />
							)}
							<span className="ml-2">Grid view</span>
						</Button>
					</div>
				</div>
			)}

			{isSidebarCollapsed && (
				<div className="flex flex-col items-center gap-2 p-2">
					{user?.image ? (
						<img
							src={user.image}
							alt={user.name || "User"}
							className="h-8 w-8 rounded-full"
						/>
					) : (
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
							<span className="font-semibold text-sm text-white">
								{getUserInitials(user?.name)}
							</span>
						</div>
					)}
					<Button variant="ghost" size="icon">
						<Plus size={16} />
					</Button>
					<Button variant="ghost" size="icon">
						<Grid3X3 size={16} />
					</Button>
				</div>
			)}
		</div>
	);
}
