/*
  Warnings:

  - Added the required column `planSponsorName` to the `InsurancePlan` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `planIdType` on the `InsurancePlan` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `planMarketType` on the `InsurancePlan` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "InsurancePlanIdType" AS ENUM ('EIN', 'HIOS');

-- CreateEnum
CREATE TYPE "InsurancePlanMarketType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- AlterTable
ALTER TABLE "InsurancePlan" ADD COLUMN     "planSponsorName" VARCHAR(500) NOT NULL,
DROP COLUMN "planIdType",
ADD COLUMN     "planIdType" "InsurancePlanIdType" NOT NULL,
DROP COLUMN "planMarketType",
ADD COLUMN     "planMarketType" "InsurancePlanMarketType" NOT NULL;

-- CreateIndex
CREATE INDEX "idx_planIdType_planId" ON "InsurancePlan"("planIdType", "planId");
