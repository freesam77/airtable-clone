"use client";

import { Database, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarInput,
    SidebarSeparator,
} from "~/components/ui/sidebar";

export function AppSidebar() {
    const router = useRouter();

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
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                                <Plus className="h-4 w-4" />
                                <span>Create new...</span>
                            </Button>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarInput placeholder="Find a view" />
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>
                <SidebarSeparator />
                <SidebarGroup>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton isActive>Grid view</SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
