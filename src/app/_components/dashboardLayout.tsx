"use client";

import { Database, Home, Plus } from "lucide-react";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

interface DashboardLayoutProps {
	user: Session["user"];
}

export function DashboardLayout({ user }: DashboardLayoutProps) {
    const router = useRouter();
    const [showCreateBase, setShowCreateBase] = useState(false);
    const [newBaseName, setNewBaseName] = useState("");
    const [newBaseDescription, setNewBaseDescription] = useState("");
    const utils = api.useUtils();

	const { data: bases, refetch, isLoading } = api.base.getAll.useQuery();
    const createBase = api.base.create.useMutation({
        onSuccess: (newBase) => {
            void refetch();
            setShowCreateBase(false);
            setNewBaseName("");
            setNewBaseDescription("");
			// After creating a base, create a default table then navigate
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

    const createTable = api.base.createTable.useMutation({
        onSuccess: async (table) => {
            await utils.base.getAll.invalidate();
            void refetch();
            if (table?.id && table?.baseId) {
                router.push(`/${table.baseId}/${table.id}`);
            }
        },
    });

    const isCreating = createBase.isPending || createTable.isPending;

	const getUserInitials = (name: string | null | undefined) => {
		if (!name) return "U";
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
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

		// If base has no tables, create a default one and navigate on success
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

	const mainContent = () => (
		<main className="flex-1 p-8">
			<div className="mb-8 flex items-center justify-between">
				<h2 className="font-semibold text-3xl text-gray-900">Home</h2>
                <Button
                    onClick={() => setShowCreateBase(true)}
                    disabled={isCreating}
                    className="bg-blue-600 hover:bg-blue-700"
                >
					<Plus size={16} className="mr-2" />
					Create a workspace
				</Button>
			</div>

			{/* Bases Grid */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{bases?.map((base) => (
					<button
						key={base.id}
						onClick={() => handleBaseClick(base.id)}
						type="button"
						className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md"
					>
						<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
							<Database size={24} className="text-gray-600" />
						</div>
						<div>
							<h3 className="mb-2 font-semibold text-gray-900 text-lg">
								{base.name}
							</h3>
							{base.description && (
								<p className="mb-3 text-gray-600 text-sm">{base.description}</p>
							)}
						</div>
					</button>
				))}

				{/* Create New Base Card */}
                <button
                    onClick={() => {
                        if (!isCreating) setShowCreateBase(true);
                    }}
                    disabled={isCreating}
                    type="button"
                    className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-gray-300 border-dashed bg-gray-50 p-6 transition-colors hover:border-gray-400 hover:bg-gray-100"
                >
					<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white">
						<Plus size={24} className="text-gray-400" />
					</div>
					<span className="font-medium text-gray-600 text-sm">
						Create new workspace
					</span>
				</button>
			</div>

			{/* Create Base Dialog */}
			<Dialog open={showCreateBase} onOpenChange={setShowCreateBase}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Create new workspace</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="workspace-name">Workspace name</Label>
							<Input
								id="workspace-name"
								type="text"
								value={newBaseName}
								onChange={(e) => setNewBaseName(e.target.value)}
								placeholder="Enter workspace name"
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="workspace-description">
								Description (optional)
							</Label>
							<Textarea
								id="workspace-description"
								value={newBaseDescription}
								onChange={(e) => setNewBaseDescription(e.target.value)}
								placeholder="What is this workspace for?"
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setShowCreateBase(false);
                            setNewBaseName("");
                            setNewBaseDescription("");
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateBase}
                        disabled={!newBaseName.trim() || isCreating}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isCreating ? "Creating..." : "Create workspace"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </main>
    );

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Top Navigation */}
			<header className="border-gray-200 border-b bg-white px-6 py-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Image
							src="/airtable-logo.png"
							alt="Airtable"
							width={100}
							height={100}
							priority
						/>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
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
							<Button variant="default" size="sm" onClick={handleSignOut}>
								Log out
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Sidebar */}
			<div className="flex">
				<aside className="w-64 border-gray-200 border-r bg-white">
					<nav className="p-4">
						<div className="space-y-2">
							<div className="rounded-lg bg-blue-50 px-3 py-2">
								<div className="flex items-center gap-2 font-medium text-blue-700 text-sm">
									<Home size={16} />
									Home
								</div>
							</div>
						</div>
					</nav>
				</aside>

				{/* Main Content */}
				{!isLoading ? mainContent() : <div>Loading</div>}
            </div>

            {isCreating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
                    <div className="text-gray-700">Creating your workspace…</div>
                </div>
            )}
        </div>
    );
}

// Full-screen overlay to block interaction while creating a base/table
// Placed after main export so JSX above remains focused on layout concerns
