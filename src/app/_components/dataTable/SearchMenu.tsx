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
			<DropdownMenuContent align="end" className="w-full bg-white">
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
						autoFocus
					/>
					<div className="min-w-20 text-center text-gray-500 text-xs">
						{matchesCount > 0 && `${activeMatchIndex + 1} / ${matchesCount}`}
					</div>
					<div className="flex gap-1">
						<Button
							variant="outline"
							size="icon"
							onClick={gotoPrevMatch}
							disabled={matchesCount === 0}
							aria-label="Previous match"
						>
							<ChevronUp className="size-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onClick={gotoNextMatch}
							disabled={matchesCount === 0}
							aria-label="Next match"
						>
							<ChevronDown className="size-4" />
						</Button>
					</div>
					<Button
						variant="ghost"
						className="cursor-pointer"
						onClick={handleClose}
					>
						<X />
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
