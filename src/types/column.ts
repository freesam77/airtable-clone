import { z } from "zod";

export const columnTypeValues = ["TEXT", "NUMBER"] as const;

export const columnTypeSchema = z.enum(columnTypeValues);

export type ColumnType = z.infer<typeof columnTypeSchema>;
