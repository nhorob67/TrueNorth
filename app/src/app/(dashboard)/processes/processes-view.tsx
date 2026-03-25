"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";
import type { AutomationLevel } from "@/types/database";

// ============================================================
// Types
// ============================================================

interface ProcessWithOwner {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_name: string;
  automation_level: AutomationLevel;
  lifecycle_status: string;
  version: number;
  linked_kpi_ids: string[];
  linked_bet_ids: string[];
  trigger_conditions: string | null;
  updated_at: string;
}

// ============================================================
// Automation Level Config
// ============================================================

const AUTOMATION_LABELS: Record<
  AutomationLevel,
  { label: string; badge: "green" | "yellow" | "neutral" }
> = {
  0: { label: "Manual", badge: "neutral" },
  1: { label: "Assisted", badge: "green" },
  2: { label: "Partial", badge: "yellow" },
  3: { label: "Conditional", badge: "yellow" },
  4: { label: "Full", badge: "green" },
};

// ============================================================
// Process Card
// ============================================================

function ProcessCard({ process }: { process: ProcessWithOwner }) {
  const router = useRouter();
  const auto = AUTOMATION_LABELS[process.automation_level];
  const kpiCount = process.linked_kpi_ids?.length ?? 0;
  const betCount = process.linked_bet_ids?.length ?? 0;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/processes/${process.id}`)}
    >
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Name + version */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink leading-tight line-clamp-1">
            {process.name}
          </h3>
          <span className="text-xs text-subtle whitespace-nowrap">
            v{process.version}
          </span>
        </div>

        {/* Description preview */}
        {process.description && (
          <p className="text-xs text-subtle line-clamp-1">
            {process.description}
          </p>
        )}

        {/* Owner */}
        <p className="text-xs text-subtle">
          Owner: <span className="text-ink">{process.owner_name}</span>
        </p>

        {/* Automation Ladder Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`h-2 flex-1 rounded-sm transition-colors ${
                  level <= process.automation_level
                    ? "bg-accent"
                    : "bg-line"
                }`}
                title={`L${level} ${AUTOMATION_LABELS[level as AutomationLevel].label}`}
              />
            ))}
          </div>
          <p className="text-[10px] text-subtle">
            L{process.automation_level} {auto.label}
          </p>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge status={auto.badge} dot={false}>
            L{process.automation_level} {auto.label}
          </Badge>
          <Badge
            status={process.lifecycle_status === "active" ? "green" : "neutral"}
            dot={false}
          >
            {process.lifecycle_status}
          </Badge>
          {kpiCount > 0 && (
            <Badge status="neutral" dot={false}>
              {kpiCount} KPI{kpiCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {betCount > 0 && (
            <Badge status="neutral" dot={false}>
              {betCount} Bet{betCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Trigger conditions preview */}
        {process.trigger_conditions && (
          <p className="text-xs text-subtle italic line-clamp-1">
            Trigger: {process.trigger_conditions}
          </p>
        )}

        {/* Last updated */}
        <p className="text-xs text-subtle">
          Updated {new Date(process.updated_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Filter Bar
// ============================================================

type LifecycleFilter = "all" | "active" | "archived";
type AutoFilter = "all" | 0 | 1 | 2 | 3 | 4;

function FilterBar({
  lifecycle,
  setLifecycle,
  autoFilter,
  setAutoFilter,
  search,
  setSearch,
}: {
  lifecycle: LifecycleFilter;
  setLifecycle: (v: LifecycleFilter) => void;
  autoFilter: AutoFilter;
  setAutoFilter: (v: AutoFilter) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const lifecycleOptions: { value: LifecycleFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ];

  const autoOptions: { value: AutoFilter; label: string }[] = [
    { value: "all", label: "All Levels" },
    { value: 0, label: "L0" },
    { value: 1, label: "L1" },
    { value: 2, label: "L2" },
    { value: 3, label: "L3" },
    { value: 4, label: "L4" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Lifecycle toggle */}
      <div className="flex rounded-lg border border-line overflow-hidden">
        {lifecycleOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setLifecycle(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              lifecycle === opt.value
                ? "bg-accent text-white"
                : "bg-surface text-ink hover:bg-canvas"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Automation level filter */}
      <div className="flex rounded-lg border border-line overflow-hidden">
        {autoOptions.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setAutoFilter(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              autoFilter === opt.value
                ? "bg-accent text-white"
                : "bg-surface text-ink hover:bg-canvas"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Text search */}
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Search processes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm"
        />
      </div>
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function ProcessesView({
  processes,
}: {
  processes: ProcessWithOwner[];
}) {
  const router = useRouter();
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>("all");
  const [autoFilter, setAutoFilter] = useState<AutoFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return processes.filter((p) => {
      if (lifecycle !== "all" && p.lifecycle_status !== lifecycle) return false;
      if (autoFilter !== "all" && p.automation_level !== autoFilter)
        return false;
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.description ?? "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [processes, lifecycle, autoFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">Process Library</h1>
        <Button onClick={() => router.push("/processes/new")}>
          New Process
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        lifecycle={lifecycle}
        setLifecycle={setLifecycle}
        autoFilter={autoFilter}
        setAutoFilter={setAutoFilter}
        search={search}
        setSearch={setSearch}
      />

      {/* Process grid or empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No processes found"
          description={
            processes.length === 0
              ? "Create your first process to get started."
              : "Try adjusting your filters."
          }
          action={
            processes.length === 0 ? (
              <Button onClick={() => router.push("/processes/new")}>
                New Process
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <ProcessCard key={p.id} process={p} />
          ))}
        </div>
      )}
    </div>
  );
}
