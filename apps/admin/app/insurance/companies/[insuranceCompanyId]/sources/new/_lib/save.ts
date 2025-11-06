"use server"
import {withAuth} from "@workos-inc/authkit-nextjs";
import {$Enums, prisma} from "@repo/database";
import {createId} from "@paralleldrive/cuid2";
import {revalidatePath} from "next/cache";

export async function saveToDatabase(insuranceCompanyId: string, {
    name,
    sourceType,
    notes,
    options
}: {
    name: string
    sourceType: $Enums.InsuranceScanSourceType
    notes: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any
}) {
    const {user} = await withAuth({ensureSignedIn: true});
    await prisma.insuranceScanSource.create({
        data: {
            id: `inssr_${createId()}`,
            name: name,
            sourceType,
            notes,
            options,
            insuranceCompanyId,
            createdBy: user.id,
            updatedBy: user.id
        }
    })
    revalidatePath(`/insurance/companies/${insuranceCompanyId}`)
}
