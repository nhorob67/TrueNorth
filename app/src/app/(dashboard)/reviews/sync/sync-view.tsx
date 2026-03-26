"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MeetingLog } from "@/types/database";

// ============================================================
// Types
// ============================================================

interface Kpi {
  id: string;
  name: string;
  health_status: "green" | "yellow" | "red";
  current_value: number | null;
  target: number | null;
  unit: string | null;
  owner_id: string;
  action_playbook: {
    if_yellow?: string;
    if_red?: string;
  } | null;
}

interface MoveInBet {
  id: string;
  title: string;
  lifecycle_status: string;
  health_status: string;
  type: string;
  cadence: string | null;
  target_per_cycle: number | null;
  owner_id: string;
}

interface Bet {
  id: string;
  outcome: string;
  health_status: "green" | "yellow" | "red";
  owner_id: string;
  moves: MoveInBet[];
}

interface Blocker {
  id: string;
  description: string;
  severity: string;
  owner_id: string;
  resolution_state: string;
  created_at: string;
  linked_entity_id: string | null;
  linked_entity_type: string | null;
}

interface Decision {
  id: string;
  title: string;
  context: string | null;
  owner_id: string;
  created_at: string;
}

interface Issue {
  id: string;
  description: string;
  severity: string;
  owner_id: string;
  status: string;
  created_at: string;
}

interface Commitment {
  id: string;
  description: string;
  owner_id: string;
  due_date: string | null;
  status: string;
  created_at: string;
}

interface TeamMember {
  user_id: string;
  role: string;
  full_name: string;
}

type Segment = "scoreboard" | "focus" | "blockers" | "commitments";

const SEGMENT_CONFIG: Array<{
  key: Segment;
  label: string;
  duration: number;
  description: string;
}> = [
  {
    key: "scoreboard",
    label: "Scoreboard Review",
    duration: 10,
    description: "Review red and yellow KPIs. Green collapsed to summary.",
  },
  {
    key: "focus",
    label: "Focus Check",
    duration: 5,
    description: "Each team member's current bet assignment and active Moves.",
  },
  {
    key: "blockers",
    label: "Blockers & Decisions",
    duration: 10,
    description: "Unresolved blockers, open decisions, and issues to triage.",
  },
  {
    key: "commitments",
    label: "Commitments",
    duration: 5,
    description: "Review last week's commitments. Each person enters their commitment for next week.",
  },
];

const TOTAL_MINUTES = 30;

// ============================================================
// Countdown Timer
// ============================================================

