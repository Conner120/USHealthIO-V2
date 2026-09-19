/*
  Warnings:

  - A unique constraint covering the columns `[code,typeId]` on the table `procedure_code` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tinValue,insuranceCarrierId]` on the table `provider_group` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `archivedBy` to the `provider` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deactivatedBy` to the `provider` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityTypeCode` to the `provider` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tinType` to the `provider_group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tinValue` to the `provider_group` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OtherProviderIdentifierTypeCode" AS ENUM ('OTHER', 'MEDICARE_UPIN', 'MEDICAR_ID_TYPE_UNSPECIFIED', 'MEDICAID', 'MEDICARE_OSCAR_CERTIFICATION', 'MEDICARE_NSC', 'MEDICARE_PIN');

-- CreateEnum
CREATE TYPE "EntityTypeCode" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "SoleProprietorCode" AS ENUM ('X', 'Y', 'N');

-- CreateEnum
CREATE TYPE "SubpartCode" AS ENUM ('X', 'Y', 'N');

-- CreateEnum
CREATE TYPE "GenderCode" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "DeactivationReasonCode" AS ENUM ('DT', 'DB', 'FR', 'OT');

-- CreateEnum
CREATE TYPE "OtherProviderNameTypeCode" AS ENUM ('FORMER_NAME', 'PROFESSIONAL_NAME', 'DOING_BUSINESS_AS', 'FORMER_LEGAL_BUSINESS', 'OTHER_NAME');

-- CreateEnum
CREATE TYPE "PrimaryTaxonomyCode" AS ENUM ('X', 'Y', 'N');

-- AlterTable
ALTER TABLE "provider" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" VARCHAR(50) NOT NULL,
ADD COLUMN     "authorizedOfficialCredential" VARCHAR(50),
ADD COLUMN     "authorizedOfficialFirstName" VARCHAR(250),
ADD COLUMN     "authorizedOfficialLastName" VARCHAR(250),
ADD COLUMN     "authorizedOfficialMiddleName" VARCHAR(100),
ADD COLUMN     "authorizedOfficialNamePrefix" VARCHAR(10),
ADD COLUMN     "authorizedOfficialNameSuffix" VARCHAR(10),
ADD COLUMN     "authorizedOfficialPhone" VARCHAR(20),
ADD COLUMN     "authorizedOfficialTitle" VARCHAR(100),
ADD COLUMN     "businessName" VARCHAR(250),
ADD COLUMN     "certificationDate" TIMESTAMP(3),
ADD COLUMN     "credential" VARCHAR(50),
ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedBy" VARCHAR(50) NOT NULL,
ADD COLUMN     "deactivationDate" TIMESTAMP(3),
ADD COLUMN     "deactivationReasonCode" "DeactivationReasonCode",
ADD COLUMN     "ein" VARCHAR(20),
ADD COLUMN     "entityTypeCode" "EntityTypeCode" NOT NULL,
ADD COLUMN     "enumerationDate" TIMESTAMP(3),
ADD COLUMN     "genderCode" "GenderCode",
ADD COLUMN     "isOrganizationSubpart" "SubpartCode",
ADD COLUMN     "isSoleProprietor" "SoleProprietorCode",
ADD COLUMN     "lastUpdateDate" TIMESTAMP(3),
ADD COLUMN     "middleName" VARCHAR(100),
ADD COLUMN     "namePrefix" VARCHAR(10),
ADD COLUMN     "nameSuffix" VARCHAR(10),
ADD COLUMN     "otherCredential" VARCHAR(50),
ADD COLUMN     "otherFirstName" VARCHAR(250),
ADD COLUMN     "otherLastName" VARCHAR(250),
ADD COLUMN     "otherLastNameTypeCode" "OtherProviderNameTypeCode",
ADD COLUMN     "otherMiddleName" VARCHAR(100),
ADD COLUMN     "otherNamePrefix" VARCHAR(10),
ADD COLUMN     "otherNameSuffix" VARCHAR(10),
ADD COLUMN     "otherOrganizationName" VARCHAR(250),
ADD COLUMN     "otherOrganizationNameTypeCode" "OtherProviderNameTypeCode",
ADD COLUMN     "parentOrganizationName" VARCHAR(250),
ADD COLUMN     "parentOrganizationTIN" VARCHAR(20),
ADD COLUMN     "reactivationDate" TIMESTAMP(3),
ADD COLUMN     "replacementNPI" VARCHAR(20),
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "provider_group" ADD COLUMN     "tinType" VARCHAR(10) NOT NULL,
ADD COLUMN     "tinValue" VARCHAR(20) NOT NULL;

-- CreateTable
CREATE TABLE "providerAddress" (
    "id" VARCHAR(50) NOT NULL,
    "providerId" VARCHAR(50) NOT NULL,
    "address1" VARCHAR(250) NOT NULL,
    "address2" VARCHAR(250),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "zipCode" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" VARCHAR(50) NOT NULL,

    CONSTRAINT "providerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providerLicense" (
    "id" VARCHAR(50) NOT NULL,
    "providerId" VARCHAR(50) NOT NULL,
    "licenseNumber" VARCHAR(100) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" VARCHAR(50) NOT NULL,

    CONSTRAINT "providerLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providerTaxonomy" (
    "id" VARCHAR(50) NOT NULL,
    "providerId" VARCHAR(50) NOT NULL,
    "taxonomyCode" VARCHAR(20) NOT NULL,
    "licenseNumber" VARCHAR(100),
    "licenseState" VARCHAR(5),
    "isPrimary" "PrimaryTaxonomyCode" NOT NULL DEFAULT 'X',
    "groupCode" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" VARCHAR(50) NOT NULL,

    CONSTRAINT "providerTaxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providerOtherProviderIdentifier" (
    "id" VARCHAR(50) NOT NULL,
    "providerId" VARCHAR(50) NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "typeCode" "OtherProviderIdentifierTypeCode" NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "issure" VARCHAR(250) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" VARCHAR(50) NOT NULL,

    CONSTRAINT "providerOtherProviderIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procedure_code_code_typeId_key" ON "procedure_code"("code", "typeId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_group_tinValue_insuranceCarrierId_key" ON "provider_group"("tinValue", "insuranceCarrierId");

-- AddForeignKey
ALTER TABLE "providerAddress" ADD CONSTRAINT "providerAddress_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providerLicense" ADD CONSTRAINT "providerLicense_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providerTaxonomy" ADD CONSTRAINT "providerTaxonomy_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providerOtherProviderIdentifier" ADD CONSTRAINT "providerOtherProviderIdentifier_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
