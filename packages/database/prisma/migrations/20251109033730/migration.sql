/*
  Warnings:

  - Added the required column `planName` to the `InsurancePlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InsurancePlan" ADD COLUMN     "planName" VARCHAR(500) NOT NULL;
