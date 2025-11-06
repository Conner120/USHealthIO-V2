"use server"
import {prisma} from "@repo/database";
import {withAuth} from "@workos-inc/authkit-nextjs";

export async function getInsuranceCompany(id: string) {
    const {user} = await withAuth({ensureSignedIn: true});
    if (!user) {
        return null
    }
    return prisma.insuranceCompany.findFirst({
        where: {
            id
        }
    });
}