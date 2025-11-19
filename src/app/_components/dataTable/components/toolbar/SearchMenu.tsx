import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";

type SearchMenuProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: string;
	onValueChange: (value: string) => void;
	matchesCount: number;
	activeMatchIndex: number;
	gotoPrevMatch: () => void;
	gotoNextMatch: () => void;
};

export function SearchMenu({
	open,
	onOpenChange,
	value,
	onValueChange,
	matchesCount,
	activeMatchIndex,
	gotoPrevMatch,
	gotoNextMatch,
}: SearchMenuProps) {
	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);
		if (!nextOpen) {
			onValueChange("");
		}
	};

	const handleClose = () => {
		onValueChange("");
		onOpenChange(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="cursor-pointer">
					<Search />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-full rounded-t-none bg-white shadow-xs">
				<div className="flex items-center gap-3">
					<Input
						id="table-search"
						type="text"
						value={value}
						onChange={(e) => onValueChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === "NumpadEnter") {
								e.preventDefault();
								e.stopPropagation();
								if (e.shiftKey) gotoPrevMatch();
								else gotoNextMatch();
							}
						}}
						placeholder="Find in view"
                        className="text-xs! shadow-none outline-none"
						autoFocus
					/>
					<div className="min-w-20 text-center text-gray-500 text-xs">
						{matchesCount > 0 && `${activeMatchIndex + 1} of ${matchesCount}`}
					</div>
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="icon"
                            className="w-6 cursor-pointer"
							onClick={gotoPrevMatch}
							disabled={matchesCount === 0}
							aria-label="Previous match"
						>
							<ChevronUp className="size-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
                            className="w-6 cursor-pointer"
							onClick={gotoNextMatch}
							disabled={matchesCount === 0}
							aria-label="Next match"
						>
							<ChevronDown className="size-4" />
						</Button>
					</div>
					<Button
						variant="ghost"
						className="cursor-pointer pl-0!"
						onClick={handleClose}
					>
						<X />
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
