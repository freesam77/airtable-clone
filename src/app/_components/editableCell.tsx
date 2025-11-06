import { useEffect, useRef, useState } from "react";

interface EditableCellProps {
	handleCellUpdate: (
		rowId: string,
		columnId: string,
		value: string | number,
	) => void;
	value: string | number;
	rowId: string;
	column: { id: string; columnDef: { meta?: { type: "TEXT" | "NUMBER" } } };
}

export function EditableCell({
	handleCellUpdate,
	value,
	rowId,
	column,
}: EditableCellProps) {
	const initialValue = value;
	const [cellValue, setCellValue] = useState(initialValue);
	const inputRef = useRef<HTMLInputElement>(null);
	const committedRef = useRef(false);

	// Keep local state in sync when external value changes
	useEffect(() => {
		setCellValue(initialValue);
	}, [initialValue]);

	const commit = (val: string | number) => {
		committedRef.current = true;
		handleCellUpdate(rowId, column.id, val);
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === "Escape") {
			commit(cellValue);
			// For Enter/Escape, manually blur; for Tab, let native tabbing move focus
			if (e.key === "Enter" || e.key === "Escape") {
				inputRef.current?.blur();
				e.preventDefault();
			}
		}
	};

	return (
		<input
			ref={inputRef}
			type={column.columnDef.meta?.type === "NUMBER" ? "number" : "text"}
			value={String(cellValue ?? "")}
			onChange={(e) => {
				const inputValue = e.target.value.toString();
				if (cellValue !== inputValue) {
					setCellValue(inputValue);
				}
			}}
			onKeyDown={onKeyDown}
			onFocus={() => {
				committedRef.current = false;
			}}
			onBlur={(e) => {
				// Avoid double-queuing if we already committed via keydown
				if (!committedRef.current) {
					const inputValue = e.target.value.toString();
					commit(inputValue);
				}
			}}
			className="h-full min-h-5 w-full cursor-text border-gray-200 bg-transparent px-1 hover:bg-gray-50 focus:bg-blue-50 focus:outline-none"
		/>
	);
}
