import { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";

export type FilterPreset<TData> = {
  label: string;
  filters: (setColumnFilters: (filters: ColumnFiltersState) => void) => void;
};

export type ExtendedColumnDef<TData, TValue> = ColumnDef<TData, TValue> & {
  size?: number | string;
  filterType?: 'text' | 'select' | 'boolean';
  filterOptions?: Array<{ label: string; value: string | boolean }>;
};

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Optional — if you want to specify a filter column key (legacy, use enableColumnFilters instead) */
  filterColumn?: keyof TData & string;
  /** Optional placeholder for filter input */
  filterPlaceholder?: string;
  createLink?: string;
  createName?: string;
  enableSelection?: boolean;
  action?: (row: TData) => void;
  /** Enable global search across all columns */
  globalSearch?: boolean;
  /** Enable column-level filtering */
  enableColumnFilters?: boolean;
  /** Predefined filter presets */
  commonFilters?: FilterPreset<TData>[];
  /** Page size options */
  pageSizeOptions?: number[];
  /** Default page size (used when serverPagination is false) */
  defaultPageSize?: number;
  /** Server-side pagination: current page index (0-based) */
  pageIndex?: number;
  /** Server-side pagination: current page size */
  pageSize?: number;
  /** Server-side pagination: total number of records */
  totalCount?: number;
  /** Server-side pagination: callback when page changes */
  onPageChange?: (pageIndex: number) => void;
  /** Server-side pagination: callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Enable server-side pagination */
  serverPagination?: boolean;
  /** Unique key for persisting column visibility (optional, defaults to empty string) */
  storageKey?: string;
  /** Server-side filtering: callback when global search changes */
  onGlobalFilterChange?: (search: string) => void;
  /** Server-side filtering: callback when column filters change */
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  /** Server-side filtering: current global search value */
  globalFilterValue?: string;
  /** Server-side filtering: current column filters */
  columnFiltersValue?: ColumnFiltersState;
};
