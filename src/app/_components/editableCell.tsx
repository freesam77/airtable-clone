import type { StringColorFormat } from "@faker-js/faker";
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
	const [cell, setCell] = useState(initialValue);
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Get column type from the columns prop or meta
	const columnType = column.columnDef.meta?.type || "TEXT";

	// Sync with external changes
	useEffect(() => {
		setCell(initialValue);
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
        if (cell !== initialValue) {
            handleCellUpdate(rowId, column.id, cell);
        }
    };

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			onBlur();
		} else if (e.key === "Escape") {
			e.preventDefault();
			setCell(initialValue);
			setIsEditing(false);
		}
	};

	if (isEditing) {
		return (
            <input
                ref={inputRef}
                type={columnType === "NUMBER" ? "number" : "text"}
                value={String(cell ?? "")}
                onChange={(e) => {
                    const raw = e.target.value;
                    // For numbers, keep empty string as empty (means clear)
                    if (columnType === "NUMBER") {
                        setCell(raw === "" ? "" : Number(raw));
                    } else {
                        setCell(raw);
                    }
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
            value={String(cell ?? "")}
            className="h-full min-h-[20px] w-full cursor-text rounded border-none bg-transparent px-1 py-0.5 hover:bg-gray-50 focus:outline-none"
        />
    );
}
