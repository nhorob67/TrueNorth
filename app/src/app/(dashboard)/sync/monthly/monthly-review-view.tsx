"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetingTimer } from "@/components/meetings/meeting-timer";
import { SegmentNav, type SegmentConfig } from "@/components/meetings/segment-nav";
import { AttendanceTracker } from "@/components/meetings/attendance-tracker";

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
}

interface KpiSnapshot {
  kpi_id: string;
  value: number;
  snapshot_date: string;
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
  updated_at: string;
}

interface Bet {
  id: string;
  outcome: string;
  health_status: "green" | "yellow" | "red";
  owner_id: string;
  moves: MoveInBet[];
}

interface Commitment {
  id: string;
  description: string;
  owner_id: string;
  due_date: string | null;
  status: string;
  created_at: string;
}

interface KilledBet {
  id: string;
  outcome: string;
  health_status: string;
  owner_id: string;
  updated_at: string;
}

interface StaleArtifact {
  id: string;
  artifact_type: string;
  name: string;
  owner_id: string;
  last_updated_at: string;
  staleness_threshold_days: number;
}

interface IdeaCandidate {
  id: string;
  name: string;
  classification: string | null;
  score_total: number | null;
  lifecycle_status: string;
  submitter_id: string;
  created_at: string;
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

interface ShippedMove {
  id: string;
  title: string;
  bet_id: string;
  owner_id: string;
  updated_at: string;
}

interface TeamMember {
  user_id: string;
  role: string;
  full_name: string;
}

type MonthlySegment = "operating_health" | "wins_losses" | "root_causes" | "system_fixes" | "pipeline" | "action_items";

const SEGMENT_CONFIG: SegmentConfig<MonthlySegment>[] = [
  {
    key: "operating_health",
    label: "Operating Health",
    duration: 5,
    description: "Review behavioral culture metrics and trends.",
  },
  {
    key: "wins_losses",
    label: "Wins & Losses",
    duration: 15,
    description: "Shipped milestones, killed bets, KPI trends, and commitment rate.",
  },
  {
    key: "root_causes",
    label: "Root Causes",
    duration: 10,
    description: "Red KPIs, recurring blockers, and stalled bets analysis.",
  },
  {
    key: "system_fixes",
    label: "System Fixes",
    duration: 10,
    description: "Stale artifacts, process improvements, KPI adjustments.",
  },
  {
    key: "pipeline",
    label: "Pipeline Review",
    duration: 15,
    description: "Idea vault candidates, funnel health, content pipeline.",
  },
  {
    key: "action_items",
    label: "Action Items",
    duration: 10,
    description: "Review commitments, assign owners, set due dates.",
  },
];

const TOTAL_MINUTES = 65;

// ============================================================
// Segment Components
// ============================================================

interface HealthMetricRow {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: "green" | "yellow" | "red";
  trend: "improving" | "declining" | "stable";
}

interface HealthData {
  composite_score: number;
  composite_status: "green" | "yellow" | "red";
  metrics: Record<string, HealthMetricRow>;
  ai_interpretation?: string | null;
}

function OperatingHealthSegment({ isActive }: { isActive: boolean }) {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isActive || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    fetch("/api/health/compute")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch health data");
        return res.json();
      })
      .then((data) => {
        setHealthData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isActive]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-warm-gray">Computing operating health metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-semantic-brick">{error}</p>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-warm-gray">No health data available.</p>
      </div>
    );
  }

  const trendArrow = (trend: string) =>
    trend === "improving" ? "↑" : trend === "declining" ? "↓" : "→";

  const statusDotColor = (status: string) =>
    status === "green"
      ? "bg-semantic-green"
      : status === "yellow"
        ? "bg-semantic-ochre"
        : "bg-semantic-brick";

  const statusTextColor = (status: string) =>
    status === "green"
      ? "text-semantic-green"
      : status === "yellow"
        ? "text-semantic-ochre"
        : "text-semantic-brick";

  return (
    <div className="space-y-6">
      <p className="text-xs text-warm-gray">{SEGMENT_CONFIG[0].description}</p>

      {/* Composite score */}
      <div className="flex items-center gap-3">
        <span className="text-4xl font-mono font-bold text-charcoal">
          {healthData.composite_score}
        </span>
        <span
          className={`w-3 h-3 rounded-full ${statusDotColor(healthData.composite_status)}`}
        />
        <div>
          <p className="text-sm font-medium text-charcoal">Composite Score</p>
          <p className="text-xs text-warm-gray">Operating health across all behavioral metrics</p>
        </div>
      </div>

      {/* Individual metrics */}
      <div className="space-y-1.5">
        {Object.values(healthData.metrics).map((metric) => (
          <div
            key={metric.key}
            className="flex items-center justify-between py-2 px-3 border border-warm-border rounded-lg bg-ivory"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusDotColor(metric.status)}`} />
              <span className="text-sm text-charcoal">{metric.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-medium text-charcoal">{metric.value}</span>
              <span className="text-xs text-warm-gray">{metric.unit}</span>
              <span className={`text-sm ${statusTextColor(metric.status)}`}>
                {trendArrow(metric.trend)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* AI Interpretation */}
      {healthData.ai_interpretation && (
        <Card className="border-l-4 border-l-sage">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sage bg-sage/10 px-1.5 py-0.5 rounded">
                AI
              </span>
              <span className="text-xs font-medium text-charcoal">Interpretation</span>
            </div>
            <p className="text-sm text-warm-gray whitespace-pre-line">
              {healthData.ai_interpretation}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Prep Board Memo button */}
      <div className="pt-2">
        <a
          href="/narratives?type=monthly_board_memo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-clay text-white text-sm font-medium rounded-lg hover:bg-clay/90 transition-colors"
        >
          Prep Board Memo
        </a>
      </div>
    </div>
  );
}

function WinsLossesSegment({
  shippedMoves,
  killedBets,
  kpis,
  kpiSnapshots,
  commitmentCompletionRate,
  teamMembers,
}: {
  shippedMoves: ShippedMove[];
  killedBets: KilledBet[];
  kpis: Kpi[];
  kpiSnapshots: KpiSnapshot[];
  commitmentCompletionRate: number | null;
  teamMembers: TeamMember[];
}) {
  // Compute KPI trends: compare earliest and latest snapshot per KPI
  const kpiTrends = kpis.map((kpi) => {
    const snapshots = kpiSnapshots
      .filter((s) => s.kpi_id === kpi.id)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const first = snapshots[0]?.value ?? null;
    const last = snapshots[snapshots.length - 1]?.value ?? null;
    const trend =
      first !== null && last !== null
        ? last > first
          ? "improved"
          : last < first
            ? "deteriorated"
            : "flat"
        : "unknown";
    return { ...kpi, trend, firstValue: first, lastValue: last };
  });

  const improved = kpiTrends.filter((k) => k.trend === "improved");
  const deteriorated = kpiTrends.filter((k) => k.trend === "deteriorated");

  return (
    <div className="space-y-6">
      <p className="text-xs text-warm-gray">{SEGMENT_CONFIG[1].description}</p>

      {/* Shipped milestones */}
      <div>
        <h3 className="text-xs font-semibold text-semantic-green-text uppercase tracking-wider mb-2">
          Shipped This Month ({shippedMoves.length})
        </h3>
        {shippedMoves.length === 0 ? (
          <p className="text-sm text-warm-gray py-2">No milestones shipped this month.</p>
        ) : (
          <div className="space-y-1">
            {shippedMoves.map((move) => (
              <div key={move.id} className="flex items-center gap-2 text-sm py-1.5 px-2 bg-semantic-green/5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-green" />
                <span className="text-charcoal">{move.title}</span>
                <span className="text-xs text-warm-gray ml-auto">
                  {teamMembers.find((m) => m.user_id === move.owner_id)?.full_name ?? ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Killed bets */}
      {killedBets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-semantic-brick uppercase tracking-wider mb-2">
            Killed Bets ({killedBets.length})
          </h3>
          <div className="space-y-1">
            {killedBets.map((bet) => (
              <div key={bet.id} className="flex items-center gap-2 text-sm py-1.5 px-2 bg-semantic-brick/5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-brick" />
                <span className="text-charcoal">{bet.outcome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI trends */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-semibold text-semantic-green-text uppercase tracking-wider mb-2">
            KPIs Improved ({improved.length})
          </h3>
          {improved.length === 0 ? (
            <p className="text-xs text-warm-gray">None</p>
          ) : (
            <div className="space-y-1">
              {improved.map((k) => (
                <div key={k.id} className="text-xs text-charcoal">
                  {k.name}: <span className="font-mono">{k.firstValue}</span> &rarr;{" "}
                  <span className="font-mono text-semantic-green-text">{k.lastValue}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-semantic-brick uppercase tracking-wider mb-2">
            KPIs Deteriorated ({deteriorated.length})
          </h3>
          {deteriorated.length === 0 ? (
            <p className="text-xs text-warm-gray">None</p>
          ) : (
            <div className="space-y-1">
              {deteriorated.map((k) => (
                <div key={k.id} className="text-xs text-charcoal">
                  {k.name}: <span className="font-mono">{k.firstValue}</span> &rarr;{" "}
                  <span className="font-mono text-semantic-brick">{k.lastValue}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Commitment completion rate */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal">Commitment Completion Rate</span>
            <span
              className={`text-2xl font-mono font-bold ${
                commitmentCompletionRate !== null && commitmentCompletionRate >= 80
                  ? "text-semantic-green-text"
                  : commitmentCompletionRate !== null && commitmentCompletionRate >= 50
                    ? "text-semantic-ochre-text"
                    : "text-semantic-brick"
              }`}
            >
              {commitmentCompletionRate !== null ? `${commitmentCompletionRate}%` : "N/A"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RootCausesSegment({
  kpis,
  blockers,
  bets,
  rootCauseNotes,
  onNotesChange,
}: {
  kpis: Kpi[];
  blockers: Blocker[];
  bets: Bet[];
  rootCauseNotes: string;
  onNotesChange: (notes: string) => void;
}) {
  const redKpis = kpis.filter((k) => k.health_status === "red");
  const stalledBets = bets.filter(
    (b) => b.health_status === "red" || b.health_status === "yellow"
  );

  // Group blockers by linked entity to find recurring patterns
  const entityBlockerCounts: Record<string, { count: number; descriptions: string[] }> = {};
  for (const blocker of blockers) {
    if (blocker.linked_entity_id) {
      const key = `${blocker.linked_entity_type}:${blocker.linked_entity_id}`;
      if (!entityBlockerCounts[key]) {
        entityBlockerCounts[key] = { count: 0, descriptions: [] };
      }
      entityBlockerCounts[key].count++;
      entityBlockerCounts[key].descriptions.push(blocker.description);
    }
  }
  const recurringBlockers = Object.entries(entityBlockerCounts)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-6">
      <p className="text-xs text-warm-gray">{SEGMENT_CONFIG[2].description}</p>

      {/* Red KPIs */}
      <div>
        <h3 className="text-xs font-semibold text-semantic-brick uppercase tracking-wider mb-2">
          Red KPIs ({redKpis.length})
        </h3>
        {redKpis.length === 0 ? (
          <p className="text-sm text-semantic-green-text">No red KPIs.</p>
        ) : (
          <div className="space-y-2">
            {redKpis.map((kpi) => (
              <Card key={kpi.id} borderColor="var(--color-semantic-brick)">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{kpi.name}</p>
                      <p className="text-xs text-warm-gray mt-0.5">
                        Current: <span className="font-mono font-medium">{kpi.current_value ?? "—"}</span>
                        {kpi.target !== null && (
                          <> / Target: <span className="font-mono">{kpi.target}</span></>
                        )}
                        {kpi.unit && ` ${kpi.unit}`}
                      </p>
                    </div>
                    <Badge status="red">RED</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recurring blockers */}
      {recurringBlockers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
            Recurring Blockers
          </h3>
          <div className="space-y-2">
            {recurringBlockers.map(([key, data]) => (
              <Card key={key}>
                <CardContent className="py-3">
                  <p className="text-sm text-charcoal font-medium">
                    {data.count} blockers on same entity
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {data.descriptions.slice(0, 3).map((desc, i) => (
                      <li key={i} className="text-xs text-warm-gray">• {desc}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Stalled bets */}
      {stalledBets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-semantic-ochre-text uppercase tracking-wider mb-2">
            Stalled Bets ({stalledBets.length})
          </h3>
          <div className="space-y-1">
            {stalledBets.map((bet) => (
              <div key={bet.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded border border-warm-border">
                <Badge status={bet.health_status}>{bet.health_status.toUpperCase()}</Badge>
                <span className="text-charcoal">{bet.outcome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Facilitator notes */}
      <div>
        <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
          Root Cause Notes
        </h3>
        <textarea
          value={rootCauseNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Capture root cause observations, patterns, and insights..."
          rows={4}
          className="w-full text-sm border border-warm-border rounded-lg px-3 py-2 bg-ivory text-charcoal placeholder:text-warm-gray focus:outline-none focus:border-moss"
        />
      </div>
    </div>
  );
}

function SystemFixesSegment({
  staleArtifacts,
  kpis,
  teamMembers,
  actionItems,
  onAddActionItem,
}: {
  staleArtifacts: StaleArtifact[];
  kpis: Kpi[];
  teamMembers: TeamMember[];
  actionItems: Array<{ description: string; ownerId: string; dueDate?: string }>;
  onAddActionItem: (description: string, ownerId: string, dueDate?: string) => void;
}) {
  const [newDesc, setNewDesc] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  return (
    <div className="space-y-6">
      <p className="text-xs text-warm-gray">{SEGMENT_CONFIG[3].description}</p>

      {/* Stale artifacts */}
      <div>
        <h3 className="text-xs font-semibold text-semantic-ochre-text uppercase tracking-wider mb-2">
          Stale Artifacts ({staleArtifacts.length})
        </h3>
        {staleArtifacts.length === 0 ? (
          <p className="text-sm text-warm-gray py-2">All artifacts are up to date.</p>
        ) : (
          <div className="space-y-2">
            {staleArtifacts.map((artifact) => {
              const daysSince = Math.floor(
                (Date.now() - new Date(artifact.last_updated_at).getTime()) / (1000 * 60 * 60 * 24)
              );
              const overduePct = Math.min(
                100,
                (daysSince / artifact.staleness_threshold_days) * 100
              );
              const severity =
                daysSince > artifact.staleness_threshold_days * 2
                  ? "red"
                  : daysSince > artifact.staleness_threshold_days
                    ? "yellow"
                    : "green";
              const barColor =
                severity === "red"
                  ? "bg-semantic-brick"
                  : severity === "yellow"
                    ? "bg-semantic-ochre"
                    : "bg-semantic-green";

              return (
                <div
                  key={artifact.id}
                  className="border border-warm-border rounded-lg p-2.5 bg-ivory"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-medium text-charcoal">
                        {artifact.name}
                      </span>
                      <span className="text-xs text-warm-gray ml-2">
                        ({artifact.artifact_type})
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        severity === "red"
                          ? "text-semantic-brick"
                          : "text-semantic-ochre"
                      }`}
                    >
                      {daysSince}d / {artifact.staleness_threshold_days}d
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-warm-border overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(overduePct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-warm-gray mt-1">
                    Last updated{" "}
                    {new Date(artifact.last_updated_at).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    )}
                    {" — "}
                    {daysSince > artifact.staleness_threshold_days
                      ? `${daysSince - artifact.staleness_threshold_days}d overdue`
                      : "approaching threshold"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI threshold review */}
      <div>
        <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
          KPI Thresholds to Review
        </h3>
        <p className="text-xs text-warm-gray mb-2">
          Consider adjusting targets for KPIs that have been consistently red or green.
        </p>
        <div className="space-y-1">
          {kpis
            .filter((k) => k.health_status === "red" || k.health_status === "green")
            .slice(0, 5)
            .map((kpi) => (
              <div key={kpi.id} className="flex items-center justify-between text-xs py-1 px-2 border border-warm-border rounded">
                <span className="text-charcoal">{kpi.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{kpi.current_value ?? "—"} / {kpi.target ?? "—"}</span>
                  <Badge status={kpi.health_status}>{kpi.health_status.toUpperCase()}</Badge>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Action items capture */}
      <div>
        <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
          Action Items ({actionItems.length})
        </h3>
        {actionItems.length > 0 && (
          <div className="space-y-1 mb-3">
            {actionItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 bg-moss/5 rounded">
                <span className="text-charcoal">{item.description}</span>
                <span className="text-xs text-warm-gray">
                  {teamMembers.find((m) => m.user_id === item.ownerId)?.full_name ?? "Unassigned"}
                  {item.dueDate && ` · Due ${item.dueDate}`}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Action item description..."
            className="flex-1"
          />
          <select
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            className="text-sm border border-warm-border rounded-lg px-2 py-2 bg-ivory w-36"
          >
            <option value="">Owner</option>
            {teamMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
            ))}
          </select>
          <Input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="w-36"
          />
          <Button
            size="sm"
            disabled={!newDesc.trim() || !newOwner}
            onClick={() => {
              onAddActionItem(newDesc.trim(), newOwner, newDueDate || undefined);
              setNewDesc("");
              setNewOwner("");
              setNewDueDate("");
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function PipelineReviewSegment({
  ideaCandidates,
  contentPipeline,
  bets,
}: {
  ideaCandidates: IdeaCandidate[];
  contentPipeline: Record<string, number>;
  bets: Bet[];
}) {
  const totalContent = Object.values(contentPipeline).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <p className="text-xs text-warm-gray">{SEGMENT_CONFIG[4].description}</p>

      {/* Idea vault candidates */}
      <div>
        <h3 className="text-xs font-semibold text-brass uppercase tracking-wider mb-2">
          Idea Vault Candidates ({ideaCandidates.length})
        </h3>
        {ideaCandidates.length === 0 ? (
          <p className="text-sm text-warm-gray py-2">No idea candidates this month.</p>
        ) : (
          <div className="space-y-2">
            {ideaCandidates.map((idea) => (
              <Card key={idea.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{idea.name}</p>
                      {idea.classification && (
                        <span className="text-xs text-warm-gray capitalize">{idea.classification}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {idea.score_total !== null && (
                        <span className="text-sm font-mono font-bold text-brass">
                          {idea.score_total}
                        </span>
                      )}
                      <Badge status="neutral">{idea.lifecycle_status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Content pipeline */}
      <div>
        <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
          Content Pipeline ({totalContent} pieces)
        </h3>
        {totalContent === 0 ? (
          <p className="text-sm text-warm-gray py-2">No content in pipeline.</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {["ideation", "drafting", "review", "scheduled", "published"].map((stage) => (
              <div key={stage} className="text-center p-2 bg-ivory border border-warm-border rounded">
                <p className="text-lg font-mono font-bold text-charcoal">
                  {contentPipeline[stage] ?? 0}
                </p>
                <p className="text-xs text-warm-gray capitalize">{stage}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bet health overview */}
      <div>
        <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
          Active Bets Health
        </h3>
        <div className="space-y-1">
          {bets.map((bet) => {
            const activeMoves = bet.moves.filter(
              (m) => m.lifecycle_status !== "cut" && m.lifecycle_status !== "shipped"
            );
            const shippedMoves = bet.moves.filter((m) => m.lifecycle_status === "shipped");
            return (
              <div key={bet.id} className="flex items-center justify-between text-sm py-1.5 px-2 border border-warm-border rounded">
                <span className="text-charcoal truncate flex-1">{bet.outcome}</span>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-warm-gray">
                    {shippedMoves.length}/{bet.moves.length} shipped
                  </span>
                  <Badge status={bet.health_status}>{bet.health_status.toUpperCase()}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActionItemsSegment({
  actionItems,
  newCommitments,
  teamMembers,
}: {
  actionItems: Array<{ description: string; ownerId: string; dueDate?: string }>;
  newCommitments: string[];
  teamMembers: TeamMember[];
}) {
  const allItems = [
    ...actionItems.map((item) => ({
      description: item.description,
      owner: teamMembers.find((m) => m.user_id === item.ownerId)?.full_name ?? "Unassigned",
      dueDate: item.dueDate ?? null,
    })),
  ];

  return (
    <div className="space-y-6">
      <p className="text-xs text-warm-gray">{SEGMENT_CONFIG[5].description}</p>

      <div>
        <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
          Meeting Action Items ({allItems.length})
        </h3>
        {allItems.length === 0 ? (
          <p className="text-sm text-warm-gray py-4 text-center">
            No action items captured yet. Add them in the System Fixes segment.
          </p>
        ) : (
          <div className="space-y-2">
            {allItems.map((item, i) => (
              <Card key={i}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-charcoal">{item.description}</p>
                      <p className="text-xs text-warm-gray mt-0.5">
                        {item.owner}
                        {item.dueDate && ` · Due ${item.dueDate}`}
                      </p>
                    </div>
                    <Badge status="neutral">pending</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {newCommitments.length > 0 && (
        <Card className="bg-moss/5">
          <CardHeader>
            <h3 className="text-sm font-semibold text-moss">Commitments Created ({newCommitments.length})</h3>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {newCommitments.map((desc, i) => (
                <li key={i} className="text-sm text-charcoal">• {desc}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Main Monthly Review View
// ============================================================

export function MonthlyReviewView({
  kpis,
  kpiSnapshots,
  bets,
  recentCommitments,
  commitmentCompletionRate,
  killedBets,
  staleArtifacts,
  ideaCandidates,
  blockers,
  shippedMoves,
  contentPipeline,
  teamMembers,
}: {
  kpis: Kpi[];
  kpiSnapshots: KpiSnapshot[];
  bets: Bet[];
  recentCommitments: Commitment[];
  commitmentCompletionRate: number | null;
  killedBets: KilledBet[];
  staleArtifacts: StaleArtifact[];
  ideaCandidates: IdeaCandidate[];
  blockers: Blocker[];
  shippedMoves: ShippedMove[];
  contentPipeline: Record<string, number>;
  teamMembers: TeamMember[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();

  const [activeSegment, setActiveSegment] = useState<MonthlySegment>("operating_health");
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_MINUTES * 60);
  const [segmentTimeUsed, setSegmentTimeUsed] = useState<Record<MonthlySegment, number>>({
    operating_health: 0,
    wins_losses: 0,
    root_causes: 0,
    system_fixes: 0,
    pipeline: 0,
    action_items: 0,
  });

  const [rootCauseNotes, setRootCauseNotes] = useState("");
  const [actionItems, setActionItems] = useState<Array<{ description: string; ownerId: string; dueDate?: string }>>([]);
  const [newCommitments, setNewCommitments] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<string[]>(teamMembers.map((m) => m.user_id));

  const [meetingSaved, setMeetingSaved] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const meetingStartedAtRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Timer tick
  useEffect(() => {
    if (!timerRunning) return;
    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      setSecondsRemaining((prev) => prev - elapsed);
      setSegmentTimeUsed((prev) => ({
        ...prev,
        [activeSegment]: (prev[activeSegment] ?? 0) + elapsed,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, activeSegment]);

  const currentConfig = SEGMENT_CONFIG.find((s) => s.key === activeSegment);
  const segmentTimeLimit = (currentConfig?.duration ?? 10) * 60;
  const isOverTime = (segmentTimeUsed[activeSegment] ?? 0) > segmentTimeLimit;

  const handleToggleTimer = useCallback(() => {
    if (!timerRunning && !meetingStartedAtRef.current) {
      meetingStartedAtRef.current = new Date().toISOString();
    }
    setTimerRunning(!timerRunning);
  }, [timerRunning]);

  const handleAddActionItem = useCallback(
    async (description: string, ownerId: string, dueDate?: string) => {
      setActionItems((prev) => [...prev, { description, ownerId, dueDate }]);

      // Also create as commitment in DB
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);

      await supabase.from("commitments").insert({
        organization_id: userCtx.orgId,
        description,
        owner_id: ownerId,
        due_date: dueDate || nextMonth.toISOString().split("T")[0],
        created_in: "monthly_review",
      });

      setNewCommitments((prev) => [...prev, description]);
      router.refresh();
    },
    [supabase, userCtx.orgId, router]
  );

  const handleSaveMeeting = useCallback(async () => {
    if (!meetingStartedAtRef.current) return;
    setSavingMeeting(true);

    const now = new Date();
    const startedAt = new Date(meetingStartedAtRef.current);
    const durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);

    await supabase.from("meeting_logs").insert({
      organization_id: userCtx.orgId,
      venture_id: userCtx.ventureId || null,
      meeting_type: "monthly_review",
      started_at: meetingStartedAtRef.current,
      completed_at: now.toISOString(),
      duration_seconds: durationSeconds,
      output: {
        attendees,
        kpisReviewed: kpis.length,
        commitmentCompletionRate,
        killedBetsCount: killedBets.length,
        rootCauseNotes,
        actionItems,
        newCommitmentsCount: newCommitments.length,
        newCommitmentIds: newCommitments,
      },
      facilitator_id: userCtx.userId,
    });

    setSavingMeeting(false);
    setMeetingSaved(true);
    setTimerRunning(false);
  }, [supabase, userCtx, attendees, kpis.length, commitmentCompletionRate, killedBets.length, rootCauseNotes, actionItems, newCommitments]);

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
          <h1 className="text-2xl font-bold text-charcoal">Monthly Operating Review</h1>
          <p className="text-sm text-warm-gray mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Attendance */}
      <div className="mb-4">
        <AttendanceTracker teamMembers={teamMembers} onAttendanceChange={setAttendees} />
      </div>

      {/* Timer */}
      <MeetingTimer
        running={timerRunning}
        onToggle={handleToggleTimer}
        secondsRemaining={secondsRemaining}
        totalMinutes={TOTAL_MINUTES}
      />

      {/* Segment navigation */}
      <SegmentNav
        segments={SEGMENT_CONFIG}
        activeSegment={activeSegment}
        onSelect={setActiveSegment}
        segmentTimeUsed={segmentTimeUsed}
      />

      {/* Over-time warning */}
      {isOverTime && timerRunning && (
        <div className="mb-4 p-2 bg-semantic-ochre/10 border border-semantic-ochre/20 rounded-lg text-xs text-semantic-ochre-text text-center">
          Over time for this segment.{" "}
          <button onClick={advanceSegment} className="font-semibold underline">
            Move to next
          </button>
        </div>
      )}

      {/* Active segment content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-charcoal">{currentConfig?.label}</h2>
            <Button variant="tertiary" size="sm" onClick={advanceSegment}>
              Next Segment &rarr;
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeSegment === "operating_health" && (
            <OperatingHealthSegment isActive={activeSegment === "operating_health"} />
          )}
          {activeSegment === "wins_losses" && (
            <WinsLossesSegment
              shippedMoves={shippedMoves}
              killedBets={killedBets}
              kpis={kpis}
              kpiSnapshots={kpiSnapshots}
              commitmentCompletionRate={commitmentCompletionRate}
              teamMembers={teamMembers}
            />
          )}
          {activeSegment === "root_causes" && (
            <RootCausesSegment
              kpis={kpis}
              blockers={blockers}
              bets={bets}
              rootCauseNotes={rootCauseNotes}
              onNotesChange={setRootCauseNotes}
            />
          )}
          {activeSegment === "system_fixes" && (
            <SystemFixesSegment
              staleArtifacts={staleArtifacts}
              kpis={kpis}
              teamMembers={teamMembers}
              actionItems={actionItems}
              onAddActionItem={handleAddActionItem}
            />
          )}
          {activeSegment === "pipeline" && (
            <PipelineReviewSegment
              ideaCandidates={ideaCandidates}
              contentPipeline={contentPipeline}
              bets={bets}
            />
          )}
          {activeSegment === "action_items" && (
            <ActionItemsSegment
              actionItems={actionItems}
              newCommitments={newCommitments}
              teamMembers={teamMembers}
            />
          )}
        </CardContent>
      </Card>

      {/* Save meeting */}
      {meetingStartedAtRef.current && !meetingSaved && (
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="primary" onClick={handleSaveMeeting} disabled={savingMeeting}>
            {savingMeeting ? "Saving..." : "End & Save Review"}
          </Button>
        </div>
      )}

      {meetingSaved && (
        <div className="mt-4 p-3 bg-semantic-green/10 border border-semantic-green/20 rounded-lg text-center text-sm text-semantic-green-text font-medium">
          Monthly review saved successfully.
        </div>
      )}
    </div>
  );
}
