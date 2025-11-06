"use client"

import * as React from "react"
import {BriefcaseMedicalIcon, Hospital, IdCard, LifeBuoy, Send,} from "lucide-react"

import {NavMain} from "@/components/nav-main"
import {NavSecondary} from "@/components/nav-secondary"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import {NavUser} from "@/components/nav-user";
import {useAuth} from "@workos-inc/authkit-nextjs/components";

const data = {
    navMain: [
        {
            title: "Hospitals",
            url: "#",
            icon: Hospital,
            isActive: true,
            items: [
                {
                    title: "All Hospitals",
                    url: "#",
                },
                {
                    title: "Hospital File Scans",
                    url: "#",
                },
            ],
        },
        {
            title: "Insurance",
            url: "#",
            icon: IdCard,
            isActive: true,
            items: [
                {
                    title: "Insurance Companies",
                    url: "/insurance/companies",

                },
                {
                    title: "Insurance Plans",
                    url: "#",
                },
                {
                    title: "Setup Insurance Companies",
                    url: "/insurance/companies/new",
                }
            ],
        },
        // {
        //     title: "Pharmacy",
        //     url: "#",
        //     icon: PillBottle,
        //     isActive: true,
        //     items: [
        //         {
        //             title: "History",
        //             url: "#",
        //         },
        //         {
        //             title: "Starred",
        //             url: "#",
        //         },
        //         {
        //             title: "Settings",
        //             url: "#",
        //         },
        //     ],
        // },
        // {
        //     title: "Medicare",
        //     url: "#",
        //     icon: Landmark,
        //     isActive: true,
        //     items: [
        //         {
        //             title: "History",
        //             url: "#",
        //         },
        //         {
        //             title: "Starred",
        //             url: "#",
        //         },
        //         {
        //             title: "Settings",
        //             url: "#",
        //         },
        //     ],
        // },
    ],
    navSecondary: [
        {
            title: "Support",
            url: "#",
            icon: LifeBuoy,
        },
        {
            title: "Feedback",
            url: "#",
            icon: Send,
        },
    ],
}

interface AppSidebar {
    user?: {
        name: string,
        email: string,
        avatar: string,
    }
}


export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
    const {user} = useAuth();
    return (
        <Sidebar variant="inset" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <a href="#">
                                <div
                                    className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                    <BriefcaseMedicalIcon className="size-4"/>
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">US Health IO</span>
                                    <span className="truncate text-xs">Admin Portal</span>
                                </div>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain}/>
                <NavSecondary items={data.navSecondary} className="mt-auto"/>
            </SidebarContent>
            {user && (
                <SidebarFooter>
                    <NavUser user={{
                        email: user?.email,
                        avatar: user?.profilePictureUrl ?? '/avatars/shadcn.jpg',
                        firstName: user?.firstName ?? "First",
                        lastName: user?.lastName ?? "Last"
                    }}/>
                </SidebarFooter>
            )}
        </Sidebar>
    )
}
