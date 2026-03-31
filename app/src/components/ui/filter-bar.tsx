"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  sortOptions?: FilterOption[];
  className?: string;
}

export function FilterBar({ filters, sortOptions, className = "" }: FilterBarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const activeCount = filters.filter((f) => searchParams.get(f.key)).length +
    (sortOptions && searchParams.get("sort") ? 1 : 0);

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={searchParams.get(filter.key) ?? ""}
          onChange={(e) => updateParam(filter.key, e.target.value)}
          className="bg-well border border-line rounded-[var(--radius-md)] px-3 py-2 min-h-[44px] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{filter.label}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {sortOptions && (
        <select
          value={searchParams.get("sort") ?? ""}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="bg-well border border-line rounded-[var(--radius-md)] px-3 py-2 min-h-[44px] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Sort by</option>
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] text-xs font-medium text-accent hover:text-accent-warm transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Clear ({activeCount})
        </button>
      )}
    </div>
  );
}
