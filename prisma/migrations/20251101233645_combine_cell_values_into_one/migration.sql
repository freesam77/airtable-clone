/*
  Warnings:

  - You are about to drop the column `userId` on the `Base` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `Table` table. All the data in the column will be lost.
  - You are about to drop the `CellValue` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `createdById` to the `Base` table without a default value. This is not possible if the table is not empty.
  - Made the column `baseId` on table `Table` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Base" DROP CONSTRAINT "Base_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CellValue" DROP CONSTRAINT "CellValue_columnId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CellValue" DROP CONSTRAINT "CellValue_rowId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Table" DROP CONSTRAINT "Table_baseId_fkey";

-- DropIndex
DROP INDEX "public"."Table_createdById_idx";

-- DropIndex
DROP INDEX "public"."Table_name_idx";

-- AlterTable
ALTER TABLE "Base" DROP COLUMN "userId",
ADD COLUMN     "createdById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Table" DROP COLUMN "createdById",
ALTER COLUMN "baseId" SET NOT NULL;

-- DropTable
DROP TABLE "public"."CellValue";

-- CreateTable
CREATE TABLE "Cell" (
    "id" TEXT NOT NULL,
    "value" TEXT,
    "rowId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cell_columnId_idx" ON "Cell"("columnId");

-- CreateIndex
CREATE INDEX "Cell_rowId_idx" ON "Cell"("rowId");

-- CreateIndex
CREATE UNIQUE INDEX "Cell_columnId_rowId_key" ON "Cell"("columnId", "rowId");

-- CreateIndex
CREATE INDEX "Base_name_createdById_idx" ON "Base"("name", "createdById");

-- CreateIndex
CREATE INDEX "Table_name_baseId_idx" ON "Table"("name", "baseId");

-- AddForeignKey
ALTER TABLE "Base" ADD CONSTRAINT "Base_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "Row"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column"("id") ON DELETE CASCADE ON UPDATE CASCADE;
