"use client"
import {GenericSidebar} from "@/components/subSidebar";
import {FileInput, Settings} from "lucide-react"
import {useMemo} from "react";
import {usePathname} from "next/navigation";


export function InsuranceCompanySidebar() {
    const path = usePathname();
    const sections = useMemo(() => {
        // find the path part /insurance/companies/.*
        const basePath = `/insurance/companies/${path.split("/")[3]}`;
        console.log(basePath)
        return [{
            items: [
                {title: "General", href: `${basePath}/`, exact: basePath, icon: Settings},
                {title: "Sources", href: `${basePath}/sources`, icon: FileInput},
            ],
        }]
    }, [path])
    return (
        <GenericSidebar sections={sections} header={"Cigna"}></GenericSidebar>
    )

}