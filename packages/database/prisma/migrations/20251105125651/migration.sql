/*
  Warnings:

  - The values [INDEX_API_JSON,API_TXT,CIGNA_SCRAPER] on the enum `InsuranceScanSourceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InsuranceScanSourceType_new" AS ENUM ('INDEX_URL', 'MANUAL', 'CIGNA_INDEX_API', 'KAISER_PERMANENTE_TXT_IN_NETWORK', 'KAISER_PERMANENTE_TXT_OUT_OF_NETWORK', 'UNITED_HEATHCARE_BLOB_API', 'AETNA_BLOB_API', 'HCSC_SCRAPER', 'MOLINA_HEALTHCARE_SCRAPER');
ALTER TABLE "InsuranceScanSource" ALTER COLUMN "sourceType" TYPE "InsuranceScanSourceType_new" USING ("sourceType"::text::"InsuranceScanSourceType_new");
ALTER TYPE "InsuranceScanSourceType" RENAME TO "InsuranceScanSourceType_old";
ALTER TYPE "InsuranceScanSourceType_new" RENAME TO "InsuranceScanSourceType";
DROP TYPE "public"."InsuranceScanSourceType_old";
COMMIT;
