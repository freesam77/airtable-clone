import { memo, useEffect, useRef, useState } from "react";
import type { ColumnType } from "~/types/column";

interface EditableCellProps {
	value: string | number | null;
	type: ColumnType;
	cellKey: string;
	isEditing: boolean;
	onCommit: (value: string, previousValue: string | number | null) => void;
	onCancel: () => void;
	onNavigate?: (direction: "forward" | "backward") => void;
	initialValue?: string | null;
	onInitialValueConsumed?: () => void;
}

function EditableCellComponent({
	value,
	type,
	cellKey,
	isEditing,
	onCommit,
	onCancel,
	onNavigate,
	initialValue,
	onInitialValueConsumed,
}: EditableCellProps) {
	const stringValue =
		value === null || value === undefined ? "" : String(value);
	
	const [draft, setDraft] = useState(stringValue);
	const inputRef = useRef<HTMLInputElement>(null);
	const committedRef = useRef(false);
	const hasFocusedRef = useRef(false);
	const isEditingRef = useRef(isEditing);
	
	// Track the editing state to prevent unnecessary updates during editing
	useEffect(() => {
		isEditingRef.current = isEditing;
	}, [isEditing]);

	// Update draft when value changes, but only when not editing to avoid interrupting user input
	useEffect(() => {
		if (!isEditing) {
			setDraft(stringValue);
			hasFocusedRef.current = false; // Reset for next edit session
		}
	}, [stringValue, isEditing]);

	useEffect(() => {
		if (!isEditing) return;
		
		// Focus and handle initial value immediately
		if (!hasFocusedRef.current) {
			hasFocusedRef.current = true;
			
			if (inputRef.current) {
				inputRef.current.focus();
				
				// If we have an initial value (user typed a character), 
				// immediately overwrite with just that character
				if (initialValue !== undefined && initialValue !== null) {
					// Set the input value directly and update draft
					const newValue = initialValue;
					inputRef.current.value = newValue;
					setDraft(newValue);
					
					// Position cursor at end to prevent selection
					if (type !== "NUMBER") {
						inputRef.current.setSelectionRange(newValue.length, newValue.length);
					}
					
					onInitialValueConsumed?.();
				} else {
					// For Enter key editing, use the existing cell value
					setDraft(stringValue);
					// Position cursor at end for Enter editing
					if (type !== "NUMBER") {
						const len = stringValue.length;
						inputRef.current.setSelectionRange(len, len);
					}
				}
			}
		}
	}, [initialValue, isEditing, onInitialValueConsumed, stringValue, type]);

	const commit = (nextValue: string) => {
		if (committedRef.current || !isEditingRef.current) return;
		committedRef.current = true;
		onCommit(nextValue, value);
	};

	return (
		<input
			ref={inputRef}
			type={type === "NUMBER" ? "number" : "text"}
			value={draft}
			data-cell-input={cellKey}
			readOnly={!isEditing}
			tabIndex={isEditing ? 0 : -1}
			onFocus={() => {
				committedRef.current = false;
				if (!isEditing) {
					inputRef.current?.blur();
				}
			}}
			onBlur={(e) => {
				if (!isEditingRef.current) return;
				commit(e.target.value);
			}}
			onChange={(e) => {
				if (isEditingRef.current) {
					setDraft(e.target.value);
				}
			}}
			onKeyDown={(e) => {
				if (!isEditingRef.current) return;
				if (e.key === "Enter") {
					e.preventDefault();
					commit((e.target as HTMLInputElement).value);
				} else if (e.key === "Tab") {
					e.preventDefault();
					const target = e.target as HTMLInputElement;
					commit(target.value);
					inputRef.current?.blur();
					onNavigate?.(e.shiftKey ? "backward" : "forward");
				} else if (e.key === "Escape") {
					e.preventDefault();
					committedRef.current = true;
					setDraft(stringValue);
					onCancel();
				}
			}}
			className={`relative z-10 w-full truncate border-none px-1 text-gray-900 text-sm outline-none ${isEditing ? "" : "pointer-events-none select-none"}`}
		/>
	);
}

export const EditableCell = memo(
	EditableCellComponent,
	(prevProps, nextProps) =>
		prevProps.type === nextProps.type &&
		prevProps.isEditing === nextProps.isEditing &&
		prevProps.initialValue === nextProps.initialValue &&
		prevProps.cellKey === nextProps.cellKey &&
		String(prevProps.value ?? "") === String(nextProps.value ?? ""),
);