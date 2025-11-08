-- CreateEnum
CREATE TYPE "InsuranceScanSourceType" AS ENUM ('INDEX_URL', 'MANUAL', 'CIGNA_INDEX_API', 'KAISER_PERMANENTE_TXT_IN_NETWORK', 'KAISER_PERMANENTE_TXT_OUT_OF_NETWORK', 'UNITED_HEATHCARE_BLOB_API', 'AETNA_BLOB_API', 'HCSC_SCRAPER', 'MOLINA_HEALTHCARE_SCRAPER');

-- CreateEnum
CREATE TYPE "InsuranceScanJobStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'PARSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InsuranceScanStepType" AS ENUM ('DOWNLOAD', 'DECOMPRESS', 'PARSE', 'POST_PROCESS', 'ANALYTICS');

-- CreateTable
CREATE TABLE "InsuranceCompany" (
    "id" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "legalName" VARCHAR(200) NOT NULL,
    "subsidiariesName" VARCHAR(200)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,
    "archivedBy" VARCHAR(50),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "InsuranceCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceScanSource" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(5000),
    "sourceType" "InsuranceScanSourceType" NOT NULL,
    "insuranceCompanyId" VARCHAR(50),
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,
    "archivedBy" VARCHAR(50),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "InsuranceScanSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceScanJob" (
    "id" VARCHAR(50) NOT NULL,
    "insuranceScanSourceId" VARCHAR(50),
    "status" "InsuranceScanJobStatus" NOT NULL DEFAULT 'PENDING',
    "statusTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paylaod" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,

    CONSTRAINT "InsuranceScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceScanFiles" (
    "id" VARCHAR(50) NOT NULL,
    "fileType" VARCHAR(100) NOT NULL,
    "fileUrl" VARCHAR(500) NOT NULL,
    "localPath" VARCHAR(500) NOT NULL,
    "checksum" VARCHAR(100),
    "insuranceScanJobId" TEXT NOT NULL,

    CONSTRAINT "InsuranceScanFiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceScanSteps" (
    "id" VARCHAR(50) NOT NULL,
    "type" "InsuranceScanStepType" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "sequenceOrder" INTEGER NOT NULL,
    "insuranceScanJobId" TEXT NOT NULL,
    "insuranceScanFileId" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceScanSteps_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InsuranceScanSource" ADD CONSTRAINT "InsuranceScanSource_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceScanJob" ADD CONSTRAINT "InsuranceScanJob_insuranceScanSourceId_fkey" FOREIGN KEY ("insuranceScanSourceId") REFERENCES "InsuranceScanSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceScanFiles" ADD CONSTRAINT "InsuranceScanFiles_insuranceScanJobId_fkey" FOREIGN KEY ("insuranceScanJobId") REFERENCES "InsuranceScanJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceScanSteps" ADD CONSTRAINT "InsuranceScanSteps_insuranceScanJobId_fkey" FOREIGN KEY ("insuranceScanJobId") REFERENCES "InsuranceScanJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceScanSteps" ADD CONSTRAINT "InsuranceScanSteps_insuranceScanFileId_fkey" FOREIGN KEY ("insuranceScanFileId") REFERENCES "InsuranceScanFiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
