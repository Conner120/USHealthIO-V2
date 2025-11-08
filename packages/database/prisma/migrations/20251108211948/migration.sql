/*
  Warnings:

  - You are about to drop the column `paylaod` on the `InsuranceScanJob` table. All the data in the column will be lost.
  - You are about to drop the column `insuranceScanFileId` on the `InsuranceScanSteps` table. All the data in the column will be lost.
  - You are about to drop the `InsuranceScanFiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "InsuranceScanFiles" DROP CONSTRAINT "InsuranceScanFiles_insuranceScanJobId_fkey";

-- DropForeignKey
ALTER TABLE "InsuranceScanSteps" DROP CONSTRAINT "InsuranceScanSteps_insuranceScanFileId_fkey";

-- AlterTable
ALTER TABLE "InsuranceScanJob" DROP COLUMN "paylaod",
ADD COLUMN     "fileExtension" "FileExtension",
ADD COLUMN     "fileType" "FileType",
ADD COLUMN     "fileUrl" VARCHAR(2000),
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "InsuranceScanSteps" DROP COLUMN "insuranceScanFileId";

-- DropTable
DROP TABLE "InsuranceScanFiles";
