"use client"
import {DataTable} from "@/components/dataTable";
import {InsuranceCompany} from "@repo/database"
import {useRouter} from "next/navigation";

export default function InsuranceCompanyTable(props: { insuranceCompanies: InsuranceCompany[] }) {
    const router = useRouter()
    return (
        <DataTable
            columns={[

                {
                    accessorKey: "displayName",
                    header: "Name",
                },
                {
                    accessorKey: "legalName",
                    header: "Legal Name",
                },
                {
                    accessorKey: 'createdAt',
                    header: 'Created At',
                    cell: ({row}) => new Date(row.original.createdAt).toLocaleDateString(),
                },
                {
                    accessorKey: 'updatedAt',
                    header: 'Updated At',
                    cell: ({row}) => new Date(row.original.updatedAt).toLocaleDateString(),
                }
            ]}
            data={props.insuranceCompanies}
            filterColumn="displayName"
            enableSelection={true}
            filterPlaceholder="Filter emails..."
            createLink="/insurance/companies/new"
            createName="Insurance Company"
            action={(row) => {
                console.log(row.id)
                router.push(`/insurance/companies/${row.id}`)
            }}
        />

    )
}
