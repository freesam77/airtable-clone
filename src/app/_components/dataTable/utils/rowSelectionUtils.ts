/**
 * Toggle all rows selection state
 * @param checked - Whether to select or deselect all
 * @param visibleIds - Array of visible row IDs
 * @param setSelectedRowIds - State setter for selected row IDs
 */
export const toggleAllRowsSelection = (
	checked: boolean,
	visibleIds: string[],
	setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>
): void => {
	setSelectedRowIds((prev) => {
		const next = new Set(prev);
		if (checked) {
			for (const id of visibleIds) next.add(id);
		} else {
			for (const id of visibleIds) next.delete(id);
		}
		return next;
	});
};

/**
 * Toggle a single row selection state
 * @param rowId - The row ID to toggle
 * @param setSelectedRowIds - State setter for selected row IDs
 */
export const toggleSingleRowSelection = (
	rowId: string,
	setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>
): void => {
	setSelectedRowIds((prev) => {
		const next = new Set(prev);
		if (next.has(rowId)) {
			next.delete(rowId);
		} else {
			next.add(rowId);
		}
		return next;
	});
};

/**
 * Check if some (but not all) visible rows are selected
 * @param visibleIds - Array of visible row IDs
 * @param selectedRowIds - Set of selected row IDs
 * @returns True if some visible rows are selected
 */
export const hasPartialSelection = (
	visibleIds: string[],
	selectedRowIds: Set<string>
): boolean => {
	return visibleIds.some((id) => selectedRowIds.has(id));
};