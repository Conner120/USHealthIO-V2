"use client"

import {usePathname} from "next/navigation"
import {cn} from "@/lib/utils"
import Link from "next/link";

export interface SidebarItem {
    title: string
    href: string
    exact?: string
    icon?: React.ComponentType<{ className?: string }>
}

export interface SidebarSection {
    title?: string
    items: SidebarItem[]
}

interface GenericSidebarProps {
    sections: SidebarSection[]
    className?: string
    header?: string
}

export function GenericSidebar({sections, className, header}: GenericSidebarProps) {
    const pathname = usePathname()
    return (
        <nav className={cn("w-56 border-r border-border bg-card", className)}>
            <div className="space-y-6 py-4">
                {header && (
                    <div className="px-4 py-2">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            {header}
                        </h2>
                    </div>
                )}

                {sections.map((section, i) => (
                    <div key={i} className="space-y-2">
                        {section.title && (
                            <div className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {section.title}
                            </div>
                        )}
                        <div className="space-y-1 px-2">
                            {section.items.map((item) => {
                                const isActive =
                                    pathname === item.href || pathname.startsWith(item.href + "/") || item.exact && pathname === item.exact;
                                const Icon = item.icon

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-accent text-accent-foreground"
                                                : "text-foreground hover:bg-muted"
                                        )}
                                    >
                                        {Icon && <Icon className="h-4 w-4"/>}
                                        {item.title}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </nav>
    )
}
