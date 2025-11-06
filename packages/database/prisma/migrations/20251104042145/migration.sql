-- AlterTable
ALTER TABLE "InsuranceScanSource" ADD COLUMN     "name" VARCHAR(200) NOT NULL DEFAULT 'test',
ADD COLUMN     "notes" VARCHAR(5000);
