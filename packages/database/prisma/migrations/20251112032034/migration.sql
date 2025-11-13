-- AlterTable
ALTER TABLE "InsuranceScanJob" ADD COLUMN     "allowedAmountObjectsParsed" BIGINT DEFAULT 0,
ADD COLUMN     "allowedAmountRatesSaved" BIGINT DEFAULT 0,
ADD COLUMN     "allowedAmountRatesWithErrors" BIGINT DEFAULT 0,
ADD COLUMN     "inNetworkObjectsParsed" BIGINT DEFAULT 0,
ADD COLUMN     "inNetworkRatesSaved" BIGINT DEFAULT 0,
ADD COLUMN     "inNetworkRatesWithErrors" BIGINT DEFAULT 0,
ADD COLUMN     "plansParsed" BIGINT DEFAULT 0,
ADD COLUMN     "plansSaved" BIGINT DEFAULT 0,
ADD COLUMN     "providersParsed" BIGINT DEFAULT 0,
ADD COLUMN     "providersSaved" BIGINT DEFAULT 0;

-- CreateTable
CREATE TABLE "provider_group" (
    "id" VARCHAR(50) NOT NULL,
    "groupName" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,
    "archivedBy" VARCHAR(50),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "provider_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_group_provider" (
    "id" VARCHAR(50) NOT NULL,
    "providerGroupId" VARCHAR(50) NOT NULL,
    "providerId" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_group_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider" (
    "id" VARCHAR(50) NOT NULL,
    "providerNPI" VARCHAR(20) NOT NULL,
    "firstName" VARCHAR(250) NOT NULL,
    "lastName" VARCHAR(250) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,

    CONSTRAINT "provider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_providerNPI_key" ON "provider"("providerNPI");

-- AddForeignKey
ALTER TABLE "provider_group_provider" ADD CONSTRAINT "provider_group_provider_providerGroupId_fkey" FOREIGN KEY ("providerGroupId") REFERENCES "provider_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_group_provider" ADD CONSTRAINT "provider_group_provider_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
