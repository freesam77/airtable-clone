export const BULK_JOB_STARTED_EVENT = "bulk-job-started";
export const BULK_JOB_COMPLETED_EVENT = "bulk-job-completed";

export type BulkJobStartDetail = {
	tableId: string;
	jobId: string;
	count: number;
	startRowCount: number;
};

export type BulkJobCompletedDetail = {
	tableId: string;
	jobId: string;
};
