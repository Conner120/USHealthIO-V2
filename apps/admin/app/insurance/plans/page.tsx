import {prisma} from "@repo/database";
import InsurancePlansTable from "@/app/insurance/plans/_components/insurancePlansTable";

export const dynamic = 'force-dynamic';

type PageProps = {
    searchParams: Promise<{
        page?: string;
        pageSize?: string;
        search?: string;
        [key: string]: string | undefined;
    }> | {
        page?: string;
        pageSize?: string;
        search?: string;
        [key: string]: string | undefined;
    };
}

export default async function Page({ searchParams }: PageProps) {
    // Handle both Promise and non-Promise searchParams (Next.js 14+ compatibility)
    const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
    const page = parseInt(resolvedSearchParams.page || '1', 10);
    const pageSize = parseInt(resolvedSearchParams.pageSize || '25', 10);
    const skip = (page - 1) * pageSize;
    const search = resolvedSearchParams.search || '';
    
    // Build where clause from filter params
    const where: any = {};
    
    // Global search across multiple fields
    if (search) {
        where.OR = [
            { planName: { contains: search, mode: 'insensitive' } },
            { planId: { contains: search, mode: 'insensitive' } },
            { planSponsorName: { contains: search, mode: 'insensitive' } },
            { insuranceCompany: { displayName: { contains: search, mode: 'insensitive' } } },
        ];
    }
    
    // Column-specific filters
    if (resolvedSearchParams.planName) {
        where.planName = { contains: resolvedSearchParams.planName, mode: 'insensitive' };
    }
    if (resolvedSearchParams.planId) {
        where.planId = { contains: resolvedSearchParams.planId, mode: 'insensitive' };
    }
    if (resolvedSearchParams.planIdType) {
        where.planIdType = resolvedSearchParams.planIdType;
    }
    if (resolvedSearchParams.planMarketType) {
        where.planMarketType = resolvedSearchParams.planMarketType;
    }
    if (resolvedSearchParams.planSponsorName) {
        where.planSponsorName = { contains: resolvedSearchParams.planSponsorName, mode: 'insensitive' };
    }
    if (resolvedSearchParams.planActive !== undefined) {
        where.planActive = resolvedSearchParams.planActive === 'true';
    }
    if (resolvedSearchParams.insuranceCompanyId) {
        where.insuranceCompanyId = resolvedSearchParams.insuranceCompanyId;
    }
    
    // Get total count for pagination (with filters applied)
    const totalCount = await prisma.insurancePlan.count({ where });
    
    // Fetch paginated data with filters
    const plans = await prisma.insurancePlan.findMany({
        where,
        skip,
        take: pageSize,
        include: {
            insuranceCompany: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    
    return (
        <div>
            <InsurancePlansTable 
                insurancePlans={plans}
                pageIndex={page - 1}
                pageSize={pageSize}
                totalCount={totalCount}
            />
        </div>
    )
}
