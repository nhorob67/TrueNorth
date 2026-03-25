"use client";

import { useState, useMemo } from "react";

// ============================================================
// KPI Linkage Map
//
// Interactive visualization showing lagging → leading KPI
// relationships. Click a lagging KPI to highlight its drivers.
// Renders as SVG with force-directed-like positioning.
//
// BUILDPLAN 3.6: "KPI Linkage Map visualization (interactive
// graph: click lagging → highlight drivers)"
// ============================================================

interface KpiNode {
  id: string;
  name: string;
  tier: string;
  health_status: "green" | "yellow" | "red";
  linked_driver_kpis: string[];
}

const healthColors: Record<string, string> = {
  green: "var(--color-semantic-green)",
  yellow: "var(--color-semantic-ochre)",
  red: "var(--color-semantic-brick)",
};

const PADDING = 40;
const NODE_R = 24;

export function KpiLinkageMap({ kpis }: { kpis: KpiNode[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Only show the map if there are actual linkages
  const hasLinks = kpis.some((k) => k.linked_driver_kpis?.length > 0);
  if (!hasLinks) return null;

  // Separate into tiers
  const lagging = kpis.filter((k) => k.tier === "tier1");
  const leading = kpis.filter((k) => k.tier === "tier2");

  // Build edges: lagging → leading (via linked_driver_kpis)
  const edges: Array<{ from: string; to: string }> = [];
  for (const kpi of lagging) {
    for (const driverId of kpi.linked_driver_kpis ?? []) {
      if (leading.some((l) => l.id === driverId)) {
        edges.push({ from: kpi.id, to: driverId });
      }
    }
  }

  if (edges.length === 0) return null;

  // Calculate positions
  const width = Math.max(400, Math.max(lagging.length, leading.length) * 120 + PADDING * 2);
  const height = 200;
  const laggingY = 50;
  const leadingY = 150;

  const getX = (index: number, count: number) => {
    if (count === 1) return width / 2;
    const usable = width - PADDING * 2;
    return PADDING + (index / (count - 1)) * usable;
  };

  const positions = new Map<string, { x: number; y: number }>();
  lagging.forEach((k, i) => positions.set(k.id, { x: getX(i, lagging.length), y: laggingY }));
  leading.forEach((k, i) => positions.set(k.id, { x: getX(i, leading.length), y: leadingY }));

  // Highlighted nodes/edges when a lagging KPI is selected
  const highlightedDrivers = new Set<string>();
  const highlightedEdges = new Set<string>();
  if (selectedId) {
    const kpi = lagging.find((k) => k.id === selectedId);
    if (kpi) {
      for (const driverId of kpi.linked_driver_kpis ?? []) {
        highlightedDrivers.add(driverId);
        highlightedEdges.add(`${kpi.id}-${driverId}`);
      }
    }
  }

  const allKpiMap = new Map(kpis.map((k) => [k.id, k]));

  return (
    <div className="border border-line rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-subtle uppercase">
          KPI Linkage Map
        </h3>
        {selectedId && (
          <button
            onClick={() => setSelectedId(null)}
            className="text-xs text-accent hover:text-accent"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2 text-[10px] text-subtle">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-line" /> Tier 1 (Lagging)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-line" /> Tier 2 (Leading)
        </span>
        <span>Click a lagging KPI to highlight its drivers</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: 220 }}
      >
        {/* Edges */}
        {edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;

          const isHighlighted = highlightedEdges.has(`${edge.from}-${edge.to}`);
          const dimmed = selectedId && !isHighlighted;

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y + NODE_R}
              x2={to.x}
              y2={to.y - NODE_R}
              stroke={
                isHighlighted
                  ? healthColors[allKpiMap.get(edge.to)?.health_status ?? "green"]
                  : "var(--color-chart-line)"
              }
              strokeWidth={isHighlighted ? 2.5 : 1}
              strokeOpacity={dimmed ? 0.15 : isHighlighted ? 1 : 0.5}
              strokeDasharray={isHighlighted ? undefined : "4 3"}
            />
          );
        })}

        {/* Lagging KPI nodes (circles) */}
        {lagging.map((kpi) => {
          const pos = positions.get(kpi.id);
          if (!pos) return null;
          const isSelected = kpi.id === selectedId;
          const dimmed = selectedId && !isSelected;

          return (
            <g
              key={kpi.id}
              onClick={() => setSelectedId(isSelected ? null : kpi.id)}
              className="cursor-pointer"
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={NODE_R}
                fill={healthColors[kpi.health_status]}
                fillOpacity={dimmed ? 0.2 : 1}
                stroke={isSelected ? "var(--color-ink)" : "none"}
                strokeWidth={isSelected ? 2 : 0}
              />
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={8}
                fontWeight={600}
              >
                {kpi.name.length > 6 ? kpi.name.slice(0, 5) + "…" : kpi.name}
              </text>
              <title>{kpi.name}</title>
            </g>
          );
        })}

        {/* Leading KPI nodes (rounded rects) */}
        {leading.map((kpi) => {
          const pos = positions.get(kpi.id);
          if (!pos) return null;
          const isHighlighted = highlightedDrivers.has(kpi.id);
          const dimmed = selectedId && !isHighlighted;

          return (
            <g key={kpi.id}>
              <rect
                x={pos.x - NODE_R}
                y={pos.y - NODE_R * 0.65}
                width={NODE_R * 2}
                height={NODE_R * 1.3}
                rx={6}
                fill={healthColors[kpi.health_status]}
                fillOpacity={dimmed ? 0.15 : 1}
                stroke={isHighlighted ? "var(--color-ink)" : "none"}
                strokeWidth={isHighlighted ? 2 : 0}
              />
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={8}
                fontWeight={500}
              >
                {kpi.name.length > 6 ? kpi.name.slice(0, 5) + "…" : kpi.name}
              </text>
              <title>{kpi.name}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
