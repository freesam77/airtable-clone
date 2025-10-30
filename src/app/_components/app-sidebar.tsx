"use client";

import { Database } from "lucide-react";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Sidebar, SidebarHeader } from "~/components/ui/sidebar";
import { api } from "~/trpc/react";

interface AppSidebarProps {
	user?: Session["user"];
	selectedBaseId?: string;
	selectedTableId?: string;
	onBaseSelect?: (baseId: string) => void;
	onTableSelect?: (tableId: string) => void;
}

export function AppSidebar({
	user,
	selectedBaseId,
	selectedTableId,
	onBaseSelect,
	onTableSelect,
}: AppSidebarProps) {
	const router = useRouter();
	const [expandedBases, setExpandedBases] = useState<Set<string>>(new Set());

	const { data: bases } = api.base.getAll.useQuery();

	const getUserInitials = (name: string | null | undefined) => {
		if (!name) return "U";
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	const toggleBaseExpansion = (baseId: string) => {
		const newExpanded = new Set(expandedBases);
		if (newExpanded.has(baseId)) {
			newExpanded.delete(baseId);
		} else {
			newExpanded.add(baseId);
		}
		setExpandedBases(newExpanded);
	};

	return (
		<Sidebar>
			<SidebarHeader>
				<Button
					className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
					onClick={() => router.push("/dashboard")}
				>
					<Database className="h-4 w-4 cursor-pointer" />
				</Button>
			</SidebarHeader>
		</Sidebar>
	);
}
