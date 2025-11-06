import {
    InsuranceCompanySidebar
} from "@/app/insurance/companies/[insuranceCompanyId]/_components/insuranceCompanySidebar";
import React from "react";

export default function page({children}: { children: React.ReactNode }) {
    return (<div className="flex space-x-3 h-full">
        <InsuranceCompanySidebar/>
        {children}
    </div>)
}