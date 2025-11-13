"use client";

import {
	ArrowUpRight,
	Bell,
	ChevronDown,
    Folder,
	Hammer,
	HelpCircle,
	Home,
	Languages,
	LayoutGrid,
	LogOut,
	Menu,
	MenuIcon,
	MessageCircle,
	Palette,
	PhoneCall,
	Plug,
	Plus,
	Search,
	Share2,
	Star,
	Trash2,
	User,
	Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface DashboardLayoutProps {
	user: Session["user"];
}

type NavItem = {
	label: string;
	icon: LucideIcon;
};

const navItems: NavItem[] = [
	{ label: "Home", icon: Home },
	{ label: "Starred", icon: Star },
	{ label: "Shared", icon: Share2 },
];

type AccountMenuSection = {
	items: {
		label: string;
		icon: LucideIcon;
		badge?: string;
	}[];
};

const accountMenuSections: AccountMenuSection[] = [
	{
		items: [
			{ label: "Account", icon: User, badge: "Business" },
			{ label: "Manage groups", icon: Users },
			{ label: "Notification preferences", icon: Bell },
			{ label: "Language preferences", icon: Languages },
			{ label: "Appearance", icon: Palette, badge: "Beta" },
		],
	},
	{
		items: [
			{ label: "Contact sales", icon: PhoneCall },
			{ label: "Upgrade", icon: ArrowUpRight },
			{ label: "Tell a friend", icon: MessageCircle },
		],
	},
	{
		items: [
			{ label: "Integrations", icon: Plug },
			{ label: "Builder hub", icon: Hammer },
		],
	},
	{
		items: [{ label: "Trash", icon: Trash2 }],
	},
];

export function DashboardLayout({ user }: DashboardLayoutProps) {
	const router = useRouter();
	const [showCreateBase, setShowCreateBase] = useState(false);
	const [newBaseName, setNewBaseName] = useState("");
	const [newBaseDescription, setNewBaseDescription] = useState("");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

	const utils = api.useUtils();
	const { data: bases, refetch, isLoading } = api.base.getAll.useQuery();

	const createTable = api.base.createTable.useMutation({
		onSuccess: async (table) => {
			await utils.base.getAll.invalidate();
			void refetch();
			if (table?.id && table?.baseId) {
				router.push(`/${table.baseId}/${table.id}`);
			}
		},
	});

	const createBase = api.base.create.useMutation({
		onSuccess: (newBase) => {
			void refetch();
			setShowCreateBase(false);
			setNewBaseName("");
			setNewBaseDescription("");
			if (newBase?.id) {
				createTable.mutate({
					baseId: newBase.id,
					name: "Contacts",
					description: "this becomes the Base name",
					columns: [
						{ name: "Full Name", type: "TEXT", position: 0, required: false },
						{ name: "Email", type: "TEXT", position: 1, required: false },
						{ name: "Phone", type: "TEXT", position: 2, required: false },
						{ name: "Age", type: "NUMBER", position: 3, required: false },
					],
				});
			}
		},
	});

	const isCreating = createBase.isPending || createTable.isPending;
	const placeholderWorkspaces = useMemo(() => bases ?? [], [bases]);

	const getUserInitials = (name: string | null | undefined) => {
		if (!name) return "U";
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2)[0];
	};

	const handleCreateBase = () => {
		if (newBaseName.trim()) {
			createBase.mutate({
				name: newBaseName.trim(),
				description: newBaseDescription.trim() || undefined,
			});
		}
	};

	const handleSignOut = () => {
		signOut({ callbackUrl: "/" });
	};

	const handleBaseClick = (baseId: string) => {
		const base = bases?.find((b) => b.id === baseId);
		if (!base) return;
		const firstTableId = Array.isArray(base.tables)
			? base.tables[0]?.id
			: undefined;
		if (firstTableId) {
			router.push(`/${baseId}/${firstTableId}`);
			return;
		}
		createTable.mutate({
			baseId,
			name: "Contacts",
			description: "this becomes the Base name",
			columns: [
				{ name: "Full Name", type: "TEXT", position: 0, required: false },
				{ name: "Email", type: "TEXT", position: 1, required: false },
				{ name: "Phone", type: "TEXT", position: 2, required: false },
				{ name: "Age", type: "NUMBER", position: 3, required: false },
			],
		});
	};

	const handleSidebarNav = (label: string) => {
		if (label === "Home") {
			router.push("/dashboard");
		}
	};

	const renderEmptyState = (message: string) => (
		<div className="rounded-2xl border border-gray-300 border-dashed bg-white/60 p-12 text-center text-gray-500 text-sm">
			{message}
		</div>
	);

	const renderGrid = () => {
		if (isLoading) {
			return renderEmptyState("Loading your bases…");
		}
		if (!placeholderWorkspaces.length) {
			return renderEmptyState("Create a base to get started.");
		}
		return (
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{placeholderWorkspaces.map((base) => (
					<button
						key={base.id}
						type="button"
						onClick={() => handleBaseClick(base.id)}
						className="group hover:-translate-y-0.5 flex items-center gap-4 rounded-lg border border-gray-300 bg-white p-5 text-left transition hover:border-blue-100 hover:shadow-lg"
					>
						<div className="flex size-13 items-center justify-center rounded-xl border bg-blue-700 text-white">
							<Folder className="h-5 w-5" />
						</div>
						<div className="flex flex-col gap-1 text-sm">
							<p className="font-semibold text-gray-900">{base.name}</p>
							<p className="text-gray-500 text-xs">Lorem ipsum</p>
						</div>
					</button>
				))}
			</div>
		);
	};

	const renderList = () => {
		if (isLoading) {
			return renderEmptyState("Loading your bases…");
		}
		if (!placeholderWorkspaces.length) {
			return renderEmptyState("Create a base to get started.");
		}
		return (
			<div className="overflow-hidden">
				<table className="w-full text-sm">
					<thead className="text-gray-500 text-xs tracking-wide">
						<tr>
							<th className="py-3 text-left">Name</th>
							<th className="py-3 text-left">Last opened</th>
							<th className="py-3 text-left">Workspace</th>
						</tr>
					</thead>
					<tbody>
						{placeholderWorkspaces.map((base) => (
							<tr
								key={base.id}
								className="cursor-pointer text-gray-700 text-xs transition hover:bg-gray-200"
								onClick={() => handleBaseClick(base.id)}
							>
								<td className="p-2">
									<div className="flex items-center gap-3">
										<div className="flex size-6 items-center justify-center rounded-md border bg-blue-700 text-white">
											<Folder className="size-3" />
										</div>
										<div>
											<p className="font-semibold text-gray-900">{base.name}</p>
										</div>
									</div>
								</td>
								<td className="py-4 text-gray-600">Lorem Ipsum</td>
								<td className="py-4 text-gray-600">My First Workspace</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	};

	return (
		<div className="flex min-h-screen bg-[#f5f6fb]">
			<div className="flex w-full flex-col">
				<header className="flex items-center justify-between gap-4 border-b bg-white px-3">
					<div className={cn("flex items-center gap-2")}>
						<button
							type="button"
							onClick={() => setIsSidebarCollapsed((prev) => !prev)}
							aria-label="Toggle sidebar"
							aria-pressed={isSidebarCollapsed}
							className="flex items-center justify-center text-gray-600 transition hover:bg-gray-50 mr-3"
						>
							<Menu className="size-5" />
						</button>
						<Image
							src="/airtable-logo.png"
							alt="Airtable"
							width={180}
							height={100}
							className="w-28"
						/>
					</div>
					<div className="group m-auto flex w-[354px] items-center justify-between gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-500 text-sm shadow-sm transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
						<div className="flex w-full items-center gap-3">
							<Search className="size-4 text-gray-400" />
							<span className="text-gray-500 group-hover:text-gray-700">
								Search...
							</span>
						</div>
						<p className="w-9 text-gray-500 text-xs">ctrl K</p>
					</div>
					<div className="flex items-center justify-between gap-4">
						<button
							type="button"
							className="flex items-center gap-2 px-3 py-1.5 font-medium text-gray-600 text-xs transition hover:bg-gray-50"
						>
							<HelpCircle className="size-4" />
							<span>Help</span>
						</button>
						<button
							type="button"
							className="flex size-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
							aria-label="Notifications"
						>
							<Bell className="size-4" />
						</button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="flex size-7 items-center justify-center rounded-full bg-sky-300 text-xs"
								>
									{getUserInitials(user?.name)}
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-72" align="end">
								<div className="px-3 py-2">
									<p className="font-semibold text-gray-900">
										{user?.name ?? "User"}
									</p>
									<p className="text-gray-500 text-sm">
										{user?.email ?? "no-email"}
									</p>
								</div>
								<DropdownMenuSeparator />
								{accountMenuSections.map((section, sectionIndex) => (
									<div key={`section-${sectionIndex}`}>
										{section.items.map((item) => (
											<DropdownMenuItem
												key={item.label}
												onSelect={(event) => event.preventDefault()}
												className="cursor-not-allowed gap-3 text-gray-600"
											>
												<item.icon className="h-4 w-4 text-gray-400" />
												<span className="flex-1">{item.label}</span>
												{item.badge && (
													<span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 text-xs">
														{item.badge}
													</span>
												)}
											</DropdownMenuItem>
										))}
										{sectionIndex < accountMenuSections.length - 1 && (
											<DropdownMenuSeparator />
										)}
									</div>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={(event) => {
										event.preventDefault();
										handleSignOut();
									}}
									className="gap-3 text-gray-900"
								>
									<LogOut className="h-4 w-4" /> Log out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</header>
				<div className="flex h-full w-full bg-white">
					<aside
						className={cn(
							"flex h-full flex-col transition-all duration-200",
							isSidebarCollapsed ? "w-13" : "w-72",
						)}
					>
						<nav
							className={cn(
								"flex h-full flex-col justify-between space-y-1 border-r p-4 text-gray-500 text-sm",
								isSidebarCollapsed ? "px-2" : "px-4",
							)}
						>
							<section className="flex flex-col gap-2">
								{navItems.map(({ label, icon: Icon }) => {
									const isActive = label === "Home";
									return (
										<button
											key={label}
											type="button"
											onClick={() => handleSidebarNav(label)}
											aria-current={isActive ? "page" : undefined}
											className={cn(
												"m-auto flex w-full items-center gap-3 px-3 py-2 font-semibold transition",
												isActive ? "bg-slate-200" : "hover:bg-slate-200",
												isSidebarCollapsed && "justify-center px-0",
											)}
										>
											<Icon className="h-4 w-4" />
											{!isSidebarCollapsed && <span>{label}</span>}
											{isSidebarCollapsed && (
												<span className="sr-only">{label}</span>
											)}
										</button>
									);
								})}
							</section>
							<div
								className={cn(
									"border-t py-4",
									isSidebarCollapsed ? "px-0" : "px-4",
								)}
							>
								<Button
									className={cn(
										"w-full justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700",
										isSidebarCollapsed &&
											"border bg-transparent text-slate-800",
									)}
									onClick={() => setShowCreateBase(true)}
									disabled={isCreating}
								>
									<Plus className="size-4" />
									{!isSidebarCollapsed && <span>Create</span>}
									<span className="sr-only">Create</span>
								</Button>
							</div>
						</nav>
					</aside>
					<main className="h-full flex-1 overflow-y-auto bg-[#f5f6fb] px-12 py-8">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<h2 className="font-semibold text-3xl text-gray-900">Home</h2>
						</div>

						<section className="mt-10 w-[65vw]">
							<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-3">
									<button
										type="button"
										className="flex items-center gap-1 font-medium text-gray-600 text-xs"
									>
										Opened anytime
										<ChevronDown className="h-3.5 w-3.5" />
									</button>
								</div>
								<div className="flex items-center gap-1 rounded-full">
									<button
										type="button"
										onClick={() => setViewMode("list")}
										aria-pressed={viewMode === "list"}
										className={`flex items-center gap-2 rounded-full p-1 font-medium text-sm transition ${
											viewMode === "list"
												? "bg-gray-200"
												: "text-gray-400"
										}`}
									>
										<MenuIcon className="size-4" />
									</button>
									<button
										type="button"
										onClick={() => setViewMode("grid")}
										aria-pressed={viewMode === "grid"}
										className={`flex items-center gap-2 rounded-full p-1 font-medium text-sm transition ${
											viewMode === "grid"
												? "bg-gray-200"
												: "text-gray-400"
										}`}
									>
										<LayoutGrid className="size-4" />
									</button>
								</div>
							</div>
							{viewMode === "list" ? renderList() : renderGrid()}
						</section>

						<Dialog open={showCreateBase} onOpenChange={setShowCreateBase}>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>Create a new base</DialogTitle>
								</DialogHeader>
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="base-name">Base name</Label>
										<Input
											id="base-name"
											type="text"
											value={newBaseName}
											onChange={(event) => setNewBaseName(event.target.value)}
											placeholder="Enter base name"
											autoFocus
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="base-description">
											Description (optional)
										</Label>
										<Textarea
											id="base-description"
											value={newBaseDescription}
											onChange={(event) =>
												setNewBaseDescription(event.target.value)
											}
											placeholder="What is this base for?"
										/>
									</div>
								</div>
								<DialogFooter className="pt-4">
									<Button
										variant="outline"
										onClick={() => setShowCreateBase(false)}
									>
										Cancel
									</Button>
									<Button
										onClick={handleCreateBase}
										disabled={isCreating || !newBaseName.trim()}
									>
										Create
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</main>
				</div>
			</div>
		</div>
	);
}
