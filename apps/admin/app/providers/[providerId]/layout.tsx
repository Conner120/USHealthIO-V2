import {ProviderSidebar} from "@/app/providers/[providerId]/_components/providerSidebar";
import React from "react";

export default function Layout({children}: { children: React.ReactNode }) {
    return (
        <div className="flex space-x-3 h-full">
            <ProviderSidebar/>
            {children}
        </div>
    )
}
