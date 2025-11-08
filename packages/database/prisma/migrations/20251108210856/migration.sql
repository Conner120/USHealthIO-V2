/*
  Warnings:

  - A unique constraint covering the columns `[insurancePlanHash]` on the table `InsurancePlan` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "InsurancePlan" ADD COLUMN     "insurancePlanHash" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "InsurancePlan_insurancePlanHash_key" ON "InsurancePlan"("insurancePlanHash");

-- CreateIndex
CREATE INDEX "idx_planIdType_planId" ON "InsurancePlan"("planIdType", "planId");
