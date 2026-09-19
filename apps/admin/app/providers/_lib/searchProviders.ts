"use server"
import {prisma} from "@repo/database";
import {withAuth} from "@workos-inc/authkit-nextjs";

type ProviderRow = {
    id: string;
    providerNPI: string;
    entityTypeCode: string | null;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    businessName: string | null;
    credential: string | null;
    genderCode: string | null;
    deactivationDate: string | null;
    updatedAt: string;
    primaryCity: string | null;
    primaryState: string | null;
};

export type {ProviderRow};

export type ColumnFilter = {
    id: string;
    value: unknown;
};

const PROVIDER_SELECT = `
    p."id", p."providerNPI", p."entityTypeCode", p."firstName", p."lastName",
    p."middleName", p."businessName", p."credential", p."genderCode",
    TO_CHAR(p."deactivationDate", 'MM/DD/YYYY') AS "deactivationDate",
    TO_CHAR(p."updatedAt", 'MM/DD/YYYY') AS "updatedAt",
    pa."city" AS "primaryCity", pa."state" AS "primaryState"`;

const PROVIDER_FROM = `
    FROM "provider" p
    LEFT JOIN LATERAL (
        SELECT "city", "state" FROM "providerAddress"
        WHERE "providerId" = p."id" AND "archivedAt" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT 1
    ) pa ON true`;

// Count query skips the LATERAL JOIN — it doesn't affect row count and is expensive
const COUNT_FROM = `FROM "provider" p`;

// Columns that can be filtered, mapped to their SQL expression
const FILTERABLE_COLUMNS: Record<string, string> = {
    providerNPI: `p."providerNPI"`,
    firstName: `p."firstName"`,
    lastName: `p."lastName"`,
    businessName: `p."businessName"`,
    credential: `p."credential"`,
    primaryCity: `pa."city"`,
    primaryState: `pa."state"`,
};

// Columns used only in count (no lateral join alias)
const COUNT_FILTERABLE_COLUMNS: Record<string, string> = {
    providerNPI: `p."providerNPI"`,
    firstName: `p."firstName"`,
    lastName: `p."lastName"`,
    businessName: `p."businessName"`,
    credential: `p."credential"`,
};

function buildColumnFilters(
    columnFilters: ColumnFilter[],
    paramOffset: number,
    columnMap: Record<string, string>,
): {clause: string; params: string[]} {
    const conditions: string[] = [];
    const params: string[] = [];

    for (const filter of columnFilters) {
        const col = columnMap[filter.id];
        if (!col || typeof filter.value !== "string" || !filter.value.trim()) continue;

        const idx = paramOffset + params.length + 1;
        conditions.push(`${col} ILIKE $${idx}`);
        params.push(`%${filter.value.trim()}%`);
    }

    return {
        clause: conditions.length > 0 ? ` AND ${conditions.join(" AND ")}` : "",
        params,
    };
}

// Default sort: alphabetical by name (uses composite index)
function defaultSort(entityType: "INDIVIDUAL" | "ORGANIZATION"): string {
    return entityType === "INDIVIDUAL"
        ? `p."lastName" ASC NULLS LAST, p."firstName" ASC NULLS LAST`
        : `p."businessName" ASC NULLS LAST`;
}

export async function searchProviders(
    query: string,
    entityType: "INDIVIDUAL" | "ORGANIZATION",
    page: number,
    pageSize: number,
    columnFilters: ColumnFilter[] = [],
) {
    const {user} = await withAuth({ensureSignedIn: true});
    if (!user) return {providers: [] as ProviderRow[], total: 0};

    const offset = page * pageSize;
    const trimmed = query.trim();
    const orderBy = defaultSort(entityType);

    if (trimmed) {
        const pattern = `%${trimmed}%`;
        const colFilters = buildColumnFilters(columnFilters, 2, FILTERABLE_COLUMNS);
        const countColFilters = buildColumnFilters(columnFilters, 2, COUNT_FILTERABLE_COLUMNS);
        const limitIdx = 3 + colFilters.params.length;
        const offsetIdx = limitIdx + 1;

        const searchWhere = `
            p."entityTypeCode" = $1::"EntityTypeCode"
            AND (p."providerNPI" LIKE $2
                 OR p."firstName" ILIKE $2
                 OR p."lastName" ILIKE $2
                 OR p."businessName" ILIKE $2
                 OR p."credential" ILIKE $2)`;

        const [providers, countResult] = await Promise.all([
            prisma.$queryRawUnsafe<ProviderRow[]>(
                `SELECT ${PROVIDER_SELECT}
                 ${PROVIDER_FROM}
                 WHERE ${searchWhere}
                   ${colFilters.clause}
                 ORDER BY ${orderBy}
                 LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
                entityType, pattern, ...colFilters.params, pageSize, offset,
            ),
            prisma.$queryRawUnsafe<[{count: bigint}]>(
                `SELECT COUNT(*) as count
                 ${COUNT_FROM}
                 WHERE ${searchWhere}
                   ${countColFilters.clause}`,
                entityType, pattern, ...countColFilters.params,
            ),
        ]);
        return {providers, total: Number(countResult[0].count)};
    }

    // No global search — just entity type + column filters
    const colFilters = buildColumnFilters(columnFilters, 1, FILTERABLE_COLUMNS);
    const countColFilters = buildColumnFilters(columnFilters, 1, COUNT_FILTERABLE_COLUMNS);
    const limitIdx = 2 + colFilters.params.length;
    const offsetIdx = limitIdx + 1;

    const [providers, countResult] = await Promise.all([
        prisma.$queryRawUnsafe<ProviderRow[]>(
            `SELECT ${PROVIDER_SELECT}
             ${PROVIDER_FROM}
             WHERE p."entityTypeCode" = $1::"EntityTypeCode"
               ${colFilters.clause}
             ORDER BY ${orderBy}
             LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            entityType, ...colFilters.params, pageSize, offset,
        ),
        prisma.$queryRawUnsafe<[{count: bigint}]>(
            `SELECT COUNT(*) as count
             ${COUNT_FROM}
             WHERE p."entityTypeCode" = $1::"EntityTypeCode"
               ${countColFilters.clause}`,
            entityType, ...countColFilters.params,
        ),
    ]);
    return {providers, total: Number(countResult[0].count)};
}
