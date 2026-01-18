import { GlobalFilterFn } from "@tanstack/react-table";
import { ExtendedColumnDef } from "./dataTable.types";

export const globalFilterFn: GlobalFilterFn<unknown> = (
  row,
  columnId,
  filterValue: string,
) => {
  const search = filterValue.toLowerCase();

  // Search across all columns
  return Object.values(row.original).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "object") {
      // Handle nested objects (like insuranceCompany)
      return JSON.stringify(value).toLowerCase().includes(search);
    }
    return String(value).toLowerCase().includes(search);
  });
};

export function getColumnWidth<TData, TValue>(
  columnDef: ExtendedColumnDef<TData, TValue>,
  headerSize: number
): number | string | undefined {
  return columnDef.size || (headerSize > 0 ? headerSize : undefined);
}

export function getInitialColumnVisibility(storageKey: string): Record<string, boolean> {
  if (typeof window === "undefined" || !storageKey) return {};
  try {
    const stored = localStorage.getItem(`table-column-visibility-${storageKey}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function persistColumnVisibility(
  columnVisibility: Record<string, boolean>,
  storageKey: string
): void {
  if (typeof window !== "undefined" && storageKey) {
    try {
      localStorage.setItem(
        `table-column-visibility-${storageKey}`,
        JSON.stringify(columnVisibility)
      );
    } catch {
      // Ignore localStorage errors (e.g., quota exceeded)
    }
  }
}
