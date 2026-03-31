"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/loading";
import { AddToTodoButton } from "@/components/add-to-todo-button";
import { KpiLinkageMap } from "@/components/kpi-linkage-map";
import { KPI_TEMPLATES } from "@/lib/kpi-templates";
import { KpiIconBadge } from "@/lib/kpi-icons";
import { MiniSparkline } from "@/components/ui/sparkline";

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
  directionality: "up_is_good" | "down_is_good" | "target_is_good";
  frequency: string;
  owner_id: string;
  icon: string | null;
  kpi_entries: KpiEntry[];
  linked_driver_kpis: string[];
}

interface DayOverDay {
  delta: number;
  pctChange: number | null; // null if previous was 0
  direction: "up" | "down" | "flat";
}

/**
 * Compute day-over-day change from kpi_entries.
 * Groups entries by calendar date (UTC), takes the latest entry per day,
 * then compares the two most recent days.
 */
function computeDayOverDay(entries: KpiEntry[]): DayOverDay | null {
  if (entries.length < 2) return null;

  // Group by UTC date, keep latest entry per day
  const byDay = new Map<string, { value: number; time: number }>();
  for (const e of entries) {
    const d = new Date(e.recorded_at);
    const dateKey = d.toISOString().slice(0, 10);
    const time = d.getTime();
    const existing = byDay.get(dateKey);
    if (!existing || time > existing.time) {
      byDay.set(dateKey, { value: e.value, time });
    }
  }

  // Sort days descending
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  if (days.length < 2) return null;

  const today = days[0][1].value;
  const yesterday = days[1][1].value;
  const delta = today - yesterday;

  return {
    delta,
    pctChange: yesterday !== 0 ? (delta / Math.abs(yesterday)) * 100 : null,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

function DayOverDayBadge({
  dod,
  directionality,
  unit,
}: {
  dod: DayOverDay;
  directionality: string;
  unit: string;
}) {
  if (dod.direction === "flat") return null;

  const isPositiveMovement = dod.direction === "up";
  const isGood =
    directionality === "up_is_good"
      ? isPositiveMovement
      : directionality === "down_is_good"
        ? !isPositiveMovement
        : null; // target_is_good — can't determine without more context

  const colorClass =
    isGood === true
      ? "text-semantic-green"
      : isGood === false
        ? "text-semantic-brick"
        : "text-subtle";

  const arrow = dod.direction === "up" ? "↑" : "↓";
  const absVal = Math.abs(dod.delta);
  const formatted =
    unit === "$" || unit === "USD"
      ? `$${absVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : unit === "%"
        ? `${absVal.toFixed(1)}pp`
        : absVal.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const pct =
    dod.pctChange !== null
      ? ` (${Math.abs(dod.pctChange).toFixed(1)}%)`
      : "";

  return (
    <span className={`text-xs font-mono ${colorClass}`}>
      {arrow} {formatted}{pct}
    </span>
  );
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

  return (
    <MiniSparkline data={values} width={80} height={24} color="currentColor" className="inline-block text-subtle" />
  );
}

function KpiTile({ kpi, linked = true }: { kpi: Kpi; linked?: boolean }) {
  const dod = computeDayOverDay(kpi.kpi_entries);

  const card = (
    <Card borderColor={healthColors[kpi.health_status]} className={linked ? "hover:border-accent/30 transition-colors" : ""}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KpiIconBadge iconKey={kpi.icon} healthStatus={kpi.health_status} />
              <p className="text-sm font-medium text-ink">{kpi.name}</p>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold">
                {kpi.current_value ?? "—"}
              </span>
              {kpi.unit && (
                <span className="text-xs text-subtle">{kpi.unit}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {kpi.target !== null && (
                <p className="text-xs text-subtle">
                  Target: {kpi.target} {kpi.unit}
                </p>
              )}
              {dod && (
                <DayOverDayBadge
                  dod={dod}
                  directionality={kpi.directionality ?? "up_is_good"}
                  unit={kpi.unit}
                />
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
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

  if (!linked) return card;

  return (
    <Link href={`/strategy/scoreboard/${kpi.id}`}>
      {card}
    </Link>
  );
}

function SortableKpiTile({ kpi, reordering }: { kpi: Kpi; reordering: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: kpi.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(reordering ? listeners : {})}>
      <div className={reordering ? "cursor-grab active:cursor-grabbing" : ""}>
        {reordering && (
          <div className="flex items-center gap-1 mb-1 text-subtle">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
            <span className="text-[10px] font-mono uppercase tracking-wider">Drag to reorder</span>
          </div>
        )}
        <KpiTile kpi={kpi} linked={!reordering} />
      </div>
    </div>
  );
}

export function ScoreboardView({ kpis: initialKpis }: { kpis: Kpi[] }) {
  const [filter, setFilter] = useState<"all" | "red" | "yellow">("all");
  const [seeding, setSeeding] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kpis, setKpis] = useState(initialKpis);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setKpis((prev) => {
      const oldIndex = prev.findIndex((k) => k.id === active.id);
      const newIndex = prev.findIndex((k) => k.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);
      return updated;
    });
  }

  async function saveOrder() {
    setSaving(true);
    try {
      const res = await fetch("/api/kpi/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: kpis.map((k) => k.id) }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to save order: ${data.error}`);
        return;
      }
      setReordering(false);
      router.refresh();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function cancelReorder() {
    setKpis(initialKpis);
    setReordering(false);
  }

  async function handleSeedDefaults() {
    setSeeding(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("Not authenticated.");
        return;
      }

      const { data: membership } = await supabase
        .from("organization_memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) {
        alert("No organization found.");
        return;
      }

      const { data: venture } = await supabase
        .from("ventures")
        .select("id")
        .eq("organization_id", membership.organization_id)
        .limit(1)
        .single();

      if (!venture) {
        alert("No venture found.");
        return;
      }

      // Check which template slugs already exist
      const { data: existing } = await supabase
        .from("kpis")
        .select("template_slug")
        .eq("venture_id", venture.id)
        .not("template_slug", "is", null);

      const existingSlugs = new Set(
        (existing ?? []).map((k: { template_slug: string }) => k.template_slug)
      );

      const toCreate = KPI_TEMPLATES.filter(
        (t) => !existingSlugs.has(t.template_slug)
      );

      if (toCreate.length === 0) {
        alert("All default KPIs already exist.");
        return;
      }

      // Insert new KPIs
      const rows = toCreate.map((t) => ({
        organization_id: membership.organization_id,
        venture_id: venture.id,
        owner_id: user.id,
        name: t.name,
        description: t.description,
        unit: t.unit,
        frequency: t.frequency,
        tier: t.tier,
        directionality: t.directionality,
        formula_description: t.formula_description,
        template_slug: t.template_slug,
        health_status: "green",
        lifecycle_status: "active",
        threshold_logic: {},
        action_playbook: {},
      }));

      const { error: insertError } = await supabase.from("kpis").insert(rows);
      if (insertError) {
        alert(`Error: ${insertError.message}`);
        return;
      }

      // Wire driver links via kpi_driver_links junction table
      const templatesWithLinks = toCreate.filter(
        (t) => t.linked_template_slugs && t.linked_template_slugs.length > 0
      );

      if (templatesWithLinks.length > 0) {
        const { data: seeded } = await supabase
          .from("kpis")
          .select("id, template_slug")
          .eq("venture_id", venture.id)
          .not("template_slug", "is", null);

        const slugToId = new Map(
          (seeded ?? []).map((k: { id: string; template_slug: string }) => [
            k.template_slug,
            k.id,
          ])
        );

        for (const t of templatesWithLinks) {
          const kpiId = slugToId.get(t.template_slug);
          if (!kpiId) continue;

          const links = (t.linked_template_slugs ?? [])
            .map((slug) => slugToId.get(slug))
            .filter(Boolean)
            .map((driverId) => ({ kpi_id: kpiId, driver_kpi_id: driverId }));

          if (links.length > 0) {
            await supabase.from("kpi_driver_links").insert(links);
          }
        }
      }

      alert(`Created ${toCreate.length} default KPIs.`);
      router.refresh();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSeeding(false);
    }
  }

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
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleSeedDefaults}
                disabled={seeding}
              >
                {seeding ? "Seeding..." : "Seed Default KPIs"}
              </Button>
              <Button onClick={() => (window.location.href = "/strategy/scoreboard/new")}>
                Add KPI
              </Button>
            </div>
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
          {reordering ? (
            <>
              <Button size="sm" variant="secondary" onClick={cancelReorder}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveOrder} disabled={saving}>
                {saving ? "Saving..." : "Save Order"}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setReordering(true)}
              >
                Reorder
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSeedDefaults}
                disabled={seeding}
              >
                {seeding ? "Seeding..." : "Seed Default KPIs"}
              </Button>
              <Button
                size="sm"
                onClick={() => (window.location.href = "/strategy/scoreboard/new")}
              >
                Add KPI
              </Button>
            </>
          )}
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

      {reordering ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <section className="mb-8 mt-6">
            <h2 className="text-sm font-semibold text-subtle uppercase tracking-wider mb-3">
              All KPIs — Drag to Reorder
            </h2>
            <SortableContext items={kpis.map((k) => k.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {kpis.map((kpi) => (
                  <SortableKpiTile key={kpi.id} kpi={kpi} reordering />
                ))}
              </div>
            </SortableContext>
          </section>
        </DndContext>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
