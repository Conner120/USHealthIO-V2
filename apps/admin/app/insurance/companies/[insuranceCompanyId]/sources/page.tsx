"use server"
import {
    getInsuranceCompanySources
} from "@/app/insurance/companies/[insuranceCompanyId]/sources/_lib/getInsuranceCompany";
import SourcesForm from "@/app/insurance/companies/[insuranceCompanyId]/sources/_components/sourcesForm";
import {Button} from "@/components/ui/button";
import Link from "next/link";

export default async function page({params}: { params: { insuranceCompanyId: string } }) {
    const {insuranceCompanyId} = await params;
    const insuranceCompany = await getInsuranceCompanySources(insuranceCompanyId);
    if (!insuranceCompany) {
        return <div>Insurance company not found</div>
    }
    return (
        <main className="flex-1">
            <div className="space-y-6 px-4 py-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Import Sources</h2>
                        <p className="text-muted-foreground">Manage import sources and their settings</p>
                    </div>
                    <Button asChild>
                        <Link href={`/insurance/companies/${insuranceCompanyId}/sources/new`}>
                            + Create Import Source
                        </Link>
                    </Button>
                </div>
                {insuranceCompany.scanSources.map((source => (
                    <SourcesForm key={source.id} currentValue={source}/>
                )))}
            </div>
        </main>

    )
}