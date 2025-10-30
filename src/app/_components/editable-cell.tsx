import type { Table } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";

type TableData = {
	id: string;
	position: number;
	cellValues: Array<{
		id: string;
		textValue: string | null;
		numberValue: number | null;
		column: {
			id: string;
			name: string;
			type: "TEXT" | "NUMBER";
		};
	}>;
};

interface EditableCellProps {
	handleCellUpdate: (
		rowId: string,
		columnId: string,
		value: string | number,
	) => void;
	value: string | number;
	row: { original: TableData };
	column: { id: string; columnDef: { meta?: { type: "TEXT" | "NUMBER" } } };
}

export function EditableCell({
	handleCellUpdate,
	value,
	row,
	column,
}: EditableCellProps) {
	const initialValue = value;
	const [cellValue, setCellValue] = useState(initialValue);
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Get column type from the columns prop or meta
	const columnType = column.columnDef.meta?.type || "TEXT";

	// Sync with external changes
	useEffect(() => {
		setCellValue(initialValue);
	}, [initialValue]);

	// Focus input when editing starts
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const onBlur = () => {
		setIsEditing(false);
		if (cellValue !== initialValue) {
			handleCellUpdate(row.original.id, column.id, cellValue);
		}
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			onBlur();
		} else if (e.key === "Escape") {
			e.preventDefault();
			setCellValue(initialValue);
			setIsEditing(false);
		}
	};

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type={columnType === "NUMBER" ? "number" : "text"}
				value={cellValue as string}
				onChange={(e) => {
					const newValue =
						columnType === "NUMBER" ? Number(e.target.value) : e.target.value;
					setCellValue(newValue);
				}}
				onBlur={onBlur}
				onKeyDown={onKeyDown}
				className="w-full rounded border-none bg-transparent px-1 py-0.5 outline-none focus:bg-blue-50"
			/>
		);
	}

	return (
		<input
			type="text"
			readOnly
			onFocus={() => setIsEditing(true)}
			value={String(cellValue || "")}
			className="h-full min-h-[20px] w-full cursor-text rounded border-none bg-transparent px-1 py-0.5 hover:bg-gray-50 focus:outline-none"
		/>
	);
}
