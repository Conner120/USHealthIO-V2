"use server"
import {withAuth} from "@workos-inc/authkit-nextjs";
import {prisma} from "@repo/database";

export async function saveGeneral(id: string, data: {
    displayName: string
    legalName: string
}) {
    const {user} = await withAuth({ensureSignedIn: true});
    return prisma.insuranceCompany.update({
        where: {
            id
        },
        data: {
            displayName: data.displayName,
            legalName: data.legalName,
            updatedBy: user.id
        }
    })
}