"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/loading";
import { AddToTodoButton } from "@/components/add-to-todo-button";
import { KpiLinkageMap } from "@/components/kpi-linkage-map";

interface KpiEntry {
  value: number;
  recorded_at: string;
}

interface Kpi {
  id: string;
  name: string;
  unit: string;
  tier: string;
  current_value: number | null;
  target: number | null;
  health_status: "green" | "yellow" | "red";
  frequency: string;
  owner_id: string;
  kpi_entries: KpiEntry[];
  linked_driver_kpis: string[];
}

const healthColors: Record<string, string> = {
  green: "var(--color-semantic-green)",
  yellow: "var(--color-semantic-ochre)",
  red: "var(--color-semantic-brick)",
};

function Sparkline({ entries }: { entries: KpiEntry[] }) {
  if (entries.length < 2) return null;

  const sorted = [...entries]
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    )
    .slice(-8);

  const values = sorted.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 80;
  const height = 24;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-subtle"
      />
    </svg>
  );
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <Card borderColor={healthColors[kpi.health_status]}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-ink">{kpi.name}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold">
                {kpi.current_value ?? "—"}
              </span>
              {kpi.unit && (
                <span className="text-xs text-subtle">{kpi.unit}</span>
              )}
            </div>
            {kpi.target !== null && (
              <p className="text-xs text-subtle mt-0.5">
                Target: {kpi.target} {kpi.unit}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1">
              <AddToTodoButton
                entityId={kpi.id}
                entityType="kpi"
                entityLabel={kpi.name}
              />
              <Badge status={kpi.health_status}>
                {kpi.health_status.toUpperCase()}
              </Badge>
            </div>
            <Sparkline entries={kpi.kpi_entries} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScoreboardView({ kpis }: { kpis: Kpi[] }) {
  const [filter, setFilter] = useState<"all" | "red" | "yellow">("all");

  const tier1 = kpis.filter((k) => k.tier === "tier1");
  const tier2 = kpis.filter((k) => k.tier === "tier2");

  const filterKpis = (list: Kpi[]) =>
    filter === "all" ? list : list.filter((k) => k.health_status === filter);

  if (kpis.length === 0) {
    return (
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Scoreboard</h1>
        <EmptyState
          title="No KPIs yet"
          description="Create your first KPI to start tracking what matters."
          action={
            <Button onClick={() => (window.location.href = "/scoreboard/new")}>
              Add KPI
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Scoreboard</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface border border-line rounded-lg overflow-hidden">
            {(["all", "red", "yellow"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-accent text-white"
                    : "text-subtle hover:text-ink"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => (window.location.href = "/scoreboard/new")}
          >
            Add KPI
          </Button>
        </div>
      </div>

      {/* KPI Linkage Map */}
      <KpiLinkageMap
        kpis={kpis.map((k) => ({
          id: k.id,
          name: k.name,
          tier: k.tier,
          health_status: k.health_status,
          linked_driver_kpis: k.linked_driver_kpis ?? [],
        }))}
      />

      {filterKpis(tier1).length > 0 && (
        <section className="mb-8 mt-6">
          <h2 className="text-sm font-semibold text-subtle uppercase tracking-wider mb-3">
            Tier 1 — Lagging Indicators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterKpis(tier1).map((kpi) => (
              <KpiTile key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>
      )}

      {filterKpis(tier2).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-subtle uppercase tracking-wider mb-3">
            Tier 2 — Leading Indicators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterKpis(tier2).map((kpi) => (
              <KpiTile key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
