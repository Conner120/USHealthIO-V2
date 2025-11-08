-- CreateTable
CREATE TABLE "InsurancePlan" (
    "id" VARCHAR(50) NOT NULL,
    "planIdType" VARCHAR(50) NOT NULL,
    "planId" VARCHAR(100) NOT NULL,
    "planMarketType" VARCHAR(50) NOT NULL,
    "planFirstSeen" TIMESTAMP(3) NOT NULL,
    "planLastSeen" TIMESTAMP(3) NOT NULL,
    "planActive" BOOLEAN NOT NULL DEFAULT true,
    "insuranceCompanyId" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" VARCHAR(50) NOT NULL,
    "archivedBy" VARCHAR(50),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "InsurancePlan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InsurancePlan" ADD CONSTRAINT "InsurancePlan_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
