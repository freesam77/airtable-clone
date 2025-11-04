"use client";

import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Sidebar, SidebarHeader } from "~/components/ui/sidebar";

export function AppSidebar() {
	const router = useRouter();

    return (
        <Sidebar variant="sidebar" collapsible="icon">
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
