"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================
// Types
// ============================================================

interface Bet {
  id: string;
  outcome: string;
  mechanism: string | null;
  health_status: string;
  lifecycle_status: string;
  created_at: string;
  killed_at: string | null;
  kill_reason: string | null;
}

interface ShippedMove {
  id: string;
  title: string;
  type: string;
  lifecycle_status: string;
  updated_at: string;
  bet_id: string;
}

interface Kpi {
  id: string;
  name: string;
  health_status: string;
  current_value: number | null;
  target: number | null;
  unit: string | null;
}

interface Decision {
  id: string;
  title: string;
  final_decision: string | null;
  decided_at: string;
}

interface Commitment {
  id: string;
  description: string;
  status: string;
  due_date: string;
}

// ============================================================
// Timeline Entry
// ============================================================

type TimelineEntryType = "bet" | "move" | "kpi" | "decision" | "commitment";

interface TimelineEntry {
  id: string;
  date: string;
  type: TimelineEntryType;
  title: string;
  description: string;
}

const typeColors: Record<TimelineEntryType, string> = {
  bet: "bg-accent border-accent",
  move: "bg-cta border-accent",
  kpi: "bg-brass border-brass",
  decision: "bg-sage border-sage",
  commitment: "bg-faded border-faded",
};

const typeLabels: Record<TimelineEntryType, string> = {
  bet: "Bet",
  move: "Move Shipped",
  kpi: "KPI",
  decision: "Decision",
  commitment: "Commitment",
};

const typeBgColors: Record<TimelineEntryType, string> = {
  bet: "bg-accent/10 text-accent",
  move: "bg-accent-dim text-accent",
  kpi: "bg-brass/10 text-brass-text",
  decision: "bg-sage/10 text-sage-text",
  commitment: "bg-faded/10 text-subtle",
};

// ============================================================
// Timeline Entry Component
// ============================================================

function TimelineItem({
  entry,
  isLast,
}: {
  entry: TimelineEntry;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${typeColors[entry.type]}`}
        />
        {!isLast && <div className="w-0.5 flex-1 bg-line min-h-[40px]" />}
      </div>

      {/* Content */}
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-subtle">
            {new Date(entry.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeBgColors[entry.type]}`}
          >
            {typeLabels[entry.type]}
          </span>
        </div>
        <h3 className="text-sm font-medium text-ink">{entry.title}</h3>
        {entry.description && (
          <p className="text-xs text-subtle mt-0.5">{entry.description}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function RetrospectiveView({
  quarterLabel,
  bets,
  shippedMoves,
  kpis,
  decisions,
  commitments,
}: {
  quarterLabel: string;
  bets: Bet[];
  shippedMoves: ShippedMove[];
  kpis: Kpi[];
  decisions: Decision[];
  commitments: Commitment[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<TimelineEntryType | "all">("all");

  // Build timeline entries
  const entries: TimelineEntry[] = [];

  // Bets
  for (const bet of bets) {
    entries.push({
      id: `bet-${bet.id}`,
      date: bet.created_at,
      type: "bet",
      title: bet.outcome,
      description: bet.killed_at
        ? `Killed: ${bet.kill_reason ?? "No reason"}`
        : bet.mechanism ?? "",
    });
  }

  // Shipped moves
  for (const move of shippedMoves) {
    entries.push({
      id: `move-${move.id}`,
      date: move.updated_at,
      type: "move",
      title: move.title,
      description: move.type === "recurring" ? "Recurring rhythm" : "Milestone shipped",
    });
  }

  // Decisions
  for (const decision of decisions) {
    entries.push({
      id: `decision-${decision.id}`,
      date: decision.decided_at,
      type: "decision",
      title: decision.title,
      description: decision.final_decision ?? "",
    });
  }

  // Commitments completed
  for (const commitment of commitments) {
    entries.push({
      id: `commitment-${commitment.id}`,
      date: commitment.due_date,
      type: "commitment",
      title: commitment.description,
      description: "Completed",
    });
  }

  // Sort chronologically
  entries.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Apply filter
  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.type === filter);

  // Summary stats
  const greenKpis = kpis.filter((k) => k.health_status === "green").length;
  const yellowKpis = kpis.filter((k) => k.health_status === "yellow").length;
  const redKpis = kpis.filter((k) => k.health_status === "red").length;

  const filterOptions: Array<{ key: TimelineEntryType | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "bet", label: "Bets" },
    { key: "move", label: "Moves" },
    { key: "decision", label: "Decisions" },
    { key: "commitment", label: "Commitments" },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <Button
        variant="tertiary"
        size="sm"
        onClick={() => router.push("/bets")}
        className="mb-4"
      >
        Back to War Room
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Quarterly Retrospective</h1>
          <p className="text-sm text-subtle mt-0.5">{quarterLabel}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            // Copy current URL to clipboard for sharing
            navigator.clipboard.writeText(window.location.href);
          }}
        >
          Copy Link
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-accent">{bets.length}</p>
            <p className="text-xs text-subtle">Bets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-accent">
              {shippedMoves.length}
            </p>
            <p className="text-xs text-subtle">Moves Shipped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-brass-text">
              {decisions.length}
            </p>
            <p className="text-xs text-subtle">Decisions Made</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1.5">
              {greenKpis > 0 && (
                <span className="text-sm font-mono text-semantic-green-text">
                  {greenKpis}G
                </span>
              )}
              {yellowKpis > 0 && (
                <span className="text-sm font-mono text-semantic-ochre-text">
                  {yellowKpis}Y
                </span>
              )}
              {redKpis > 0 && (
                <span className="text-sm font-mono text-semantic-brick">
                  {redKpis}R
                </span>
              )}
            </div>
            <p className="text-xs text-subtle">KPI Health</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface border border-line rounded-lg p-1 mb-6">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === opt.key
                ? "bg-accent text-white"
                : "text-subtle hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">
            Timeline ({filtered.length} events)
          </h2>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-subtle py-4 text-center">
              No events for this quarter yet.
            </p>
          ) : (
            <div className="py-2">
              {filtered.map((entry, i) => (
                <TimelineItem
                  key={entry.id}
                  entry={entry}
                  isLast={i === filtered.length - 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
