"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Filter, Group, Palette } from "lucide-react";
import type { Session } from "next-auth";
import Link from "next/link";
import { type Contact, generateFakeContacts } from "~/lib/fake-data";
import { DataTable } from "./data-table";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
	user: Session["user"];
}

const data = generateFakeContacts(4);

const columns: ColumnDef<Contact>[] = [
	{
		accessorKey: "fullName",
		header: "Full Name",
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				<div className="h-8 w-8 overflow-hidden rounded-full bg-gray-200">
					<img
						src={row.original.profilePhoto}
						alt={row.original.fullName}
						className="h-full w-full object-cover"
					/>
				</div>
				<span className="font-medium">{row.original.fullName}</span>
			</div>
		),
	},
	{
		accessorKey: "username",
		header: "Username",
	},
	{
		accessorKey: "profilePhoto",
		header: "Profile Photo",
		cell: ({ row }) => (
			<div className="h-8 w-8 overflow-hidden rounded-full bg-gray-200">
				<img
					src={row.original.profilePhoto}
					alt={row.original.fullName}
					className="h-full w-full object-cover"
				/>
			</div>
		),
	},
	{
		accessorKey: "emailAddress",
		header: "Email Address",
	},
	{
		accessorKey: "phoneNumber",
		header: "Phone Number",
	},
	{
		accessorKey: "receivedPings",
		header: "Received Pings",
	},
	{
		accessorKey: "sentPings",
		header: "Sent Pings",
	},
	{
		accessorKey: "lastPingSentAt",
		header: "Last Ping Sent At",
	},
	{
		accessorKey: "lastPingReceivedAt",
		header: "Last Ping Received At",
	},
];

export function DashboardLayout({ user }: DashboardLayoutProps) {
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
		<div className="flex h-screen bg-gray-50">
			<Sidebar user={user} />

			<div className="flex flex-1 flex-col">
				{/* Top Navigation Bar */}
				<div className="border-gray-200 border-b bg-white px-6 py-3">
					<div className="flex items-center justify-end">
						{/* Right - Log out button */}
						<div className="flex items-center gap-2">
							<form action="/api/auth/signout" method="post">
								<button
									type="submit"
									className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-sm text-white hover:bg-blue-700"
								>
									Log out
								</button>
							</form>
						</div>
					</div>
				</div>

				{/* Main Content */}
				<div className="flex-1 p-6">
					<div className="mb-4 flex items-center justify-between">
						<div className="flex items-center gap-4">
							<button className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<Filter size={16} />
								Hide fields
							</button>
							<button className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<Filter size={16} />
								Filter
							</button>
							<button className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<Group size={16} />
								Group
							</button>
							<button className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<ArrowUpDown size={16} />
								Sort
							</button>
							<button className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
								<Palette size={16} />
								Color
							</button>
						</div>
					</div>

					<DataTable data={data} columns={columns} />
				</div>
			</div>
		</div>
	);
}
