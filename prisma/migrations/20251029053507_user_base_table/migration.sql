-- DropForeignKey
ALTER TABLE "public"."Table" DROP CONSTRAINT "Table_createdById_fkey";

-- AlterTable
ALTER TABLE "Base" ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "Base" ADD CONSTRAINT "Base_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
