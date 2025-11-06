"use server"
import GeneralForm from "@/app/insurance/companies/[insuranceCompanyId]/_components/generalForm";
import {getInsuranceCompany} from "@/app/insurance/companies/[insuranceCompanyId]/_lib/getInsuranceCompany";

export default async function page({params}: { params: { insuranceCompanyId: string } }) {
    const {insuranceCompanyId} = params;
    const insuranceCompany = await getInsuranceCompany(insuranceCompanyId);
    if (!insuranceCompany) {
        return <div>Insurance company not found</div>
    }
    return (
        <GeneralForm currentValue={insuranceCompany}/>
    )
}