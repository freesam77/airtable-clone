import { memo, useEffect, useRef, useState } from "react";
import type React from "react";

type ColumnType = "TEXT" | "NUMBER";

interface EditableCellProps {
	handleCellUpdate: (
		rowId: string,
		columnId: string,
		value: string | number,
	) => void;
	value: string | number;
	rowId: string;
	columnId: string;
	type: ColumnType;
}

function EditableCellComponent({
	handleCellUpdate,
	value,
	rowId,
	columnId,
	type,
}: EditableCellProps) {
	const [cellValue, setCellValue] = useState(String(value ?? ""));
	const inputRef = useRef<HTMLInputElement>(null);
	const committedRef = useRef(false);

	useEffect(() => {
		setCellValue(String(value ?? ""));
	}, [value]);

	const commit = (val: string | number) => {
		committedRef.current = true;
		handleCellUpdate(rowId, columnId, val);
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === "Escape") {
			commit(cellValue);
			inputRef.current?.blur();
			e.preventDefault();
		}
	};

	return (
		<input
			ref={inputRef}
			type={type === "NUMBER" ? "number" : "text"}
			value={String(cellValue ?? "")}
			onChange={(e) => {
				const inputValue = e.target.value.toString();
				if (cellValue !== inputValue) setCellValue(inputValue);
			}}
			onKeyDown={onKeyDown}
			onFocus={() => {
				committedRef.current = false;
			}}
			onBlur={(e) => {
				if (!committedRef.current) commit(e.target.value.toString());
			}}
			className=" w-full cursor-text overflow-hidden truncate whitespace-nowrap border-gray-200 bg-transparent px-1 hover:bg-gray-50 focus:bg-blue-50 focus:outline-none"
		/>
	);
}

export const EditableCell = memo(
	EditableCellComponent,
	(prevProps, nextProps) =>
		prevProps.rowId === nextProps.rowId &&
		prevProps.columnId === nextProps.columnId &&
		prevProps.type === nextProps.type &&
		String(prevProps.value ?? "") === String(nextProps.value ?? ""),
);
