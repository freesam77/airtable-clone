/*
  Warnings:

  - A unique constraint covering the columns `[tableId,position]` on the table `Column` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tableId,position,id]` on the table `Row` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."idx_row_table_position_id";

-- CreateIndex
CREATE INDEX "cell_row_column_idx" ON "Cell"("rowId", "columnId");

-- CreateIndex
CREATE INDEX "Column_position_idx" ON "Column"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Column_tableId_position_key" ON "Column"("tableId", "position");

-- CreateIndex
CREATE INDEX "Row_tableId_idx" ON "Row"("tableId");

-- CreateIndex
CREATE INDEX "Row_updatedAt_idx" ON "Row"("updatedAt");

-- CreateIndex
CREATE INDEX "Row_createdAt_idx" ON "Row"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_row_table_position_id" ON "Row"("tableId", "position", "id");
