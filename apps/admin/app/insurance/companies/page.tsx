import {prisma} from "@repo/database";
import InsuranceCompanyTable from "@/components/tables/insuranceCompanyTable";

export default async function Page() {
    const users = await prisma.insuranceCompany.findMany();
    return (
        <div>
            <InsuranceCompanyTable insuranceCompanies={users}/>
        </div>
    )
}
