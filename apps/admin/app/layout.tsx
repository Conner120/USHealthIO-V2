"use client"
import {AuthKitProvider} from '@workos-inc/authkit-nextjs/components';
import './globals.css';
import {SidebarInset, SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar";
import {AppSidebar} from "@/components/app-sidebar";
import {Separator} from "@/components/ui/separator";
import {Breadcrumb, BreadcrumbList, BreadcrumbSeparator} from "@/components/ui/breadcrumb";
import {usePathname} from "next/navigation";
import {SmartBreadCrumb} from "@/app/_components/smartBreadCrumb";
import React from "react";

const BreadCrumbs = [
    {
        name: "Home",
        part: '',
        hide: true,
        exactMatch: '/',
        href: '/'
    },
    {
        name: "Insurance",
        part: "insurance",
        href: "/insurance"
    }, {
        name: "Companies",
        part: "insurance/companies",
        href: "/insurance/companies"
    },
    {
        name: "New",
        exactMatch: '/insurance/companies/new',
        href: "/insurance/companies/new"
    },
    {
        name: "{{displayName}}",
        part: "insurance/companies/[id]",
        href: "/insurance/companies/(.*|!new)",
        table: 'InsuranceCompany'
    },
    {
        name: "General",
        part: "insurance/companies/[id]",
        href: "/insurance/companies/(.*|!new)",
        exactMatch: '/insurance/companies/(.*|!new)',
        hide: true,
    },
    {
        name: "Sources",
        part: "insurance/companies/[id]/source",
        href: "/insurance/companies/(.*|!new)/source",
    }
]
export default function RootLayout({children}: { children: React.ReactNode }) {
    // extract the breadcrumbs from the url
    const pathname = usePathname()
    // const breadcrumbs = BreadCrumbs.filter(b => (pathname.split("/").includes(b.part ?? "NA")) || b.exactMatch === pathname)
    const breadcrumbs = BreadCrumbs.filter((b) => {
        // calculate all possible paths up to the current pathname with regex support find any regex in the url splits and return those crumbs
        // habdle this /insurance/companies/(.*|!new)/notifications
        // hanlde exact match if hide is true
        if (b.hide && b.exactMatch) {
            if (b.exactMatch === pathname) {
                return true;
            }
            // handle regex in the exact match
            const exactParts = b.exactMatch.split("/");
            const pathParts = pathname.split("/");
            if (exactParts.length > pathParts.length || exactParts.length < pathParts.length) {
                return false;
            }
            for (let i = 0; i < exactParts.length; i++) {
                if (exactParts[i].startsWith("(") && exactParts[i].endsWith(")")) {
                    // regex part
                    const regexPart = exactParts[i].slice(1, -1);
                    const regex = new RegExp(regexPart.replace(/\|/g, "|").replace(/\.\*/g, ".*"));
                    if (!regex.test(pathParts[i])) {
                        return false;
                    }
                } else if (exactParts[i] !== pathParts[i]) {
                    return false;
                }
            }
            return true;
        }
        const pathParts = pathname.split("/");
        const breadcrumbParts = b.href.split("/");
        if (breadcrumbParts.length > pathParts.length) {
            return false;
        }
        // handle hidden regex crumbs
        for (let i = 0; i < breadcrumbParts.length; i++) {
            if (breadcrumbParts[i].startsWith("(") && breadcrumbParts[i].endsWith(")")) {
                // regex part
                const regexPart = breadcrumbParts[i].slice(1, -1);
                const regex = new RegExp(regexPart.replace(/\|/g, "|").replace(/\.\*/g, ".*"));
                if (!regex.test(pathParts[i])) {
                    return false;
                }
            } else if (breadcrumbParts[i] !== pathParts[i]) {
                return false;
            }
        }
        return true;
    })
    return (
        <html lang="en">
        <body>
        <AuthKitProvider>
            <SidebarProvider>
                <AppSidebar/>
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                        <SidebarTrigger className="-ml-1"/>
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <Breadcrumb>
                            <BreadcrumbList>
                                {breadcrumbs.map((b, i, a) => {
                                    return (
                                        <React.Fragment key={i}>
                                            <SmartBreadCrumb key={i} breadcrumbConfig={b} path={pathname}/>
                                            {a.length - 1 !== i && <BreadcrumbSeparator/>}
                                        </React.Fragment>
                                    )
                                })}
                            </BreadcrumbList>
                        </Breadcrumb>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4">
                        {children}
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </AuthKitProvider>
        </body>
        </html>
    );
}
