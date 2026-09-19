"use client"
import {GenericSidebar} from "@/components/subSidebar";
import {Building2, FileText, MapPin, Settings, Stethoscope} from "lucide-react"
import {useMemo} from "react";
import {usePathname} from "next/navigation";

export function ProviderSidebar() {
    const path = usePathname();
    const sections = useMemo(() => {
        const basePath = `/providers/${path.split("/")[2]}`;
        return [{
            items: [
                {title: "General", href: `${basePath}/`, exact: basePath, icon: Settings},
                {title: "Addresses", href: `${basePath}/addresses`, icon: MapPin},
                {title: "Licenses", href: `${basePath}/licenses`, icon: FileText},
                {title: "Taxonomies", href: `${basePath}/taxonomies`, icon: Stethoscope},
                {title: "Groups", href: `${basePath}/groups`, icon: Building2},
            ],
        }]
    }, [path])
    return (
        <GenericSidebar sections={sections} header={"Provider"}/>
    )
}
