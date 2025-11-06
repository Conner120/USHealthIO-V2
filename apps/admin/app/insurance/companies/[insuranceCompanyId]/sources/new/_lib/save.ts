"use server"
import {withAuth} from "@workos-inc/authkit-nextjs";
import {prisma} from "@repo/database";
import {createId} from "@paralleldrive/cuid2";

export async function saveToDatabase({displayName, legalName}: {
    displayName: string
    legalName: string
}) {
    const {user} = await withAuth({ensureSignedIn: true});
    await prisma.insuranceCompany.create({
        data: {
            id: `ins_${createId()}`,
            displayName,
            legalName,
            createdBy: user.id,
            updatedBy: user.id
        }
    })
}
