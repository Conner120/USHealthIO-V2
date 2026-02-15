import { makeHash } from "@repo/object-hash";

export function procedureCodeHash(billingCodeType: string, billingCode: string): string {
    return makeHash(`pc:${billingCodeType}:${billingCode}`);
}

export function providerGroupHash(insuranceCarrierId: string, tinValue: string): string {
    return makeHash(`pg:${insuranceCarrierId}:${tinValue}`);
}

export function providerHash(npi: string): string {
    return makeHash(`prov:${npi}`);
}

export function providerGroupProviderHash(providerGroupId: string, providerId: string): string {
    return makeHash(`pgp:${providerGroupId}:${providerId}`);
}

export function procedureRateHash(
    billingCode: string,
    rate: number,
    serviceCode: string[],
    billingClass: string,
    setting: string,
    modifiers: string[],
): string {
    const sortedServiceCodes = [...serviceCode].sort().join(",");
    const sortedModifiers = [...modifiers].sort().join(",");
    return makeHash(
        `pr:${billingCode}:${rate}:${sortedServiceCodes}:${billingClass}:${setting}:${sortedModifiers}`,
    );
}
