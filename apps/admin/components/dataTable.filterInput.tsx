"use client";

import * as React from "react";
import { useReactTable } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExtendedColumnDef } from "./dataTable.types";

type FilterInputProps<TData, TValue> = {
  column: ReturnType<typeof useReactTable<TData>>["getAllColumns"][0];
  columnDef: ExtendedColumnDef<TData, TValue>;
};

export function FilterInput<TData, TValue>({
  column,
  columnDef,
}: FilterInputProps<TData, TValue>) {
  const filterValue = column.getFilterValue();
  
  // Use local state for text inputs to prevent input skipping during re-renders
  const [localValue, setLocalValue] = React.useState<string>(
    (filterValue ?? "") as string
  );

  // Sync local state when filterValue changes externally (e.g., clear filters)
  React.useEffect(() => {
    setLocalValue((filterValue ?? "") as string);
  }, [filterValue]);

  // Render Select for enum columns
  if (columnDef.filterType === "select" && columnDef.filterOptions) {
    const currentValue = filterValue ? String(filterValue) : undefined;

    return (
      <Select
        value={currentValue}
        onValueChange={(value) => {
          if (value === "__all__") {
            column.setFilterValue(undefined);
          } else {
            column.setFilterValue(value);
          }
        }}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder={`All`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All</SelectItem>
          {columnDef.filterOptions.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Render Select for boolean columns
  if (columnDef.filterType === "boolean") {
    const currentValue =
      filterValue !== undefined && filterValue !== null
        ? String(filterValue)
        : undefined;

    return (
      <Select
        value={currentValue}
        onValueChange={(value) => {
          if (value === "__all__") {
            column.setFilterValue(undefined);
          } else {
            column.setFilterValue(value === "true");
          }
        }}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All</SelectItem>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Default: text input with local state to prevent skipping letters
  return (
    <Input
      placeholder={`Filter...`}
      value={localValue}
      onChange={(event) => {
        const newValue = event.target.value;
        setLocalValue(newValue); // Update local state immediately
        column.setFilterValue(newValue); // Update column filter
      }}
      className="h-8"
    />
  );
}
