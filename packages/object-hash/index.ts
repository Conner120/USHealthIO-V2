export function makePlanHash(planId: string, planMarketType: string, planName: string, planIdType: string, insuranceCompanyId: string): string {
    return makeHash(`${insuranceCompanyId}-${planIdType}-${planId}-${planMarketType}-${planName}`);
}

export function makeHash(text: string): string {
    return Bun.hash(text).toString(16);
}