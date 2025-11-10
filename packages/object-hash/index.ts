export function makePlanHash(planId: string, planMarketType: string, planName: string, plan_id_type: string, insuranceCompanyId: string): string {
    return makeHash(`${insuranceCompanyId}-${planId}-${planMarketType}-${planName}-${plan_id_type}`);
}

export function makeHash(text: string): string {
    return Bun.hash(text).toString(16);
}