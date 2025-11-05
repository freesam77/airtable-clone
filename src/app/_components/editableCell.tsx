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
	const inputRef = useRef<HTMLInputElement>(null);

	// Get column type from the columns prop or meta
	const columnType = column.columnDef.meta?.type || "TEXT";

	// Sync with external changes
	useEffect(() => {
		setCell(initialValue);
	}, [initialValue]);


	const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Move focus out to mimic commit behavior
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Revert to original and notify
      setCell(initialValue);
      handleCellUpdate(rowId, column.id, initialValue);
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type={columnType === "NUMBER" ? "number" : "text"}
      value={String(cell ?? "")}
      onChange={(e) => {
        const raw = e.target.value;
        if (columnType === "NUMBER") {
          const next = raw === "" ? "" : Number(raw);
          setCell(next);
          handleCellUpdate(rowId, column.id, next as string | number);
        } else {
          setCell(raw);
          handleCellUpdate(rowId, column.id, raw);
        }
      }}
      onKeyDown={onKeyDown}
      className="h-full min-h-5 w-full cursor-text border-gray-200 bg-transparent px-1 hover:bg-gray-50 focus:bg-blue-50 focus:outline-none"
    />
  );
}
