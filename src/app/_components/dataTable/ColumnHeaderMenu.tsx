"use client";

import { ChevronDown } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

type Props = {
	columnId: string;
	onRename: (id: string) => void;
	onDuplicate: (id: string) => void;
	onDelete: (id: string) => void;
	disabledRename?: boolean;
	disabledDuplicate?: boolean;
};

export function ColumnHeaderMenu({
	columnId,
	onRename,
	onDuplicate,
	onDelete,
	disabledRename,
	disabledDuplicate,
}: Props) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="ml-auto opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
					aria-label="Column menu"
				>
					<ChevronDown className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64 bg-white p-0">
				<div className="p-2">
					<button
						type="button"
						className="w-full rounded px-2 py-2 text-left hover:bg-gray-50"
						disabled={disabledRename}
						onClick={() => onRename(columnId)}
					>
						Rename column
					</button>
					<button
						type="button"
						className="w-full rounded px-2 py-2 text-left hover:bg-gray-50"
						disabled={disabledDuplicate}
						onClick={() => onDuplicate(columnId)}
					>
						Duplicate column
					</button>
					<button
						type="button"
						className="w-full rounded px-2 py-2 text-left text-red-600 hover:bg-red-50"
						onClick={() => onDelete(columnId)}
					>
						Delete column
					</button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
