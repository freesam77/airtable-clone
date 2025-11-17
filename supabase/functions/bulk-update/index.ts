// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { faker } from "npm:@faker-js/faker@10";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Pool } from "npm:pg@8";
import type { PoolClient } from "npm:pg@8";

const supabaseUrl = Deno.env.get("PROJECT_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const databaseUrl = Deno.env.get("DB_URL");

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error("Missing URL or SERVICE_ROLE_KEY env vars.");
}

if (!databaseUrl) {
	throw new Error("Missing DB_URL or DATABASE_URL env var.");
}

const queueName = Deno.env.get("BULK_UPDATE_QUEUE") ?? "bulk_update";
const messagesPerRun = Math.max(
	1,
	Number(Deno.env.get("BULK_UPDATE_MESSAGES_PER_RUN") ?? "1"),
);

const DEFAULT_ROW_CHUNK_SIZE = 250;
const parsedChunk =
	Number(Deno.env.get("BULK_UPDATE_ROW_CHUNK_SIZE") ?? "") ||
	DEFAULT_ROW_CHUNK_SIZE;
const rowChunkSize = Math.max(25, parsedChunk);
const BULK_QUEUE_EVENT_TYPE = "BULK_RANDOM_ROW_GENERATION";

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const pool = new Pool({
	connectionString: databaseUrl,
	ssl: { rejectUnauthorized: false },
	max: 1,
});

// Keep ColumnType in sync with src/types/column.ts
type ColumnType = "TEXT" | "NUMBER";

interface ColumnDefinition {
	id: string;
	name: string;
	type: ColumnType;
}

interface RowInsertRecord {
	id: string;
	position: number;
	tableId: string;
	createdAt: Date;
	updatedAt: Date;
}

interface CellInsertRecord {
	id: string;
	rowId: string;
	columnId: string;
	value: string;
}

interface BulkJobPayload {
	type: string;
	tableId: string;
	tableName?: string | null;
	count: number;
	requestedBy: string;
	requestedAt: string;
}

interface QueueMessage {
	msg_id: number;
	message: BulkJobPayload | null;
}

const TEXT_HINT_GENERATORS = [
	{ pattern: /name/i, generate: () => faker.person.fullName() },
	{
		pattern: /email/i,
		generate: () =>
			faker.internet.email({
				firstName: faker.person.firstName(),
				lastName: faker.person.lastName(),
			}),
	},
	{ pattern: /phone|tel/i, generate: () => faker.phone.number() },
	{ pattern: /company|org|business/i, generate: () => faker.company.name() },
	{ pattern: /city/i, generate: () => faker.location.city() },
	{ pattern: /country/i, generate: () => faker.location.country() },
	{
		pattern: /address|street/i,
		generate: () => faker.location.streetAddress(),
	},
	{ pattern: /note|description/i, generate: () => faker.lorem.sentence() },
] satisfies Array<{ pattern: RegExp; generate: () => string }>;

const NUMBER_HINT_GENERATORS = [
	{ pattern: /age/i, generate: () => faker.number.int({ min: 18, max: 95 }) },
	{
		pattern: /price|amount|total|cost/i,
		generate: () => faker.number.int({ min: 5, max: 5000 }),
	},
	{
		pattern: /quantity|count/i,
		generate: () => faker.number.int({ min: 1, max: 250 }),
	},
] satisfies Array<{ pattern: RegExp; generate: () => number }>;

const generateRandomValue = (column: ColumnDefinition): string => {
	if (column.type === "NUMBER") {
		const numberHint = NUMBER_HINT_GENERATORS.find((hint) =>
			hint.pattern.test(column.name),
		);
		const value = numberHint
			? numberHint.generate()
			: faker.number.int({ min: 1, max: 1000 });
		return String(value);
	}

	const hint = TEXT_HINT_GENERATORS.find((entry) =>
		entry.pattern.test(column.name),
	);
	if (hint) {
		return hint.generate();
	}

	return faker.lorem.words(2);
};

const fetchTableMetadata = async (client: PoolClient, tableId: string) => {
	const columnResult = await client.query<ColumnDefinition>(
		'SELECT "id", "name", "type" FROM "Column" WHERE "tableId" = $1 ORDER BY "position" ASC',
		[tableId],
	);

	const columns = columnResult.rows;
	if (!columns.length) {
		throw new Error(`Table ${tableId} does not have any columns.`);
	}

	const maxResult = await client.query<{ max_position: string | null }>(
		'SELECT COALESCE(MAX("position"), -1) AS max_position FROM "Row" WHERE "tableId" = $1',
		[tableId],
	);

	const maxPosition = Number(maxResult.rows[0]?.max_position ?? -1);

	return {
		columns,
		nextPosition: maxPosition + 1,
	};
};

