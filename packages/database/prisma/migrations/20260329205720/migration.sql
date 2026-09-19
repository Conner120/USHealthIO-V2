/*
  Warnings:

  - Added the required column `addressType` to the `providerAddress` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProviderAddressType" AS ENUM ('MAILING', 'PRACTICE');

-- DropIndex
DROP INDEX "idx_provider_businessName";

-- DropIndex
DROP INDEX "idx_provider_credential";

-- DropIndex
DROP INDEX "idx_provider_deactivationDate";

-- DropIndex
DROP INDEX "idx_provider_ein";

-- DropIndex
DROP INDEX "idx_provider_firstName";

-- DropIndex
DROP INDEX "idx_provider_genderCode";

-- DropIndex
DROP INDEX "idx_provider_lastName";

-- DropIndex
DROP INDEX "idx_provider_type_businessName";

-- DropIndex
DROP INDEX "idx_provider_type_lastName";

-- DropIndex
DROP INDEX "idx_provider_type_updated";

-- DropIndex
DROP INDEX "idx_providerAddress_city_state";

-- DropIndex
DROP INDEX "idx_providerAddress_providerId";

-- DropIndex
DROP INDEX "idx_providerAddress_state";

-- DropIndex
DROP INDEX "idx_providerAddress_zipCode";

-- DropIndex
DROP INDEX "idx_providerLicense_licenseNumber";

-- DropIndex
DROP INDEX "idx_providerLicense_providerId";

-- DropIndex
DROP INDEX "idx_providerLicense_state";

-- DropIndex
DROP INDEX "idx_providerOtherId_providerId";

-- DropIndex
DROP INDEX "idx_providerOtherId_typeCode";

-- DropIndex
DROP INDEX "idx_providerTaxonomy_isPrimary";

-- DropIndex
DROP INDEX "idx_providerTaxonomy_providerId";

-- DropIndex
DROP INDEX "idx_providerTaxonomy_taxonomyCode";

-- DropIndex
DROP INDEX "idx_pgp_providerGroupId";

-- DropIndex
DROP INDEX "idx_pgp_providerId";

-- AlterTable
ALTER TABLE "providerAddress" ADD COLUMN     "addressType" "ProviderAddressType" NOT NULL,
ADD COLUMN     "country" VARCHAR(5),
ADD COLUMN     "fax" VARCHAR(20),
ADD COLUMN     "phone" VARCHAR(20);
