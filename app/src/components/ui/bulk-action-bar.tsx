"use client";

import { Button } from "./button";

interface BulkAction {
  label: string;
  onClick: (selectedIds: string[]) => void;
  variant?: "primary" | "secondary" | "destructive";
}

interface BulkActionBarProps {
  selectedIds: string[];
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  actions: BulkAction[];
}

export function BulkActionBar({
  selectedIds,
  totalCount,
  onSelectAll,
  onDeselectAll,
  actions,
}: BulkActionBarProps) {
  if (selectedIds.length === 0) return null;

  const allSelected = selectedIds.length === totalCount;

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-2.5 bg-accent/5 border border-accent/20 rounded-[10px] mb-4">
      <span className="text-sm font-medium text-ink">
        {selectedIds.length} selected
      </span>

      <button
        onClick={allSelected ? onDeselectAll : onSelectAll}
        className="text-xs font-medium text-accent hover:text-accent-warm transition-colors"
      >
        {allSelected ? "Deselect all" : `Select all ${totalCount}`}
      </button>

      <div className="flex-1" />

      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant ?? "secondary"}
          size="sm"
          onClick={() => action.onClick(selectedIds)}
        >
          {action.label}
        </Button>
      ))}

      <button
        onClick={onDeselectAll}
        className="p-1 text-faded hover:text-subtle transition-colors"
        aria-label="Clear selection"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