const insertRowBatch = async (
	client: PoolClient,
	tableId: string,
	startPosition: number,
	count: number,
) => {
	if (count <= 0) return [] as Array<{ id: string }>;

	const timestamp = new Date();
	const rowsToInsert: RowInsertRecord[] = Array.from(
		{ length: count },
		(_, i) => ({
			id: crypto.randomUUID(),
			position: startPosition + i,
			tableId,
			createdAt: timestamp,
			updatedAt: timestamp,
		}),
	);

	const values = rowsToInsert.map(
		(_, index) =>
			`($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${
				index * 5 + 5
			})`,
	);
	const params = rowsToInsert.flatMap((row) => [
		row.id,
		row.position,
		row.tableId,
		row.createdAt,
		row.updatedAt,
	]);

	const insert = `INSERT INTO "Row" ("id", "position", "tableId", "createdAt", "updatedAt") VALUES ${values.join(
		", ",
	)} RETURNING "id"`;

	const result = await client.query<{ id: string }>(insert, params);
	return result.rows;
};

const insertCellsForRows = async (
	client: PoolClient,
	rows: Array<{ id: string }>,
	columns: ColumnDefinition[],
) => {
	if (!rows.length || !columns.length) return;

	const cellRecords: CellInsertRecord[] = [];

	for (const row of rows) {
		for (const column of columns) {
			cellRecords.push({
				id: crypto.randomUUID(),
				rowId: row.id,
				columnId: column.id,
				value: generateRandomValue(column),
			});
		}
	}

	const tuples = cellRecords.map(
		(_, index) =>
			`($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`,
	);
	const params = cellRecords.flatMap((cell) => [
		cell.id,
		cell.rowId,
		cell.columnId,
		cell.value,
	]);

	const query = `INSERT INTO "Cell" ("id", "rowId", "columnId", "value") VALUES ${tuples.join(
		", ",
	)}`;

	await client.query(query, params);
};

const processBulkJob = async (payload: BulkJobPayload) => {
	if (!payload.tableId || payload.count <= 0) {
		throw new Error("Invalid job payload");
	}

	const client = await pool.connect();
	try {
		const { columns, nextPosition } = await fetchTableMetadata(
			client,
			payload.tableId,
		);

		let processed = 0;
		let cursor = nextPosition;

		while (processed < payload.count) {
			const rowsInBatch = Math.min(rowChunkSize, payload.count - processed);
			await client.query("BEGIN");
			try {
				const newRows = await insertRowBatch(
					client,
					payload.tableId,
					cursor,
					rowsInBatch,
				);
				await insertCellsForRows(client, newRows, columns);
				await client.query("COMMIT");
				processed += rowsInBatch;
				cursor += rowsInBatch;
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			}
		}

		return processed;
	} finally {
		client.release();
	}
};

const deleteMessage = async (msgId: number) => {
	const { error } = await supabase.schema("pgmq_public").rpc("delete", {
		queue_name: queueName,
		message_id: msgId,
	});

	if (error) {
		console.error(`Failed to delete message ${msgId}`, error);
	}
};

export const readQueueMessages = async () =>
	supabase.schema("pgmq_public").rpc("read", {
		queue_name: queueName,
		sleep_seconds: 0,
		n: messagesPerRun,
	});

Deno.serve(async () => {
	const { data, error } = await readQueueMessages();

	if (error) {
		console.error("Failed to read queue", error);
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const messages = (data as QueueMessage[]) ?? [];
	const message = messages[0];

	if (!message) {
		return new Response(
			JSON.stringify({ processed: 0, queue: queueName, message: "No jobs" }),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}

	const successes: Array<{ msgId: number; inserted: number }> = [];
	const failures: Array<{ msgId: number; error: string }> = [];

	try {
		if (message.message?.type !== BULK_QUEUE_EVENT_TYPE) {
			throw new Error("Unexpected job type");
		}

		const inserted = await processBulkJob(message.message);

		await deleteMessage(message.msg_id);
		successes.push({ msgId: message.msg_id, inserted });
	} catch (err) {
		console.error(`Job ${message.msg_id} failed`, err);
		failures.push({
			msgId: message.msg_id,
			error: err instanceof Error ? err.message : String(err),
		});
	}

	return new Response(
		JSON.stringify({
			queue: queueName,
			processed: successes.length,
			jobs: successes,
			failures,
		}),
		{
			status: failures.length ? 207 : 200,
			headers: { "Content-Type": "application/json" },
		},
	);
});