function CountdownTimer({
  running,
  onToggle,
  secondsRemaining,
}: {
  running: boolean;
  onToggle: () => void;
  secondsRemaining: number;
}) {
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const pct = (secondsRemaining / (TOTAL_MINUTES * 60)) * 100;

  const isWarning = secondsRemaining <= 300 && secondsRemaining > 60;
  const isCritical = secondsRemaining <= 60;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggle}
        className="w-8 h-8 rounded-full border border-line flex items-center justify-center hover:bg-canvas transition-colors"
      >
        {running ? (
          <svg className="w-4 h-4 text-ink" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-ink" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span
            className={`text-2xl font-mono font-bold ${
              isCritical
                ? "text-semantic-brick"
                : isWarning
                  ? "text-semantic-ochre-text"
                  : "text-ink"
            }`}
          >
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
          <span className="text-xs text-subtle">
            {TOTAL_MINUTES} min meeting
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-line overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isCritical
                ? "bg-semantic-brick"
                : isWarning
                  ? "bg-semantic-ochre"
                  : "bg-accent"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Segment Navigation
// ============================================================

function SegmentNav({
  activeSegment,
  onSelect,
  segmentTimeUsed,
}: {
  activeSegment: Segment;
  onSelect: (s: Segment) => void;
  segmentTimeUsed: Record<Segment, number>;
}) {
  return (
    <div className="flex gap-1 mb-6">
      {SEGMENT_CONFIG.map((seg) => {
        const isActive = activeSegment === seg.key;
        const timeUsed = segmentTimeUsed[seg.key] ?? 0;
        const overTime = timeUsed > seg.duration * 60;

        return (
          <button
            key={seg.key}
            onClick={() => onSelect(seg.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              isActive
                ? "bg-accent text-white border-accent"
                : "text-subtle hover:text-ink border-line"
            }`}
          >
            <div>{seg.label}</div>
            <div className={`text-xs mt-0.5 ${isActive ? "text-white/70" : overTime ? "text-semantic-brick" : "text-subtle"}`}>
              {seg.duration} min
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Scoreboard Review Segment
// ============================================================

function ScoreboardSegment({ kpis }: { kpis: Kpi[] }) {
  const redKpis = kpis.filter((k) => k.health_status === "red");
  const yellowKpis = kpis.filter((k) => k.health_status === "yellow");

  return (
    <div className="space-y-4">
      <p className="text-xs text-subtle">
        {SEGMENT_CONFIG[0].description}
      </p>

      {kpis.length === 0 && (
        <div className="text-sm text-semantic-green-text font-medium py-4 text-center">
          All KPIs are green. No items to review.
        </div>
      )}

      {redKpis.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] font-semibold text-semantic-brick uppercase tracking-[0.10em] mb-2">
            Red — Needs Action ({redKpis.length})
          </h3>
          <div className="space-y-2">
            {redKpis.map((kpi) => (
              <Card key={kpi.id} borderColor="var(--color-semantic-brick)">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {kpi.name}
                      </p>
                      <p className="text-xs text-subtle mt-0.5">
                        Current:{" "}
                        <span className="font-mono font-medium text-ink">
                          {kpi.current_value ?? "—"}
                        </span>
                        {kpi.target !== null && (
                          <>
                            {" "}
                            / Target:{" "}
                            <span className="font-mono">
                              {kpi.target}
                            </span>
                          </>
                        )}
                        {kpi.unit && ` ${kpi.unit}`}
                      </p>
                    </div>
                    <Badge status="red">RED</Badge>
                  </div>
                  {kpi.action_playbook?.if_red && (
                    <div className="mt-2 p-2 bg-semantic-brick/5 rounded text-xs text-ink">
                      <span className="font-semibold">Playbook:</span>{" "}
                      {kpi.action_playbook.if_red}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {yellowKpis.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] font-semibold text-semantic-ochre-text uppercase tracking-[0.10em] mb-2">
            Yellow — Monitor ({yellowKpis.length})
          </h3>
          <div className="space-y-2">
            {yellowKpis.map((kpi) => (
              <Card key={kpi.id} borderColor="var(--color-semantic-ochre)">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {kpi.name}
                      </p>
                      <p className="text-xs text-subtle mt-0.5">
                        Current:{" "}
                        <span className="font-mono font-medium text-ink">
                          {kpi.current_value ?? "—"}
                        </span>
                        {kpi.target !== null && (
                          <>
                            {" "}
                            / Target:{" "}
                            <span className="font-mono">{kpi.target}</span>
                          </>
                        )}
                        {kpi.unit && ` ${kpi.unit}`}
                      </p>
                    </div>
                    <Badge status="yellow">YELLOW</Badge>
                  </div>
                  {kpi.action_playbook?.if_yellow && (
                    <div className="mt-2 p-2 bg-semantic-ochre/5 rounded text-xs text-ink">
                      <span className="font-semibold">Playbook:</span>{" "}
                      {kpi.action_playbook.if_yellow}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Focus Check Segment
// ============================================================

function FocusSegment({
  bets,
  teamMembers,
}: {
  bets: Bet[];
  teamMembers: TeamMember[];
}) {
  // Build per-person move breakdown across all bets
  const movesByPerson = new Map<
    string,
    { name: string; moves: Array<MoveInBet & { betOutcome: string }> }
  >();

  for (const bet of bets) {
    for (const move of bet.moves) {
      if (move.lifecycle_status === "cut" || move.lifecycle_status === "shipped")
        continue;
      const person = movesByPerson.get(move.owner_id) ?? {
        name:
          teamMembers.find((m) => m.user_id === move.owner_id)?.full_name ??
          "Unassigned",
        moves: [],
      };
      person.moves.push({ ...move, betOutcome: bet.outcome });
      movesByPerson.set(move.owner_id, person);
    }
  }

  // Collect all recurring moves across bets for rhythm review
  const allRecurring: Array<MoveInBet & { betOutcome: string; ownerName: string }> = [];
  for (const bet of bets) {
    for (const move of bet.moves) {
      if (move.type === "recurring" && move.lifecycle_status !== "cut") {
        allRecurring.push({
          ...move,
          betOutcome: bet.outcome,
          ownerName:
            teamMembers.find((m) => m.user_id === move.owner_id)?.full_name ?? "",
        });
      }
    }
  }

  const healthDot: Record<string, string> = {
    green: "bg-semantic-green",
    yellow: "bg-semantic-ochre",
    red: "bg-semantic-brick",
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-subtle">
        {SEGMENT_CONFIG[1].description}
      </p>

      {bets.length === 0 && (
        <div className="text-sm text-subtle py-4 text-center">
          No active bets.
        </div>
      )}

      {/* Per-bet overview */}
      {bets.map((bet) => {
        const activeMoves = bet.moves.filter(
          (m) => m.lifecycle_status !== "cut" && m.lifecycle_status !== "shipped"
        );
        const redMoves = activeMoves.filter((m) => m.health_status === "red");
        const recurringMoves = activeMoves.filter((m) => m.type === "recurring");
        const greenPct =
          activeMoves.length > 0
            ? Math.round(
                (activeMoves.filter((m) => m.health_status === "green").length /
                  activeMoves.length) *
                  100
              )
            : 0;

        return (
          <Card key={bet.id}>
            <CardContent className="py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {bet.outcome}
                  </p>
                  <p className="text-xs text-subtle mt-0.5">
                    Owner:{" "}
                    {teamMembers.find((m) => m.user_id === bet.owner_id)
                      ?.full_name ?? "Unassigned"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-semibold ${
                      greenPct >= 80
                        ? "text-semantic-green-text"
                        : greenPct >= 50
                          ? "text-semantic-ochre"
                          : "text-semantic-brick"
                    }`}
                  >
                    {greenPct}% healthy
                  </span>
                  <Badge status={bet.health_status}>
                    {bet.health_status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Move summary */}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="text-subtle">
                  {activeMoves.length} active moves
                </span>
                {redMoves.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-semantic-brick/10 text-semantic-brick font-medium">
                    {redMoves.length} red
                  </span>
                )}
                {recurringMoves.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                    {recurringMoves.length} rhythms
                  </span>
                )}
              </div>

              {/* Red moves called out */}
              {redMoves.length > 0 && (
                <div className="mt-2 space-y-1">
                  {redMoves.map((move) => (
                    <div
                      key={move.id}
                      className="flex items-center gap-2 text-xs p-1.5 bg-semantic-brick/5 rounded"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-semantic-brick" />
                      <span className="text-ink">{move.title}</span>
                      <span className="text-subtle ml-auto">
                        {teamMembers.find((m) => m.user_id === move.owner_id)
                          ?.full_name ?? ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Per-person Move breakdown */}
      {movesByPerson.size > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-subtle uppercase mb-2">
            Moves by Person
          </h3>
          <div className="space-y-2">
            {Array.from(movesByPerson.entries()).map(([userId, person]) => {
              const red = person.moves.filter((m) => m.health_status === "red");
              const yellow = person.moves.filter(
                (m) => m.health_status === "yellow"
              );
              return (
                <Card key={userId}>
                  <CardContent className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">
                        {person.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-subtle">
                          {person.moves.length} active
                        </span>
                        {red.length > 0 && (
                          <span className="text-semantic-brick font-medium">
                            {red.length} red
                          </span>
                        )}
                        {yellow.length > 0 && (
                          <span className="text-semantic-ochre font-medium">
                            {yellow.length} yellow
                          </span>
                        )}
                      </div>
                    </div>
                    {(red.length > 0 || yellow.length > 0) && (
                      <div className="mt-1.5 space-y-0.5">
                        {[...red, ...yellow].map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${healthDot[m.health_status] ?? "bg-faded"}`}
                            />
                            <span className="text-ink truncate">
                              {m.title}
                            </span>
                            <span className="text-subtle ml-auto text-[10px] flex-shrink-0">
                              {m.betOutcome.slice(0, 25)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Rhythm Review (60-second overview) */}
      {allRecurring.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-subtle uppercase mb-2">
            Rhythm Review
          </h3>
          <Card>
            <CardContent className="py-3">
              <div className="space-y-1.5">
                {allRecurring
                  .sort((a, b) => {
                    const order: Record<string, number> = {
                      red: 0,
                      yellow: 1,
                      green: 2,
                    };
                    return (
                      (order[a.health_status] ?? 3) -
                      (order[b.health_status] ?? 3)
                    );
                  })
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${healthDot[m.health_status] ?? "bg-faded"}`}
                      />
                      <span className="text-ink truncate flex-1">
                        {m.title}
                      </span>
                      <span className="text-subtle text-[10px] flex-shrink-0">
                        {m.cadence ?? ""}
                        {m.target_per_cycle
                          ? ` · ${m.target_per_cycle}/cycle`
                          : ""}
                      </span>
                      <span className="text-subtle text-[10px] flex-shrink-0">
                        {m.ownerName.split(" ")[0]}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-line text-xs">
                <span className="text-subtle">
                  {allRecurring.length} rhythms total
                </span>
                {allRecurring.filter((m) => m.health_status === "red").length >
                  0 && (
                  <span className="text-semantic-brick font-medium">
                    {
                      allRecurring.filter((m) => m.health_status === "red")
                        .length
                    }{" "}
                    red
                  </span>
                )}
                {allRecurring.filter((m) => m.health_status === "yellow")
                  .length > 0 && (
                  <span className="text-semantic-ochre font-medium">
                    {
                      allRecurring.filter((m) => m.health_status === "yellow")
                        .length
                    }{" "}
                    yellow
                  </span>
                )}
                {allRecurring.filter((m) => m.health_status === "green")
                  .length > 0 && (
                  <span className="text-semantic-green-text font-medium">
                    {
                      allRecurring.filter((m) => m.health_status === "green")
                        .length
                    }{" "}
                    green
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Blockers & Decisions Segment
// ============================================================

const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function BlockersSegment({
  blockers,
  decisions,
  issues,
  teamMembers,
  onResolveBlocker,
  onDecide,
}: {
  blockers: Blocker[];
  decisions: Decision[];
  issues: Issue[];
  teamMembers: TeamMember[];
  onResolveBlocker: (id: string, notes: string) => void;
  onDecide: (id: string, finalDecision: string) => void;
}) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionText, setDecisionText] = useState("");

  const sortedBlockers = [...blockers].sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
  );

  const daysSince = (dateStr: string) => {
    const days = Math.floor(
      // eslint-disable-next-line react-hooks/purity
      (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">
        {SEGMENT_CONFIG[2].description}
      </p>

      {/* Blockers */}
      <div>
        <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
          Open Blockers ({sortedBlockers.length})
        </h3>
        {sortedBlockers.length === 0 ? (
          <p className="text-sm text-semantic-green-text py-2">No open blockers.</p>
        ) : (
          <div className="space-y-2">
            {sortedBlockers.map((blocker) => (
              <Card
                key={blocker.id}
                borderColor="var(--color-semantic-brick)"
              >
                <CardContent className="py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-ink">
                        {blocker.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-subtle">
                        <span>
                          {teamMembers.find(
                            (m) => m.user_id === blocker.owner_id
                          )?.full_name ?? "Unassigned"}
                        </span>
                        <span>·</span>
                        <span>{daysSince(blocker.created_at)}d old</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        status={
                          blocker.severity === "critical" ||
                          blocker.severity === "high"
                            ? "red"
                            : blocker.severity === "medium"
                              ? "yellow"
                              : "neutral"
                        }
                      >
                        {blocker.severity}
                      </Badge>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onClick={() =>
                          setResolvingId(
                            resolvingId === blocker.id ? null : blocker.id
                          )
                        }
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                  {resolvingId === blocker.id && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={resolveNotes}
                        onChange={(e) => setResolveNotes(e.target.value)}
                        placeholder="Resolution notes..."
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        disabled={!resolveNotes.trim()}
                        onClick={() => {
                          onResolveBlocker(blocker.id, resolveNotes.trim());
                          setResolvingId(null);
                          setResolveNotes("");
                        }}
                      >
                        Done
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Decisions */}
      <div>
        <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
          Open Decisions ({decisions.length})
        </h3>
        {decisions.length === 0 ? (
          <p className="text-sm text-subtle py-2">No open decisions.</p>
        ) : (
          <div className="space-y-2">
            {decisions.map((decision) => (
              <Card key={decision.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {decision.title}
                      </p>
                      {decision.context && (
                        <p className="text-xs text-subtle mt-0.5">
                          {decision.context}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() =>
                        setDecidingId(
                          decidingId === decision.id ? null : decision.id
                        )
                      }
                    >
                      Decide
                    </Button>
                  </div>
                  {decidingId === decision.id && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={decisionText}
                        onChange={(e) => setDecisionText(e.target.value)}
                        placeholder="What was decided?"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        disabled={!decisionText.trim()}
                        onClick={() => {
                          onDecide(decision.id, decisionText.trim());
                          setDecidingId(null);
                          setDecisionText("");
                        }}
                      >
                        Record
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
            Open Issues ({issues.length})
          </h3>
          <div className="space-y-2">
            {issues.map((issue) => (
              <Card key={issue.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-ink">{issue.description}</p>
                    <Badge
                      status={
                        issue.severity === "critical" ||
                        issue.severity === "high"
                          ? "red"
                          : issue.severity === "medium"
                            ? "yellow"
                            : "neutral"
                      }
                    >
                      {issue.severity}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Commitments Segment
// ============================================================

function CommitmentsSegment({
  lastWeekCommitments,
  teamMembers,
  bets,
  onUpdateCommitmentStatus,
  onCreateCommitment,
}: {
  lastWeekCommitments: Commitment[];
  teamMembers: TeamMember[];
  bets: Bet[];
  onUpdateCommitmentStatus: (id: string, status: string) => void;
  onCreateCommitment: (
    description: string,
    ownerId: string,
    linkedMoveId?: string
  ) => void;
}) {
  const [newDescription, setNewDescription] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [linkedMoveId, setLinkedMoveId] = useState("");

  // Build flat list of open moves grouped by bet for the selector
  const openMoves = bets.flatMap((bet) =>
    bet.moves
      .filter(
        (m) =>
          m.lifecycle_status === "in_progress" ||
          m.lifecycle_status === "not_started"
      )
      .map((m) => ({ ...m, betOutcome: bet.outcome }))
  );

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">
        {SEGMENT_CONFIG[3].description}
      </p>

      {/* Last week review */}
      <div>
        <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
          Last Week&apos;s Commitments ({lastWeekCommitments.length})
        </h3>
        {lastWeekCommitments.length === 0 ? (
          <p className="text-sm text-subtle py-2">
            No commitments from last week.
          </p>
        ) : (
          <div className="space-y-2">
            {lastWeekCommitments.map((commitment) => (
              <Card key={commitment.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={`text-sm ${
                          commitment.status === "completed"
                            ? "line-through text-subtle"
                            : ""
                        }`}
                      >
                        {commitment.description}
                      </p>
                      <p className="text-xs text-subtle mt-0.5">
                        {teamMembers.find(
                          (m) => m.user_id === commitment.owner_id
                        )?.full_name ?? "Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {commitment.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              onUpdateCommitmentStatus(
                                commitment.id,
                                "completed"
                              )
                            }
                            className="text-xs px-2 py-1 rounded bg-semantic-green/10 text-semantic-green-text hover:bg-semantic-green/20"
                          >
                            Done
                          </button>
                          <button
                            onClick={() =>
                              onUpdateCommitmentStatus(
                                commitment.id,
                                "missed"
                              )
                            }
                            className="text-xs px-2 py-1 rounded bg-semantic-brick/10 text-semantic-brick hover:bg-semantic-brick/20"
                          >
                            Missed
                          </button>
                        </>
                      )}
                      {commitment.status !== "pending" && (
                        <Badge
                          status={
                            commitment.status === "completed"
                              ? "green"
                              : commitment.status === "missed"
                                ? "red"
                                : "neutral"
                          }
                        >
                          {commitment.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New commitments */}
      <div>
        <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
          This Week&apos;s Commitments
        </h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What is your most important commitment this week?"
              className="flex-1"
            />
            <select
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className="text-sm border border-line rounded-lg px-2 py-2 bg-surface w-40"
            >
              <option value="">Owner</option>
              {teamMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!newDescription.trim() || !newOwnerId}
              onClick={() => {
                onCreateCommitment(
                  newDescription.trim(),
                  newOwnerId,
                  linkedMoveId || undefined
                );
                setNewDescription("");
                setNewOwnerId("");
                setLinkedMoveId("");
              }}
            >
              Add
            </Button>
          </div>
          {openMoves.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-subtle whitespace-nowrap">
                Link to Move:
              </span>
              <select
                value={linkedMoveId}
                onChange={(e) => {
                  setLinkedMoveId(e.target.value);
                  if (e.target.value) {
                    const move = openMoves.find(
                      (m) => m.id === e.target.value
                    );
                    if (move && !newDescription.trim()) {
                      setNewDescription(`Ship: ${move.title}`);
                    }
                  }
                }}
                className="text-xs border border-line rounded-lg px-2 py-1.5 bg-surface flex-1"
              >
                <option value="">None (optional)</option>
                {bets.map((bet) => {
                  const betMoves = openMoves.filter(
                    (m) => m.betOutcome === bet.outcome
                  );
                  if (betMoves.length === 0) return null;
                  return (
                    <optgroup key={bet.id} label={bet.outcome}>
                      {betMoves.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Meeting Summary
// ============================================================

interface MeetingOutput {
  resolvedBlockers: string[];
  recordedDecisions: string[];
  newCommitments: string[];
  reviewedCommitments: Array<{ id: string; status: string }>;
}

function MeetingSummary({ output }: { output: MeetingOutput }) {
  const total =
    output.resolvedBlockers.length +
    output.recordedDecisions.length +
    output.newCommitments.length +
    output.reviewedCommitments.length;

  if (total === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="bg-accent/5">
        <h2 className="text-sm font-semibold text-accent">Meeting Output</h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {output.resolvedBlockers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-subtle uppercase mb-1">
                Blockers Resolved
              </p>
              <p className="font-mono text-lg text-semantic-green-text">
                {output.resolvedBlockers.length}
              </p>
            </div>
          )}
          {output.recordedDecisions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-subtle uppercase mb-1">
                Decisions Made
              </p>
              <p className="font-mono text-lg text-ink">
                {output.recordedDecisions.length}
              </p>
            </div>
          )}
          {output.newCommitments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-subtle uppercase mb-1">
                New Commitments
              </p>
              <p className="font-mono text-lg text-ink">
                {output.newCommitments.length}
              </p>
            </div>
          )}
          {output.reviewedCommitments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-subtle uppercase mb-1">
                Commitments Reviewed
              </p>
              <p className="font-mono text-lg text-ink">
                {output.reviewedCommitments.length}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Weekly Sync View
// ============================================================

export function WeeklySyncView({
  kpis,
  bets,
  blockers,
  decisions,
  issues,
  lastWeekCommitments,
  teamMembers,
}: {
  kpis: Kpi[];
  bets: Bet[];
  blockers: Blocker[];
  decisions: Decision[];
  issues: Issue[];
  lastWeekCommitments: Commitment[];
  teamMembers: TeamMember[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();

  const [activeSegment, setActiveSegment] = useState<Segment>("scoreboard");
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_MINUTES * 60);
  const [segmentTimeUsed, setSegmentTimeUsed] = useState<Record<Segment, number>>({
    scoreboard: 0,
    focus: 0,
    blockers: 0,
    commitments: 0,
  });
  const [meetingOutput, setMeetingOutput] = useState<MeetingOutput>({
    resolvedBlockers: [],
    recordedDecisions: [],
    newCommitments: [],
    reviewedCommitments: [],
  });

  const [meetingSaved, setMeetingSaved] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [meetingHistory, setMeetingHistory] = useState<MeetingLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const meetingStartedAtRef = useRef<string | null>(null);
  // eslint-disable-next-line react-hooks/purity
  const lastTickRef = useRef<number>(Date.now());

  // Timer tick
  useEffect(() => {
    if (!timerRunning) return;
    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      setSecondsRemaining((prev) => Math.max(0, prev - elapsed));
      setSegmentTimeUsed((prev) => ({
        ...prev,
        [activeSegment]: (prev[activeSegment] ?? 0) + elapsed,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, activeSegment]);

  // Auto-advance suggestion (visual only, not forced)
  const currentConfig = SEGMENT_CONFIG.find((s) => s.key === activeSegment);
  const segmentTimeLimit = (currentConfig?.duration ?? 10) * 60;
  const isOverTime = (segmentTimeUsed[activeSegment] ?? 0) > segmentTimeLimit;

  const handleResolveBlocker = useCallback(
    async (blockerId: string, notes: string) => {
      await supabase
        .from("blockers")
        .update({
          resolution_state: "resolved",
          resolved_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq("id", blockerId);

      setMeetingOutput((prev) => ({
        ...prev,
        resolvedBlockers: [...prev.resolvedBlockers, blockerId],
      }));
      router.refresh();
    },
    [supabase, router]
  );

  const handleDecide = useCallback(
    async (decisionId: string, finalDecision: string) => {
      await supabase
        .from("decisions")
        .update({
          final_decision: finalDecision,
          decided_at: new Date().toISOString(),
        })
        .eq("id", decisionId);

      setMeetingOutput((prev) => ({
        ...prev,
        recordedDecisions: [...prev.recordedDecisions, decisionId],
      }));
      router.refresh();
    },
    [supabase, router]
  );

  const handleUpdateCommitmentStatus = useCallback(
    async (commitmentId: string, status: string) => {
      await supabase
        .from("commitments")
        .update({ status })
        .eq("id", commitmentId);

      setMeetingOutput((prev) => ({
        ...prev,
        reviewedCommitments: [
          ...prev.reviewedCommitments,
          { id: commitmentId, status },
        ],
      }));
      router.refresh();
    },
    [supabase, router]
  );

  const handleCreateCommitment = useCallback(
    async (description: string, ownerId: string, linkedMoveId?: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) return;

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const insertData: Record<string, unknown> = {
        organization_id: membership.organization_id,
        description,
        owner_id: ownerId,
        due_date: nextWeek.toISOString().split("T")[0],
        created_in: "weekly_sync",
      };

      if (linkedMoveId) {
        insertData.linked_entity_id = linkedMoveId;
        insertData.linked_entity_type = "move";
      }

      await supabase.from("commitments").insert(insertData);

      setMeetingOutput((prev) => ({
        ...prev,
        newCommitments: [...prev.newCommitments, description],
      }));
      router.refresh();
    },
    [supabase, router]
  );

  // Record the start time when meeting timer is first started
  const handleToggleTimer = useCallback(() => {
    if (!timerRunning && !meetingStartedAtRef.current) {
      meetingStartedAtRef.current = new Date().toISOString();
    }
    setTimerRunning(!timerRunning);
  }, [timerRunning]);

  // Save meeting to meeting_logs
  const handleSaveMeeting = useCallback(async () => {
    if (!meetingStartedAtRef.current) return;
    setSavingMeeting(true);

    const now = new Date();
    const startedAt = new Date(meetingStartedAtRef.current);
    const durationSeconds = Math.round(
      (now.getTime() - startedAt.getTime()) / 1000
    );

    await supabase.from("meeting_logs").insert({
      organization_id: userCtx.orgId,
      venture_id: userCtx.ventureId || null,
      meeting_type: "weekly_sync",
      started_at: meetingStartedAtRef.current,
      completed_at: now.toISOString(),
      duration_seconds: durationSeconds,
      output: {
        resolvedBlockerIds: meetingOutput.resolvedBlockers,
        recordedDecisionIds: meetingOutput.recordedDecisions,
        newCommitmentIds: meetingOutput.newCommitments,
        reviewedCommitments: meetingOutput.reviewedCommitments,
        resolvedBlockersCount: meetingOutput.resolvedBlockers.length,
        recordedDecisionsCount: meetingOutput.recordedDecisions.length,
        newCommitmentsCount: meetingOutput.newCommitments.length,
        reviewedCommitmentsCount: meetingOutput.reviewedCommitments.length,
      },
      facilitator_id: userCtx.userId,
    });

    setSavingMeeting(false);
    setMeetingSaved(true);
    setTimerRunning(false);
  }, [supabase, userCtx, meetingOutput, setTimerRunning]);

  // Fetch meeting history
  const fetchMeetingHistory = useCallback(async () => {
    const { data } = await supabase
      .from("meeting_logs")
      .select("*")
      .eq("organization_id", userCtx.orgId)
      .order("started_at", { ascending: false })
      .limit(10);

    setMeetingHistory((data ?? []) as MeetingLog[]);
  }, [supabase, userCtx.orgId]);

  // Load history when toggled
  useEffect(() => {
    if (showHistory) {
      fetchMeetingHistory();
    }
  }, [showHistory, fetchMeetingHistory]);

  function advanceSegment() {
    const idx = SEGMENT_CONFIG.findIndex((s) => s.key === activeSegment);
    if (idx < SEGMENT_CONFIG.length - 1) {
      setActiveSegment(SEGMENT_CONFIG[idx + 1].key);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Weekly Sync</h1>
          <p className="text-sm text-subtle mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Timer */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <CountdownTimer
            running={timerRunning}
            onToggle={handleToggleTimer}
            secondsRemaining={secondsRemaining}
          />
        </CardContent>
      </Card>

      {/* Segment navigation */}
      <SegmentNav
        activeSegment={activeSegment}
        onSelect={setActiveSegment}
        segmentTimeUsed={segmentTimeUsed}
      />

      {/* Over-time warning */}
      {isOverTime && timerRunning && (
        <div className="mb-4 p-2 bg-semantic-ochre/10 border border-semantic-ochre/20 rounded-lg text-xs text-semantic-ochre-text text-center">
          Over time for this segment.{" "}
          <button
            onClick={advanceSegment}
            className="font-semibold underline"
          >
            Move to next
          </button>
        </div>
      )}

      {/* Active segment content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              {currentConfig?.label}
            </h2>
            <Button variant="tertiary" size="sm" onClick={advanceSegment}>
              Next Segment →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeSegment === "scoreboard" && (
            <ScoreboardSegment kpis={kpis} />
          )}
          {activeSegment === "focus" && (
            <FocusSegment bets={bets} teamMembers={teamMembers} />
          )}
          {activeSegment === "blockers" && (
            <BlockersSegment
              blockers={blockers}
              decisions={decisions}
              issues={issues}
              teamMembers={teamMembers}
              onResolveBlocker={handleResolveBlocker}
              onDecide={handleDecide}
            />
          )}
          {activeSegment === "commitments" && (
            <CommitmentsSegment
              lastWeekCommitments={lastWeekCommitments}
              teamMembers={teamMembers}
              bets={bets}
              onUpdateCommitmentStatus={handleUpdateCommitmentStatus}
              onCreateCommitment={handleCreateCommitment}
            />
          )}
        </CardContent>
      </Card>

      {/* Meeting output summary */}
      <MeetingSummary output={meetingOutput} />

      {/* Save meeting + end meeting */}
      {meetingStartedAtRef.current && !meetingSaved && (
        <div className="mt-4 flex justify-center gap-3">
          <Button
            variant="primary"
            onClick={handleSaveMeeting}
            disabled={savingMeeting}
          >
            {savingMeeting ? "Saving..." : "End & Save Meeting"}
          </Button>
        </div>
      )}

      {meetingSaved && (
        <div className="mt-4 p-3 bg-semantic-green/10 border border-semantic-green/20 rounded-lg text-center text-sm text-semantic-green-text font-medium">
          Meeting saved successfully.
        </div>
      )}

      {/* Meeting history toggle */}
      <div className="mt-8 border-t border-line pt-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm font-semibold text-accent hover:underline"
        >
          {showHistory ? "Hide Meeting History" : "Show Meeting History"}
        </button>

        {showHistory && (
          <div className="mt-4 space-y-3">
            {meetingHistory.length === 0 ? (
              <p className="text-sm text-subtle">No past meetings recorded.</p>
            ) : (
              meetingHistory.map((log) => {
                const output = (log.output ?? {}) as MeetingLog["output"];
                const durationMin = log.duration_seconds
                  ? Math.round(log.duration_seconds / 60)
                  : null;
                const isExpanded = expandedLogId === log.id;

                return (
                  <Card key={log.id}>
                    <CardContent className="py-3">
                      <button
                        onClick={() =>
                          setExpandedLogId(isExpanded ? null : log.id)
                        }
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-ink">
                              {new Date(log.started_at).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </p>
                            <p className="text-xs text-subtle mt-0.5">
                              {durationMin !== null
                                ? `${durationMin} min`
                                : "Duration unknown"}
                              {" · "}
                              {(output.resolvedBlockersCount ?? 0) +
                                (output.recordedDecisionsCount ?? 0) +
                                (output.newCommitmentsCount ?? 0) +
                                (output.reviewedCommitmentsCount ?? 0)}{" "}
                              actions
                            </p>
                          </div>
                          <span className="text-xs text-subtle">
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs border-t border-line pt-3">
                          <div>
                            <span className="text-subtle">Blockers resolved</span>
                            <p className="font-mono font-medium text-ink">
                              {output.resolvedBlockersCount ?? 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-subtle">Decisions made</span>
                            <p className="font-mono font-medium text-ink">
                              {output.recordedDecisionsCount ?? 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-subtle">New commitments</span>
                            <p className="font-mono font-medium text-ink">
                              {output.newCommitmentsCount ?? 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-subtle">Commitments reviewed</span>
                            <p className="font-mono font-medium text-ink">
                              {output.reviewedCommitmentsCount ?? 0}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
