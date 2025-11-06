import {prisma} from "@repo/database";
import InsuranceCompanyTable from "@/app/insurance/companies/_components/insuranceCompanyTable";

export default async function Page() {
    const users = await prisma.insuranceCompany.findMany();
    console.log(users)
    return (
        <div>
            <InsuranceCompanyTable insuranceCompanies={users}/>
        </div>
    )
}
