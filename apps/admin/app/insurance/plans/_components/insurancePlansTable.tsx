"use client";
import { DataTable, FilterPreset } from "@/components/dataTable";
import { InsurancePlan } from "@repo/database";
import { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type InsurancePlanWithCompany = InsurancePlan & {
  insuranceCompany: {
    id: string;
    displayName: string;
    legalName: string;
  } | null;
};

type Props = {
  insurancePlans: InsurancePlanWithCompany[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
};

export default function InsurancePlansTable({
  insurancePlans,
  pageIndex,
  pageSize,
  totalCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get current filter values from URL
  const globalFilterValue = searchParams.get("search") || "";
  const columnFiltersValue: ColumnFiltersState = useMemo(() => {
    const filters: ColumnFiltersState = [];
    // Read all filter params from URL
    searchParams.forEach((value, key) => {
      // Skip pagination params
      if (key === "page" || key === "pageSize" || key === "search") return;
      // Add as column filter
      if (value) {
        filters.push({ id: key, value });
      }
    });
    return filters;
  }, [searchParams]);

  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    // Reset to page 1 when filters change
    params.set("page", "1");
    router.push(`/insurance/plans?${params.toString()}`);
  };

  const handlePageChange = (newPageIndex: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPageIndex + 1));
    router.push(`/insurance/plans?${params.toString()}`);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", String(newPageSize));
    params.set("page", "1"); // Reset to first page when changing page size
    router.push(`/insurance/plans?${params.toString()}`);
  };

  const handleGlobalFilterChange = (search: string) => {
    updateUrlParams({ search: search || null });
  };

  const handleColumnFiltersChange = (filters: ColumnFiltersState) => {
    const params = new URLSearchParams(searchParams.toString());
    // Remove existing column filter params (except pagination/search)
    const keysToRemove: string[] = [];
    params.forEach((_, key) => {
      if (key !== "page" && key !== "pageSize" && key !== "search") {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach((key) => params.delete(key));

    // Add new filter params
    filters.forEach((filter) => {
      if (filter.value) {
        params.set(filter.id, String(filter.value));
      }
    });

    params.set("page", "1");
    router.push(`/insurance/plans?${params.toString()}`);
  };

  const commonFilters: FilterPreset<InsurancePlanWithCompany>[] = useMemo(
    () => [
      {
        label: "Active Plans",
        filters: (setColumnFilters) => {
          setColumnFilters([{ id: "planActive", value: true }]);
        },
      },
      {
        label: "Inactive Plans",
        filters: (setColumnFilters) => {
          setColumnFilters([{ id: "planActive", value: false }]);
        },
      },
      {
        label: "Individual Market",
        filters: (setColumnFilters) => {
          setColumnFilters([{ id: "planMarketType", value: "INDIVIDUAL" }]);
        },
      },
      {
        label: "Group Market",
        filters: (setColumnFilters) => {
          setColumnFilters([{ id: "planMarketType", value: "GROUP" }]);
        },
      },
      {
        label: "EIN Plans",
        filters: (setColumnFilters) => {
          setColumnFilters([{ id: "planIdType", value: "EIN" }]);
        },
      },
      {
        label: "HIOS Plans",
        filters: (setColumnFilters) => {
          setColumnFilters([{ id: "planIdType", value: "HIOS" }]);
        },
      },
    ],
    [],
  );

  const columns: ColumnDef<InsurancePlanWithCompany>[] = useMemo(
    () => [
      {
        accessorKey: "planName",
        header: "Plan Name",
        enableColumnFilter: true,
        size: 450,
      },
      {
        accessorKey: "planId",
        header: "Plan ID",
        enableColumnFilter: true,
        size: 180,
      },
      {
        accessorKey: "planIdType",
        header: "ID Type",
        enableColumnFilter: true,
        filterType: "select" as const,
        filterOptions: [
          { label: "EIN", value: "EIN" },
          { label: "HIOS", value: "HIOS" },
        ],
        cell: ({ row }) => row.original.planIdType,
        size: 140,
      },
      {
        accessorKey: "planMarketType",
        header: "Market Type",
        enableColumnFilter: true,
        filterType: "select" as const,
        filterOptions: [
          { label: "Individual", value: "INDIVIDUAL" },
          { label: "Group", value: "GROUP" },
        ],
        cell: ({ row }) => row.original.planMarketType,
        size: 200,
      },
      {
        accessorKey: "planSponsorName",
        header: "Sponsor Name",
        enableColumnFilter: true,
        cell: ({ row }) => row.original.planSponsorName || "-",
        size: 220,
      },
      {
        accessorKey: "insuranceCompany",
        header: "Insurance Company",
        enableColumnFilter: true,
        cell: ({ row }) => row.original.insuranceCompany?.displayName || "-",
        filterFn: (row, id, value) => {
          const company = row.original.insuranceCompany;
          if (!value || !company) return !value; // If no filter, show all; if filter but no company, hide
          return (
            company.displayName
              .toLowerCase()
              .includes(String(value).toLowerCase()) || company.id === value
          );
        },
        size: 220,
      },
      {
        accessorKey: "planActive",
        header: "Active",
        enableColumnFilter: true,
        filterType: "boolean" as const,
        cell: ({ row }) => (
          <span
            className={
              row.original.planActive ? "text-green-600" : "text-red-600"
            }
          >
            {row.original.planActive ? "Yes" : "No"}
          </span>
        ),
        filterFn: (row, id, value) => {
          if (value === undefined || value === null || value === "")
            return true;
          return String(row.original.planActive) === String(value);
        },
        size: 120,
      },
      {
        accessorKey: "planFirstSeen",
        header: "First Seen",
        enableColumnFilter: true,
        cell: ({ row }) =>
          new Date(row.original.planFirstSeen).toLocaleDateString(),
        size: 140,
      },
      {
        accessorKey: "planLastSeen",
        header: "Last Seen",
        enableColumnFilter: true,
        cell: ({ row }) =>
          new Date(row.original.planLastSeen).toLocaleDateString(),
        size: 140,
      },
      {
        accessorKey: "createdAt",
        header: "Created At",
        enableColumnFilter: true,
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString(),
        size: 140,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={insurancePlans}
      globalSearch={true}
      enableColumnFilters={true}
      commonFilters={commonFilters}
      pageSizeOptions={[10, 25, 50, 100]}
      serverPagination={true}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      onGlobalFilterChange={handleGlobalFilterChange}
      onColumnFiltersChange={handleColumnFiltersChange}
      globalFilterValue={globalFilterValue}
      columnFiltersValue={columnFiltersValue}
      enableSelection={false}
      storageKey="insurance-plans"
      action={(row) => {
        // Could navigate to detail page if needed
        console.log(row.id);
      }}
    />
  );
}
