export interface JobContext {
    insurancePlanIds: string[];
    insuranceCarrierId: string;
}

export interface JobCache {
    procedureCodes: Map<string, number>;          // hash → procedure_code.id
    providerGroups: Map<string, string>;          // hash → provider_group.id
    providers: Map<string, string>;               // hash → provider.id
    providerGroupProviders: Map<string, string>;  // hash → junction.id
    insurancePlanIds: string[];
    insuranceCarrierId: string;
    lastMessageAt: number;
}

export interface PendingProcedureCode {
    hash: string;
    code: string;
    typeId: string;
    description: string;
}

export interface PendingProviderGroup {
    hash: string;
    tinValue: string;
    tinType: string;
    groupName: string;
    insuranceCarrierId: string;
}

export interface PendingProvider {
    hash: string;
    npi: string;
}

export interface PendingProviderGroupProvider {
    hash: string;
    providerGroupId: string;
    providerId: string;
}

export interface PendingEntities {
    procedureCodes: Map<string, PendingProcedureCode>;
    providerGroups: Map<string, PendingProviderGroup>;
    providers: Map<string, PendingProvider>;
    providerGroupProviders: Map<string, PendingProviderGroupProvider>;
}

export interface ResolvedRate {
    procedureHash: string;
    billingCode: string;
    billingCodeType: string;
    negotiatedRate: number;
    expirationDate: string;
    serviceCode: string[];
    billingClass: string;
    setting: string;
    billingCodeModifier: string[];
    providerGroupId: string;
    procedureCodeId: number;
    insurancePlanIds: string[];
    insuranceScanJobId: string;
}

export interface PendingBatch {
    rates: ResolvedRate[];
    pendingEntities: PendingEntities;
    jobCounters: Map<string, number>;  // insuranceScanJobId → count of rates in this batch
    lastFlushAt: number;
}
