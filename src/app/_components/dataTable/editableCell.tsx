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

	// Update draft when value changes (for optimistic updates)
	useEffect(() => {
		if (!isEditing) {
			setDraft(stringValue);
		}
	}, [stringValue, isEditing]);

	useEffect(() => {
		if (!isEditing) return;
		const nextValue =
			initialValue !== undefined && initialValue !== null
				? initialValue
				: stringValue;
		setDraft(nextValue);
		const frame = requestAnimationFrame(() => {
			if (!inputRef.current) return;
			inputRef.current.focus();
			if (initialValue !== undefined && initialValue !== null) {
				const pos = nextValue.length;
				inputRef.current.setSelectionRange(pos, pos);
				onInitialValueConsumed?.();
			} else {
				inputRef.current.select();
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [initialValue, isEditing, onInitialValueConsumed, stringValue]);

	const commit = (nextValue: string) => {
		if (committedRef.current) return;
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
				if (!isEditing) return;
				commit(e.target.value);
			}}
			onChange={(e) => setDraft(e.target.value)}
			onKeyDown={(e) => {
				if (!isEditing) return;
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
		String(prevProps.value ?? "") === String(nextProps.value ?? ""),
);
