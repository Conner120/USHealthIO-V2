"use client";

import {BreadcrumbItem, BreadcrumbLink} from "@/components/ui/breadcrumb";
import {useEffect, useState} from "react";
import {getName} from "@/app/_components/_lib/BreadCrumbName";
import {Skeleton} from "@/components/ui/skeleton";

export function SmartBreadCrumb(props: {
    key: number,
    breadcrumbConfig: {
        name: string,
        part?: string,
        href: string,
        hide?: boolean,
        exactMatch?: string,
        table?: string
    }, path: string
}) {
    const {name, part, table, exactMatch, href} = props.breadcrumbConfig;
    const path = props.path;
    const [linkName, setLinkName] = useState<string | null>(!table ? name : null);
    const [linkPath, setLinkPath] = useState<string | null>(!table ? href : null);
    useEffect(() => {
        if (table) {
            getName(name, part, exactMatch, path, href, table).then(({linkHref, linkName}) => {
                setLinkName(linkName);
                setLinkPath(linkHref);
            });
        }
    }, [exactMatch, href, name, part, path, table]);
    if (!linkName || !linkPath) {
        return <Skeleton className="h-5 w-20"/>
    }
    return (
        <BreadcrumbItem>
            <BreadcrumbLink href={linkPath}>{linkName}</BreadcrumbLink>
        </BreadcrumbItem>
    )

}