-- CreateIndex
CREATE INDEX "idx_provider_type_lastName" ON "provider"("entityTypeCode", "lastName");

-- CreateIndex
CREATE INDEX "idx_provider_type_businessName" ON "provider"("entityTypeCode", "businessName");

-- CreateIndex
CREATE INDEX "idx_provider_type_updated" ON "provider"("entityTypeCode", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "idx_provider_lastName" ON "provider"("lastName");

-- CreateIndex
CREATE INDEX "idx_provider_firstName" ON "provider"("firstName");

-- CreateIndex
CREATE INDEX "idx_provider_businessName" ON "provider"("businessName");

-- CreateIndex
CREATE INDEX "idx_provider_credential" ON "provider"("credential");

-- CreateIndex
CREATE INDEX "idx_provider_ein" ON "provider"("ein");

-- CreateIndex
CREATE INDEX "idx_provider_deactivationDate" ON "provider"("deactivationDate");

-- CreateIndex
CREATE INDEX "idx_providerAddress_providerId" ON "providerAddress"("providerId");

-- CreateIndex
CREATE INDEX "idx_providerAddress_state" ON "providerAddress"("state");

-- CreateIndex
CREATE INDEX "idx_providerAddress_zipCode" ON "providerAddress"("zipCode");

-- CreateIndex
CREATE INDEX "idx_providerAddress_city_state" ON "providerAddress"("city", "state");
