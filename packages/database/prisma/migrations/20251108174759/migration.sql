/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `InsuranceScanFiles` table. All the data in the column will be lost.
  - You are about to drop the column `localPath` on the `InsuranceScanFiles` table. All the data in the column will be lost.
  - Added the required column `downloadUrl` to the `InsuranceScanFiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileExtension` to the `InsuranceScanFiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileName` to the `InsuranceScanFiles` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `fileType` on the `InsuranceScanFiles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('ALLOWED_AMOUNT', 'IN_NETWORK', 'TABLE_OF_CONTENTS');

-- CreateEnum
CREATE TYPE "FileExtension" AS ENUM ('ZIP', 'JSON', 'GZ');

-- CreateEnum
CREATE TYPE "InsuranceScanStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "InsuranceScanFiles" DROP COLUMN "fileUrl",
DROP COLUMN "localPath",
ADD COLUMN     "decompressedAt" TIMESTAMP(3),
ADD COLUMN     "downloadUrl" VARCHAR(4000) NOT NULL,
ADD COLUMN     "downloadedAt" TIMESTAMP(3),
ADD COLUMN     "fileExtension" "FileExtension" NOT NULL,
ADD COLUMN     "fileName" VARCHAR(255) NOT NULL,
ADD COLUMN     "fileSize" BIGINT,
ADD COLUMN     "parsedAt" TIMESTAMP(3),
DROP COLUMN "fileType",
ADD COLUMN     "fileType" "FileType" NOT NULL;

-- AlterTable
ALTER TABLE "InsuranceScanSteps" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "InsuranceScanJobStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "statusTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
