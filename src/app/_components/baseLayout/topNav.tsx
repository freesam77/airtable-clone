"use client";
import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";

type Table = { id: string; name: string };
type Base = { name: string; description?: string | null; tables: Table[] };

interface TopNavProps {
    selectedBase: Base;
    rowCount: number;
    setRowCount: (value: number) => void;
    handleGenerateRows: () => void;
    generateRows: { isPending: boolean };
    selectedTableId: string | null;
    handleTableSelect: (tableId: string) => void;
    showCreateTable: boolean;
    setShowCreateTable: (show: boolean) => void;
    newTableName: string;
    setNewTableName: (name: string) => void;
    handleCreateTable: () => void;
    createTable: { isPending: boolean };
}

export const TopNav = ({
    selectedBase,
    rowCount,
    setRowCount,
    handleGenerateRows,
    generateRows,
    selectedTableId,
    handleTableSelect,
    showCreateTable,
    setShowCreateTable,
    newTableName,
    setNewTableName,
    handleCreateTable,
    createTable,
}: TopNavProps) => (
    <div className="border-gray-200 border-b bg-white">
        {/* Base name and description */}
        <div className="px-6 py-3">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-semibold text-gray-900 text-xl">
                        {selectedBase.name}
                    </h1>
                    {selectedBase.description && (
                        <p className="text-gray-500 text-sm">
                            {selectedBase.description}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={rowCount}
                            onChange={(e) =>
                                setRowCount(
                                    Math.max(
                                        1,
                                        Math.min(100, Number.parseInt(e.target.value) || 1),
                                    ),
                                )
                            }
                            className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                            min="1"
                            max="100"
                        />
                        <button
                            type="button"
                            onClick={handleGenerateRows}
                            disabled={generateRows.isPending}
                            className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 font-medium text-sm text-white hover:bg-green-700 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            {generateRows.isPending ? "Generating..." : "Generate Rows"}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Table tabs */}
        <div className="border-gray-200 border-b bg-gray-50 px-6">
            <div className="flex items-center gap-1">
                {selectedBase.tables.map((table) => (
                    <button
                        type="button"
                        key={table.id}
                        onClick={() => handleTableSelect(table.id)}
                        className={`rounded-t border-x border-t px-3 py-2 font-medium text-sm ${
                            selectedTableId === table.id
                                ? "border-gray-300 bg-white text-gray-900"
                                : "border-transparent bg-transparent text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        {table.name}
                    </button>
                ))}
                {showCreateTable ? (
                    <CreateTableInlineInput
                        newTableName={newTableName}
                        setNewTableName={setNewTableName}
                        handleCreateTable={handleCreateTable}
                        setShowCreateTable={setShowCreateTable}
                        isPending={createTable.isPending}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowCreateTable(true)}
                        className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-gray-600 text-sm hover:bg-gray-50"
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>
        </div>
    </div>
);

interface CreateTableInlineInputProps {
    newTableName: string;
    setNewTableName: (name: string) => void;
    handleCreateTable: () => void;
    setShowCreateTable: (show: boolean) => void;
    isPending: boolean;
}

const CreateTableInlineInput = ({
    newTableName,
    setNewTableName,
    handleCreateTable,
    setShowCreateTable,
    isPending,
}: CreateTableInlineInputProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <div className="ml-2 flex items-center gap-2">
            <input
                            type="text"
                            placeholder="Table name"
                            value={newTableName}
                            onChange={(e) => setNewTableName(e.target.value)}
                            className="rounded border border-gray-300 px-2 py-1 text-sm"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleCreateTable();
                                } else if (e.key === "Escape") {
                                    setShowCreateTable(false);
                                    setNewTableName("");
                                }
                            }}
                ref={inputRef}
                        />
                        <button
                            type="button"
                            onClick={handleCreateTable}
                disabled={!newTableName.trim() || isPending}
                            className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            Add
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowCreateTable(false);
                                setNewTableName("");
                            }}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-600 text-sm hover:bg-gray-50"
                        >
                            Cancel
                        </button>
        </div>
    );
};