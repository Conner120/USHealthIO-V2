/*
  Warnings:

  - Added the required column `insuranceCarrierId` to the `provider_group` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "provider_group" ADD COLUMN     "insuranceCarrierId" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "provider_group_provider" ADD COLUMN     "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
