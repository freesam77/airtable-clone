-- DropIndex
DROP INDEX "public"."Row_tableId_position_idx";

-- CreateIndex
CREATE INDEX "idx_row_table_position_id" ON "Row"("tableId", "position", "id");
