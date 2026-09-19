-- CreateIndex
CREATE INDEX "idx_providerLicense_providerId" ON "providerLicense"("providerId");

-- CreateIndex
CREATE INDEX "idx_providerLicense_state" ON "providerLicense"("state");

-- CreateIndex
CREATE INDEX "idx_providerOtherId_providerId" ON "providerOtherProviderIdentifier"("providerId");

-- CreateIndex
CREATE INDEX "idx_providerTaxonomy_providerId" ON "providerTaxonomy"("providerId");

-- CreateIndex
CREATE INDEX "idx_providerTaxonomy_taxonomyCode" ON "providerTaxonomy"("taxonomyCode");

-- CreateIndex
CREATE INDEX "idx_pgp_providerId" ON "provider_group_provider"("providerId");

-- CreateIndex
CREATE INDEX "idx_pgp_providerGroupId" ON "provider_group_provider"("providerGroupId");
