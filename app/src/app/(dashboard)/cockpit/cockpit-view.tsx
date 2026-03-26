"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CadenceReport } from "@/lib/cadence-intelligence";
import { getArtifactHref, getEntityHref } from "@/lib/format";

interface BlockedMove {
  id: string;
  title: string;
  bet_outcome: string;
  blocker_description: string;
  blocker_severity: string;
}

interface StalledBet {
  betId: string;
  betOutcome: string;
  ownerId: string;
  reason: string;
}

interface CockpitProps {
  blockedMoves: BlockedMove[];
  nextCadenceEvent: string | null;
  driftingKpis: Array<{
    id: string;
    name: string;
    health_status: "green" | "yellow" | "red";
    current_value: number | null;
    target: number | null;
    unit: string | null;
  }>;
  openDecisions: Array<{
    id: string;
    title: string;
    created_at: string;
  }>;
  atRiskBets: Array<{
    id: string;
    outcome: string;
    health_status: "green" | "yellow" | "red";
  }>;
  openBlockers: Array<{
    id: string;
    description: string;
    severity: string;
    created_at: string;
  }>;
  upcomingMoves: Array<{
    id: string;
    title: string;
    due_date: string;
    bet_id: string;
    bets: { outcome: string } | null;
  }>;
  pendingCommitments: Array<{
    id: string;
    description: string;
    due_date: string | null;
    status: string;
  }>;
  todayPulses: Array<{
    user_id: string;
    user_profiles: { full_name: string } | null;
  }>;
  staleArtifacts: Array<{
    artifact_type: string;
    name: string;
    days_since_update: number | null;
    staleness_threshold_days: number;
  }>;
  stalledBets: StalledBet[];
  cadenceReport?: CadenceReport | null;
  aiRecommendation?: {
    action: string;
    reasoning: string;
    entityType?: string;
    entityId?: string;
    urgency: "critical" | "important" | "suggested";
    confidence: "high" | "medium" | "low";
  } | null;
  healthScore?: number | null;
  healthStatus?: "green" | "yellow" | "red" | null;
  healthTrend?: "improving" | "declining" | "stable" | null;
}

function CockpitSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <span className="text-xs font-mono text-subtle">{count}</span>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CockpitView({
  blockedMoves,
  nextCadenceEvent,
  driftingKpis,
  openDecisions,
  atRiskBets,
  openBlockers,
  upcomingMoves,
  pendingCommitments,
  todayPulses,
  staleArtifacts,
  stalledBets,
  cadenceReport,
  aiRecommendation: initialRecommendation,
  healthScore,
  healthStatus,
  healthTrend,
}: CockpitProps) {
  const [recommendation, setRecommendation] = useState(initialRecommendation ?? null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAdvice = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ai/cockpit-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendation(data);
      }
    } catch {
      // Silently fail — keep existing recommendation
    } finally {
      setRefreshing(false);
    }
  }, []);

  const driftCount = driftingKpis.length + staleArtifacts.length;

  const urgencyColor = {
    critical: "text-semantic-brick",
    important: "text-semantic-ochre",
    suggested: "text-semantic-green",
  };

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Operator Cockpit</h1>

      {/* Operating Health compact widget */}
      {healthScore !== null && healthScore !== undefined && (
        <div className="mb-4 px-4 py-2.5 bg-surface border border-line rounded-xl inline-flex items-center gap-4 w-full">
          <div className="inline-flex items-center gap-2">
            <span className="text-2xl font-mono font-bold text-ink">{healthScore}</span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                healthStatus === "green"
                  ? "bg-semantic-green"
                  : healthStatus === "yellow"
                    ? "bg-semantic-ochre"
                    : "bg-semantic-brick"
              }`}
            />
            <span className="text-base text-subtle">
              {healthTrend === "improving" ? "↑" : healthTrend === "declining" ? "↓" : "→"}
            </span>
          </div>
          <span className="text-sm text-subtle">Operating Health</span>
          <Link
            href="/reviews/health"
            className="text-xs text-accent hover:underline ml-auto"
          >
            View details
          </Link>
          <Link
            href="/reviews/narratives?type=weekly_team_update"
            className="text-xs text-accent hover:underline font-medium"
          >
            Generate this week&apos;s memo
          </Link>
        </div>
      )}

      {/* AI Recommends — full-width above the grid */}
      <Card className="mb-4 border-l-4 border-l-sage">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">AI Recommends</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sage bg-sage/10 px-1.5 py-0.5 rounded">
                AI
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={refreshAdvice}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recommendation ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span
                  className={`text-xs font-semibold uppercase mt-0.5 ${urgencyColor[recommendation.urgency] ?? "text-subtle"}`}
                >
                  {recommendation.urgency}
                </span>
                <p className="text-sm font-medium text-ink">
                  {recommendation.entityType && recommendation.entityId ? (
                    <Link
                      href={getEntityHref(
                        recommendation.entityType,
                        recommendation.entityId
                      ) ?? "#"}
                      className="hover:underline"
                    >
                      {recommendation.action}
                    </Link>
                  ) : (
                    recommendation.action
                  )}
                </p>
              </div>
              <p className="text-xs text-subtle">{recommendation.reasoning}</p>
            </div>
          ) : (
            <p className="text-sm text-subtle">
              No AI recommendation available.{" "}
              <button
                onClick={refreshAdvice}
                className="text-sage hover:underline"
              >
                Generate one now
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Drifting KPIs + Stale Artifacts */}
        <CockpitSection title="What is drifting" count={driftCount}>
          {driftCount === 0 ? (
            <p className="text-sm text-subtle">All systems healthy</p>
          ) : (
            <div className="space-y-2">
              {driftingKpis.map((kpi) => (
                <div key={kpi.id} className="flex items-center justify-between">
                  <span className="text-sm">{kpi.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-subtle">
                      {kpi.current_value ?? "—"} / {kpi.target ?? "—"}
                    </span>
                    <Badge status={kpi.health_status} />
                  </div>
                </div>
              ))}
              {driftingKpis.length > 0 && staleArtifacts.length > 0 && (
                <hr className="border-line" />
              )}
              {staleArtifacts.map((artifact) => {
                const href = getArtifactHref(artifact.artifact_type) ?? "#";
                const overdueDays =
                  artifact.days_since_update !== null
                    ? artifact.days_since_update - artifact.staleness_threshold_days
                    : null;
                return (
                  <Link
                    key={artifact.artifact_type}
                    href={href}
                    className="flex items-center justify-between group"
                  >
                    <span className="text-sm group-hover:underline">
                      <span className="text-xs font-mono text-subtle mr-1">Artifact:</span>
                      {artifact.name}
                    </span>
                    <span className="text-xs font-mono text-semantic-brick">
                      {overdueDays !== null && overdueDays > 0
                        ? `${overdueDays}d overdue`
                        : "needs update"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CockpitSection>

        {/* Decisions Required */}
        <CockpitSection
          title="Decisions required"
          count={openDecisions.length}
        >
          {openDecisions.length === 0 ? (
            <p className="text-sm text-subtle">No pending decisions</p>
          ) : (
            <div className="space-y-2">
              {openDecisions.map((d) => (
                <div key={d.id} className="text-sm">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-subtle">
                    Opened {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* At-Risk Bets */}
        <CockpitSection title="Bets at risk" count={atRiskBets.length + stalledBets.length}>
          {atRiskBets.length === 0 && stalledBets.length === 0 ? (
            <p className="text-sm text-subtle">All bets on track</p>
          ) : (
            <div className="space-y-2">
              {atRiskBets.map((bet) => (
                <div key={bet.id} className="flex items-center justify-between">
                  <span className="text-sm">{bet.outcome}</span>
                  <Badge status={bet.health_status} />
                </div>
              ))}
              {stalledBets.length > 0 && atRiskBets.length > 0 && (
                <hr className="border-line" />
              )}
              {stalledBets.map((bet) => (
                <div key={bet.betId}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{bet.betOutcome}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-semantic-brick bg-semantic-brick/10 px-1.5 py-0.5 rounded">
                      Stalled
                    </span>
                  </div>
                  <p className="text-xs text-semantic-brick mt-0.5">
                    {bet.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* Open Blockers */}
        <CockpitSection title="Who is blocked" count={openBlockers.length}>
          {openBlockers.length === 0 ? (
            <p className="text-sm text-subtle">No open blockers</p>
          ) : (
            <div className="space-y-2">
              {openBlockers.map((b) => (
                <div key={b.id}>
                  <p className="text-sm">{b.description}</p>
                  <p className="text-xs text-subtle">
                    Severity: {b.severity} — opened{" "}
                    {new Date(b.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* Upcoming Milestones */}
        <CockpitSection
          title="Upcoming milestones (7 days)"
          count={upcomingMoves.length}
        >
          {upcomingMoves.length === 0 ? (
            <p className="text-sm text-subtle">No upcoming milestones</p>
          ) : (
            <div className="space-y-2">
              {upcomingMoves.map((m) => (
                <div key={m.id}>
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-subtle">
                    Due {new Date(m.due_date).toLocaleDateString()}
                    {m.bets && ` — ${m.bets.outcome}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* Commitments Due */}
        <CockpitSection
          title="Commitments due"
          count={pendingCommitments.length}
        >
          {pendingCommitments.length === 0 ? (
            <p className="text-sm text-subtle">No pending commitments</p>
          ) : (
            <div className="space-y-2">
              {pendingCommitments.map((c) => (
                <div key={c.id}>
                  <p className="text-sm">{c.description}</p>
                  {c.due_date && (
                    <p className="text-xs text-subtle">
                      Due {new Date(c.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* Pulse Status */}
        <CockpitSection
          title="Pulse status"
          count={todayPulses.length}
        >
          {todayPulses.length === 0 ? (
            <p className="text-sm text-subtle">No pulses submitted today</p>
          ) : (
            <div className="space-y-1">
              {todayPulses.map((p) => (
                <p key={p.user_id} className="text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-green" />
                  {p.user_profiles?.full_name ?? "Unknown"}
                </p>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* Blocked Moves */}
        <CockpitSection title="Blocked moves" count={blockedMoves.length}>
          {blockedMoves.length === 0 ? (
            <p className="text-sm text-subtle">No blocked moves</p>
          ) : (
            <div className="space-y-2">
              {blockedMoves.map((m) => (
                <div key={m.id}>
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-subtle">{m.bet_outcome}</p>
                  <p className="text-xs text-semantic-brick">
                    Blocker ({m.blocker_severity}): {m.blocker_description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* Cadence Compliance */}
        <CockpitSection
          title="Cadence compliance"
          count={cadenceReport?.metrics.filter((m) => m.is_overdue).length ?? 0}
        >
          {cadenceReport ? (
            <div className="space-y-3">
              {/* Overall score */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-bold ${
                    cadenceReport.overall_status === "green"
                      ? "text-semantic-green"
                      : cadenceReport.overall_status === "yellow"
                        ? "text-semantic-ochre"
                        : "text-semantic-brick"
                  }`}
                >
                  {cadenceReport.overall_score}%
                </span>
                <span className="text-xs text-subtle">overall compliance</span>
              </div>

              {/* Individual cadence types */}
              <div className="space-y-1.5">
                {cadenceReport.metrics.map((metric) => (
                  <div
                    key={metric.cadence_type}
                    className={`flex items-center justify-between ${
                      metric.is_overdue ? "text-semantic-brick" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          metric.status === "green"
                            ? "bg-semantic-green"
                            : metric.status === "yellow"
                              ? "bg-semantic-ochre"
                              : "bg-semantic-brick"
                        }`}
                      />
                      <span className="text-sm">{metric.label}</span>
                    </div>
                    <span className="text-xs font-mono">
                      {metric.compliance_rate}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Next cadence event */}
              {nextCadenceEvent && (
                <div className="pt-2 border-t border-line">
                  <p className="text-xs text-subtle">Next up</p>
                  <p className="text-sm">{nextCadenceEvent}</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              {nextCadenceEvent ? (
                <p className="text-sm">{nextCadenceEvent}</p>
              ) : (
                <p className="text-sm text-subtle">No cadence data available</p>
              )}
            </div>
          )}
        </CockpitSection>
      </div>
    </div>
  );
}
