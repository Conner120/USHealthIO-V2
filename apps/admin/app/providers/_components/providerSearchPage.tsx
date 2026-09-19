"use client"
import {DataTable} from "@/components/dataTable";
import {useRouter} from "next/navigation";
import {useCallback, useEffect, useMemo, useState, useTransition} from "react";
import {searchProviders, ProviderRow} from "@/app/providers/_lib/searchProviders";
import type {ColumnFilter} from "@/app/providers/_lib/searchProviders";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import type {ColumnFiltersState} from "@tanstack/react-table";

type EntityType = "INDIVIDUAL" | "ORGANIZATION";

function ProviderTable({entityType}: { entityType: EntityType }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<ProviderRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await searchProviders(
                globalFilter,
                entityType,
                pageIndex,
                pageSize,
                columnFilters as ColumnFilter[],
            );
            setData(result.providers as ProviderRow[]);
            setTotalCount(result.total);
        });
    }, [globalFilter, entityType, pageIndex, pageSize, columnFilters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearchChange = useCallback((search: string) => {
        setGlobalFilter(search);
        setPageIndex(0);
    }, []);

    const handleColumnFiltersChange = useCallback((filters: ColumnFiltersState) => {
        setColumnFilters(filters);
        setPageIndex(0);
    }, []);

    const handlePageChange = useCallback((newPage: number) => {
        setPageIndex(newPage);
    }, []);

    const handlePageSizeChange = useCallback((newSize: number) => {
        setPageSize(newSize);
        setPageIndex(0);
    }, []);

    const columns = useMemo(() => {
        const addressColumn = {
            accessorKey: "primaryCity",
            header: "Primary Address",
            cell: ({row}: any) => {
                const city = row.original.primaryCity;
                const state = row.original.primaryState;
                if (!city && !state) return "—";
                return [city, state].filter(Boolean).join(", ");
            },
        };

        const statusColumn = {
            accessorKey: "deactivationDate",
            header: "Status",
            enableColumnFilter: false,
            cell: ({row}: any) =>
                row.original.deactivationDate ? (
                    <span className="text-destructive font-medium">Deactivated</span>
                ) : (
                    <span className="text-green-600 font-medium">Active</span>
                ),
        };

        const updatedColumn = {
            accessorKey: "updatedAt",
            header: "Updated",
            enableColumnFilter: false,
            cell: ({row}: any) => row.original.updatedAt ?? "—",
        };

        if (entityType === "INDIVIDUAL") {
            return [
                {accessorKey: "providerNPI", header: "NPI"},
                {accessorKey: "firstName", header: "First Name", cell: ({row}: any) => row.original.firstName ?? "—"},
                {accessorKey: "lastName", header: "Last Name", cell: ({row}: any) => row.original.lastName ?? "—"},
                {accessorKey: "credential", header: "Credential", cell: ({row}: any) => row.original.credential ?? "—"},
                {
                    accessorKey: "genderCode",
                    header: "Gender",
                    enableColumnFilter: false,
                    cell: ({row}: any) => {
                        const g = row.original.genderCode;
                        if (g === "M") return "Male";
                        if (g === "F") return "Female";
                        return "—";
                    },
                },
                addressColumn,
                statusColumn,
                updatedColumn,
            ];
        }

        return [
            {accessorKey: "providerNPI", header: "NPI"},
            {accessorKey: "businessName", header: "Business Name", cell: ({row}: any) => row.original.businessName ?? "—"},
            {accessorKey: "credential", header: "Credential", cell: ({row}: any) => row.original.credential ?? "—"},
            addressColumn,
            statusColumn,
            updatedColumn,
        ];
    }, [entityType]);

    return (
        <div className={isPending ? "opacity-70 transition-opacity" : ""}>
            <DataTable
                columns={columns}
                data={data}
                globalSearch={true}
                enableColumnFilters={true}
                serverPagination={true}
                pageIndex={pageIndex}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onGlobalFilterChange={handleSearchChange}
                onColumnFiltersChange={handleColumnFiltersChange}
                globalFilterValue={globalFilter}
                columnFiltersValue={columnFilters}
                defaultPageSize={25}
                pageSizeOptions={[10, 25, 50, 100]}
                storageKey={`provider-search-${entityType.toLowerCase()}`}
                action={(row) => router.push(`/providers/${row.id}`)}
            />
        </div>
    );
}

export default function ProviderSearchPage() {
    const [activeTab, setActiveTab] = useState<EntityType>("INDIVIDUAL");

    return (
        <div className="space-y-4">
            <div className="flex gap-2 border-b pb-2">
                <Button
                    variant={activeTab === "INDIVIDUAL" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("INDIVIDUAL")}
                    className={cn(activeTab === "INDIVIDUAL" && "shadow-sm")}
                >
                    Individuals
                </Button>
                <Button
                    variant={activeTab === "ORGANIZATION" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("ORGANIZATION")}
                    className={cn(activeTab === "ORGANIZATION" && "shadow-sm")}
                >
                    Organizations
                </Button>
            </div>

            <ProviderTable key={activeTab} entityType={activeTab}/>
        </div>
    );
}
