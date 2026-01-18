"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDown,
  PlusIcon,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DataTableProps, ExtendedColumnDef } from "./dataTable.types";
import { globalFilterFn, getColumnWidth, getInitialColumnVisibility, persistColumnVisibility } from "./dataTable.utils";
import { FilterInput } from "./dataTable.filterInput";

export type { FilterPreset } from "./dataTable.types";

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumn,
  filterPlaceholder = "Filter...",
  createLink,
  createName,
  enableSelection = false,
  action,
  globalSearch = false,
  enableColumnFilters = false,
  commonFilters,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 10,
  pageIndex: controlledPageIndex,
  pageSize: controlledPageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  serverPagination = false,
  storageKey = "",
  onGlobalFilterChange,
  onColumnFiltersChange,
  globalFilterValue,
  columnFiltersValue,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    React.useMemo(() => getInitialColumnVisibility(storageKey), [storageKey])
  );
  const [rowSelection, setRowSelection] = React.useState({});
  const [internalPageIndex, setInternalPageIndex] = React.useState(0);
  const [internalPageSize, setInternalPageSize] = React.useState(defaultPageSize);

  // Use controlled filters if server-side filtering is enabled
  const columnFilters = React.useMemo(() => {
    return serverPagination && columnFiltersValue !== undefined
      ? columnFiltersValue
      : internalColumnFilters;
  }, [serverPagination, columnFiltersValue, internalColumnFilters]);

  const globalFilter = React.useMemo(() => {
    return serverPagination && globalFilterValue !== undefined
      ? globalFilterValue
      : internalGlobalFilter;
  }, [serverPagination, globalFilterValue, internalGlobalFilter]);

  const setColumnFilters = React.useCallback(
    (filters: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof filters === 'function' ? filters(columnFilters) : filters;
      if (serverPagination && onColumnFiltersChange) {
        onColumnFiltersChange(newFilters);
      } else {
        setInternalColumnFilters(newFilters);
      }
    },
    [serverPagination, onColumnFiltersChange, columnFilters]
  );

  const setGlobalFilter = React.useCallback(
    (filter: string | ((prev: string) => string)) => {
      const newFilter = typeof filter === 'function' ? filter(globalFilter) : filter;
      if (serverPagination && onGlobalFilterChange) {
        onGlobalFilterChange(newFilter);
      } else {
        setInternalGlobalFilter(newFilter);
      }
    },
    [serverPagination, onGlobalFilterChange, globalFilter]
  );

  // Use controlled pagination if server-side, otherwise use internal state
  const pageIndex = React.useMemo(() => {
    return serverPagination ? (controlledPageIndex ?? 0) : internalPageIndex;
  }, [serverPagination, controlledPageIndex, internalPageIndex]);

  const pageSize = React.useMemo(() => {
    return serverPagination
      ? (controlledPageSize ?? defaultPageSize)
      : internalPageSize;
  }, [serverPagination, controlledPageSize, defaultPageSize, internalPageSize]);

  const pageCount = React.useMemo(() => {
    if (serverPagination && totalCount !== undefined && pageSize > 0) {
      return Math.max(1, Math.ceil(totalCount / pageSize));
    }
    if (pageSize > 0) {
      return Math.max(1, Math.ceil(data.length / pageSize));
    }
    return 1;
  }, [serverPagination, totalCount, pageSize, data.length]);

  // Persist column visibility to localStorage when it changes
  React.useEffect(() => {
    persistColumnVisibility(columnVisibility, storageKey);
  }, [columnVisibility, storageKey]);

  const columnsCombined = React.useMemo(() => {
    const selectColumn: ColumnDef<TData, TValue> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return enableSelection ? [selectColumn, ...columns] : columns;
  }, [columns, enableSelection]);

  const table = useReactTable({
    data,
    columns: columnsCombined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: serverPagination ? undefined : getPaginationRowModel(),
    manualPagination: serverPagination,
    manualFiltering: serverPagination,
    pageCount: serverPagination ? pageCount : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: serverPagination ? undefined : getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: globalFilterFn,
    onGlobalFilterChange: setGlobalFilter,
    initialState: {
      pagination: {
        pageIndex: pageIndex,
        pageSize: pageSize,
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: pageIndex,
        pageSize: pageSize,
      },
      globalFilter: globalSearch ? globalFilter : undefined,
    },
  });

  // Sync pageIndex and pageSize when they change externally (for server pagination)
  React.useEffect(() => {
    if (!serverPagination) return;
    
    if (controlledPageIndex !== undefined && controlledPageIndex !== table.getState().pagination.pageIndex) {
      table.setPageIndex(controlledPageIndex);
    }
    if (controlledPageSize !== undefined && controlledPageSize !== table.getState().pagination.pageSize) {
      table.setPageSize(controlledPageSize);
    }
  }, [serverPagination, controlledPageIndex, controlledPageSize, table]);

  const clearAllFilters = React.useCallback(() => {
    setColumnFilters([]);
    setGlobalFilter("");
  }, [setColumnFilters, setGlobalFilter]);

  const hasActiveFilters = React.useMemo(() => {
    return columnFilters.length > 0 || (globalSearch && globalFilter.length > 0);
  }, [columnFilters, globalSearch, globalFilter]);

  const renderResultsCount = () => {
    if (enableSelection) {
      return (
        <>
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </>
      );
    }

    const totalResults = serverPagination && totalCount !== undefined
      ? totalCount
      : table.getFilteredRowModel?.()?.rows.length ?? data.length;
    
    const start = pageIndex * pageSize + 1;
    const end = Math.min((pageIndex + 1) * pageSize, totalResults);

    return (
      <>
        Showing {start} to {end} of {totalResults} results
      </>
    );
  };

  const handlePageChange = React.useCallback((newPageIndex: number) => {
    if (serverPagination && onPageChange) {
      onPageChange(newPageIndex);
    } else {
      setInternalPageIndex(newPageIndex);
      table.setPageIndex(newPageIndex);
    }
  }, [serverPagination, onPageChange, table]);

  const handlePageSizeChange = React.useCallback((newSize: number) => {
    if (serverPagination && onPageSizeChange) {
      onPageSizeChange(newSize);
    } else {
      setInternalPageSize(newSize);
      table.setPageSize(newSize);
    }
  }, [serverPagination, onPageSizeChange, table]);

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center py-4">
        <div className="flex flex-1 gap-2 flex-wrap">
          {/* Global Search */}
          {globalSearch && (
            <div className="relative max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search all columns..."
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-8"
              />
            </div>
          )}

          {/* Legacy single column filter */}
          {!globalSearch && !enableColumnFilters && filterColumn && (
            <Input
              placeholder={filterPlaceholder}
              value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn(filterColumn)?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
          )}

          {/* Common Filter Presets */}
          {commonFilters && commonFilters.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Filters <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filter Presets</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {commonFilters.map((preset, index) => (
                  <DropdownMenuCheckboxItem
                    key={index}
                    onSelect={() => preset.filters(setColumnFilters)}
                  >
                    {preset.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9">
              <X className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Create button */}
        {createLink && (
          <Button variant="outline" className="ml-auto" asChild>
            <Link href={createLink}>
              <PlusIcon className="ml-1 h-4 w-4" /> Create {createName}
            </Link>
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <React.Fragment key={headerGroup.id}>
                <TableRow>
                  {headerGroup.headers.map((header) => {
                    const columnDef = header.column.columnDef as ExtendedColumnDef<TData, TValue>;
                    const width = getColumnWidth(columnDef, header.getSize());

                    return (
                      <TableHead
                        key={header.id}
                        style={width ? { width, minWidth: width, maxWidth: width } : undefined}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>

                {/* Filter row for column filters */}
                {enableColumnFilters && (
                  <TableRow>
                    {headerGroup.headers.map((header) => {
                      const column = header.column;
                      const canFilter = column.getCanFilter();
                      const columnDef = header.column.columnDef as ExtendedColumnDef<TData, TValue>;
                      const width = getColumnWidth(columnDef, header.getSize());

                      return (
                        <TableHead
                          key={`filter-${header.id}`}
                          className="py-2"
                          style={width ? { width, minWidth: width, maxWidth: width } : undefined}
                        >
                          {canFilter && header.column.columnDef.id !== "select" ? (
                            <FilterInput column={column} columnDef={columnDef} />
                          ) : null}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => {
                    if (action) {
                      action(row.original);
                    } else {
                      row.toggleSelected();
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const columnDef = cell.column.columnDef as ExtendedColumnDef<TData, TValue>;
                    const width = getColumnWidth(columnDef, cell.column.getSize());

                    return (
                      <TableCell
                        key={cell.id}
                        style={width ? { width, minWidth: width, maxWidth: width } : undefined}
                        className="truncate"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-4">
          <div className="text-muted-foreground text-sm">{renderResultsCount()}</div>

          {pageSizeOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select value={`${pageSize}`} onValueChange={(value) => handlePageSizeChange(Number(value))}>
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent side="top">
                  {pageSizeOptions.map((ps) => (
                    <SelectItem key={ps} value={`${ps}`}>
                      {ps}
                    </SelectItem>
                  ))}
                  {!serverPagination && (
                    <SelectItem value={`${table.getFilteredRowModel().rows.length}`}>
                      All
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Column visibility toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(0)}
              disabled={pageIndex === 0}
              className="hidden h-8 w-8 p-0 lg:flex"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Previous</span>
            </Button>
            <div className="flex items-center justify-center text-sm font-medium">
              Page {pageIndex + 1} of {pageCount}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pageIndex + 1)}
              disabled={pageIndex >= pageCount - 1}
            >
              <span className="sr-only sm:not-sr-only sm:mr-2">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(0, pageCount - 1))}
              disabled={pageIndex >= pageCount - 1}
              className="hidden h-8 w-8 p-0 lg:flex"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
