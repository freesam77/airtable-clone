"use client";

import { 
	ChevronDown, 
	Edit3, 
	Copy, 
	EyeOff, 
	Trash2
} from "lucide-react";
import { memo, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";

type Props = {
	columnId: string;
	columnName: string;
	columnType?: string;
	onRename: (id: string, newName: string) => void;
	onDuplicate: (id: string) => void;
	onDelete: (id: string) => void;
	onHide?: (id: string) => void;
	disabledRename?: boolean;
	disabledDuplicate?: boolean;
	disabledDelete?: boolean;
};

function ColumnHeaderMenuComponent({
	columnId,
	columnName,
	columnType = "TEXT",
	onRename,
	onDuplicate,
	onDelete,
	onHide,
	disabledRename,
	disabledDuplicate,
	disabledDelete,
}: Props) {
	const [isEditingField, setIsEditingField] = useState(false);
	const [editValue, setEditValue] = useState(() => {
		// Ensure we always have a string value
		if (typeof columnName === 'string') return columnName;
		if (columnName && typeof (columnName as any).toString === 'function') {
			return (columnName as any).toString();
		}
		return String(columnName || '');
	});
	const [editType, setEditType] = useState(columnType);
	const [open, setOpen] = useState(false);

	const handleEditField = () => {
		setIsEditingField(true);
		// Handle different types of columnName
		if (typeof columnName === 'string') {
			setEditValue(columnName);
		} else if (columnName && typeof (columnName as any).toString === 'function') {
			setEditValue((columnName as any).toString());
		} else {
			setEditValue(String(columnName || ''));
		}
		setEditType(columnType);
	};

	const getFieldTypeLabel = (type: string) => {
		switch (type) {
			case "TEXT": return "Text";
			case "NUMBER": return "Number";
			default: return "Text";
		}
	};

	const handleSaveEdit = () => {
		const trimmedValue = (editValue || "").trim();
		if (trimmedValue && trimmedValue !== columnName) {
			onRename(columnId, trimmedValue);
		}
		setIsEditingField(false);
		setOpen(false);
	};

	const handleCancelEdit = () => {
		setIsEditingField(false);
		// Handle different types of columnName
		if (typeof columnName === 'string') {
			setEditValue(columnName);
		} else if (columnName && typeof (columnName as any).toString === 'function') {
			setEditValue((columnName as any).toString());
		} else {
			setEditValue(String(columnName || ''));
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSaveEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			handleCancelEdit();
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					data-column-menu-trigger={columnId}
					className="ml-auto opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
					aria-label="Column menu"
				>
					<ChevronDown className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-80 bg-white p-0">
				{isEditingField ? (
					<div className="p-4 space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Field name
							</label>
							<Input
								value={editValue}
								onChange={(e) => setEditValue(e.target.value)}
								onKeyDown={handleKeyDown}
								autoFocus
								className="h-8 text-sm"
								placeholder="Field name"
							/>
						</div>
						
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Field type
							</label>
							<Select value={editType} onValueChange={setEditType}>
								<SelectTrigger className="h-8 text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="TEXT">Text</SelectItem>
									<SelectItem value="NUMBER">Number</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex justify-end gap-2 pt-2">
							<Button
								type="button"
								variant="ghost"
								onClick={handleCancelEdit}
								className="text-xs"
                                size="sm"
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={handleSaveEdit}
								disabled={!((editValue || "").toString().trim())}
								className="bg-blue-500 text-white text-xs"
                                size="sm"
							>
								Save
							</Button>
						</div>
					</div>
				) : (
					<div className="p-1">
						<button
							type="button"
							className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
							disabled={disabledRename}
							onClick={handleEditField}
						>
							<Edit3 className="size-4" />
							Edit field
						</button>
						<button
							type="button"
							className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
							disabled={disabledDuplicate}
							onClick={() => onDuplicate(columnId)}
						>
							<Copy className="size-4" />
							Duplicate field
						</button>
						{onHide && (
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50"
								onClick={() => onHide(columnId)}
							>
								<EyeOff className="size-4" />
								Hide field
							</button>
						)}
						<button
							type="button"
							className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50"
							disabled={disabledDelete}
							onClick={() => onDelete(columnId)}
						>
							<Trash2 className="size-4" />
							Delete field
						</button>
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export const ColumnHeaderMenu = memo(
	ColumnHeaderMenuComponent,
	(prev, next) =>
		prev.columnId === next.columnId &&
		prev.columnName === next.columnName &&
		prev.columnType === next.columnType &&
		prev.disabledRename === next.disabledRename &&
		prev.disabledDuplicate === next.disabledDuplicate &&
		prev.disabledDelete === next.disabledDelete &&
		prev.onRename === next.onRename &&
		prev.onDuplicate === next.onDuplicate &&
		prev.onDelete === next.onDelete &&
		prev.onHide === next.onHide,
);
