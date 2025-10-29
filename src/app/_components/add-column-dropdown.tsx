"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface AddColumnDropdownProps {
	onCreate: (name: string, type: "TEXT" | "NUMBER") => void;
	isLoading: boolean;
	trigger: React.ReactNode;
}

const columnTypes = [
	{
		value: "TEXT" as const,
		icon: "A",
		title: "Single line text",
		description: "A single line of text",
	},
	{
		value: "NUMBER" as const,
		icon: "#",
		title: "Number",
		description: "A number value",
	},
];

export function AddColumnDropdown({
	onCreate,
	isLoading,
	trigger,
}: AddColumnDropdownProps) {
	const [columnName, setColumnName] = useState("");
	const [columnType, setColumnType] = useState<"TEXT" | "NUMBER">("TEXT");
	const [open, setOpen] = useState(false);

	const handleCreate = () => {
		if (columnName.trim()) {
			onCreate(columnName.trim(), columnType);
			setColumnName("");
			setColumnType("TEXT");
			setOpen(false);
		}
	};

	const handleCancel = () => {
		setColumnName("");
		setColumnType("TEXT");
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				{trigger}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 bg-white">
				<div className="p-4">
					<div className="mb-4">
						<Label htmlFor="column-name" className="text-foreground mb-2">
							Column Name
						</Label>
						<Input
							id="column-name"
							type="text"
							value={columnName}
							onChange={(e) => setColumnName(e.target.value)}
							placeholder="Enter column name"
							autoFocus
							className="mt-2"
						/>
					</div>

					<div className="mb-4">
						<Label className="text-foreground mb-2">
							Field Type
						</Label>
						<div className="space-y-2 mt-2">
							{columnTypes.map((type) => (
								<button
									key={type.value}
									type="button"
									onClick={() => setColumnType(type.value)}
									className={cn(
										"w-full flex items-center p-3 text-left transition-colors cursor-pointer flex gap-3 items-center hover:bg-gray-100",
										columnType === type.value
											? "border-primary bg-accent"
											: "border-border"
									)}
								>
									<span className="text-sm text-muted-foreground">{type.icon}</span>
									<div className="font-medium text-foreground text-sm">{type.title}</div>
								</button>
							))}
						</div>
					</div>

					<div className="flex items-center justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleCancel}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={handleCreate}
							disabled={!columnName.trim() || isLoading}
						>
							{isLoading ? "Creating..." : "Create"}
						</Button>
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
