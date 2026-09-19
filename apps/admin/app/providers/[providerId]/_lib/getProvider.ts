"use server"
import {prisma} from "@repo/database";
import {withAuth} from "@workos-inc/authkit-nextjs";


export type ProviderDetail = {
    id: string;
    providerNPI: string;
    entityTypeCode: string | null;
    replacementNPI: string | null;
    ein: string | null;
    businessName: string | null;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    namePrefix: string | null;
    nameSuffix: string | null;
    credential: string | null;
    otherOrganizationName: string | null;
    otherLastName: string | null;
    otherFirstName: string | null;
    otherMiddleName: string | null;
    genderCode: string | null;
    isSoleProprietor: string | null;
    isOrganizationSubpart: string | null;
    parentOrganizationName: string | null;
    parentOrganizationTIN: string | null;
    enumerationDate: Date | null;
    lastUpdateDate: Date | null;
    certificationDate: Date | null;
    deactivationDate: Date | null;
    deactivationReasonCode: string | null;
    reactivationDate: Date | null;
    authorizedOfficialFirstName: string | null;
    authorizedOfficialMiddleName: string | null;
    authorizedOfficialLastName: string | null;
    authorizedOfficialTitle: string | null;
    authorizedOfficialPhone: string | null;
    authorizedOfficialCredential: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type ProviderAddress = {
    id: string;
    addressType: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string;
    zipCode: string;
    country: string | null;
    phone: string | null;
    fax: string | null;
};

export type ProviderLicense = {
    id: string;
    licenseNumber: string;
    state: string;
};

export type ProviderTaxonomy = {
    id: string;
    taxonomyCode: string;
    isPrimary: string;
    licenseNumber: string | null;
    licenseState: string | null;
    groupCode: string | null;
};

export type ProviderGroupMembership = {
    id: string;
    isActive: boolean;
    firstSeen: Date;
    lastSeen: Date;
    groupName: string;
    tinValue: string;
};

export async function getProvider(id: string) {
    const {user} = await withAuth({ensureSignedIn: true});
    if (!user) return null;

    const providers = await prisma.$queryRawUnsafe<ProviderDetail[]>(
        `SELECT * FROM "provider" WHERE "id" = $1 LIMIT 1`,
        id,
    );
    if (providers.length === 0) return null;
    return providers[0];
}

export async function getProviderAddresses(providerId: string) {
    return prisma.$queryRawUnsafe<ProviderAddress[]>(
        `SELECT "id", "addressType", "address1", "address2", "city", "state", "zipCode",
                "country", "phone", "fax"
         FROM "providerAddress"
         WHERE "providerId" = $1 AND "archivedAt" IS NULL
         ORDER BY "addressType" ASC`,
        providerId,
    );
}

export async function getProviderLicenses(providerId: string) {
    return prisma.$queryRawUnsafe<ProviderLicense[]>(
        `SELECT "id", "licenseNumber", "state"
         FROM "providerLicense"
         WHERE "providerId" = $1 AND "archivedAt" IS NULL`,
        providerId,
    );
}

export async function getProviderTaxonomies(providerId: string) {
    return prisma.$queryRawUnsafe<ProviderTaxonomy[]>(
        `SELECT "id", "taxonomyCode", "isPrimary", "licenseNumber", "licenseState", "groupCode"
         FROM "providerTaxonomy"
         WHERE "providerId" = $1 AND "archivedAt" IS NULL`,
        providerId,
    );
}

export async function getProviderGroups(providerId: string) {
    return prisma.$queryRawUnsafe<ProviderGroupMembership[]>(
        `SELECT pgp."id", pgp."isActive", pgp."firstSeen", pgp."lastSeen",
                pg."groupName", pg."tinValue"
         FROM "provider_group_provider" pgp
         JOIN "provider_group" pg ON pg."id" = pgp."providerGroupId"
         WHERE pgp."providerId" = $1`,
        providerId,
    );
}
