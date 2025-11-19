import {
	SAMPLE_CITIES,
	SAMPLE_COMPANIES,
	SAMPLE_DOMAINS,
	SAMPLE_NAMES,
	SAMPLE_WORDS,
} from "~/lib/fixtures/sampleData";
import type { ColumnMeta, TableData } from "~/types/dataTable";

const MAX_PAGE_SIZE = 500;

const randomItem = <T,>(arr: readonly T[]): T => {
	if (arr.length === 0) {
		throw new Error("randomItem requires a non-empty array");
	}
	return arr[Math.floor(Math.random() * arr.length)]!;
};

const generateOptimisticValue = (column: ColumnMeta, index: number): string => {
	const lower = column.name.toLowerCase();
	if (column.type === "NUMBER") {
		const base = 1 + ((index * 13) % 97);
		if (lower.includes("age")) {
			return String(18 + (base % 70));
		}
		if (lower.includes("price") || lower.includes("amount")) {
			return String(10 + ((base * 7) % 5000));
		}
		return String(base);
	}

	if (lower.includes("name")) {
		return `${randomItem(SAMPLE_NAMES)} ${
			SAMPLE_NAMES[(index + 3) % SAMPLE_NAMES.length] ?? SAMPLE_NAMES[0]
		}`;
	}
	if (lower.includes("email")) {
		const name = (SAMPLE_NAMES[index % SAMPLE_NAMES.length] ?? SAMPLE_NAMES[0])
			.toLowerCase()
			.replace(/\s+/g, ".");
		return `${name}@${randomItem(SAMPLE_DOMAINS)}`;
	}
	if (lower.includes("phone") || lower.includes("tel")) {
		return `+1-555-${String(1000 + ((index * 17) % 9000))}`;
	}
	if (lower.includes("company")) {
		return randomItem(SAMPLE_COMPANIES);
	}
	if (lower.includes("city")) {
		return randomItem(SAMPLE_CITIES);
	}
	if (lower.includes("note") || lower.includes("description")) {
		return `${randomItem(SAMPLE_WORDS)} ${randomItem(SAMPLE_WORDS)}`;
	}

	return `${randomItem(SAMPLE_WORDS)} ${index + 1}`;
};

export const buildOptimisticRows = ({
	columns,
	count,
	startPosition,
	tableId,
	jobId,
}: {
	columns: ColumnMeta[];
	count: number;
	startPosition: number;
	tableId: string;
	jobId: string;
}): TableData[] => {
	return Array.from({ length: Math.min(count, MAX_PAGE_SIZE) }, (_, idx) => {
		const rowId = `optimistic-${jobId}-${startPosition + idx}`;
		return {
			id: rowId,
			position: startPosition + idx,
			createdAt: new Date(),
			updatedAt: new Date(),
			tableId,
			cells: columns.map((column) => ({
				id: `${rowId}-${column.id}`,
				columnId: column.id,
				rowId,
				value: generateOptimisticValue(column, idx),
				column,
			})),
			__optimistic: true,
			__jobId: jobId,
		};
	});
};