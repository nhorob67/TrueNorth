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
    directionality: string | null;
    dod: { delta: number; pctChange: number | null; direction: "up" | "down" | "flat" } | null;
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
  pendingAgentTasks?: Array<{
    id: string;
    agent_profile: string;
    title: string;
    output_data: Record<string, unknown>;
    entity_id: string | null;
    entity_type: string | null;
    created_at: string;
    completed_at: string | null;
  }>;
}

function CockpitSection({
  title,
  count,
  children,
  defaultExpanded = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 text-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
          </div>
          <span className="text-xs font-mono text-subtle">{count}</span>
        </button>
      </CardHeader>
      <div className={`grid transition-all duration-200 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <CardContent>{children}</CardContent>
        </div>
      </div>
    </Card>
  );
}

function AgentTaskReviewCard({
  task,
}: {
  task: {
    id: string;
    agent_profile: string;
    title: string;
    output_data: Record<string, unknown>;
    entity_id: string | null;
    entity_type: string | null;
    created_at: string;
    completed_at: string | null;
  };
}) {
  const [reviewing, setReviewing] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const outputSummary =
    typeof task.output_data?.summary === "string"
      ? task.output_data.summary
      : typeof task.output_data?.output_summary === "string"
        ? task.output_data.output_summary
        : JSON.stringify(task.output_data).slice(0, 300);

  const cascadeVariants = (
    (task.output_data?.structured as Record<string, unknown>)?.variants as
      Array<{ machine_type: string; title: string; one_ask_conflict?: boolean }> | undefined
  ) ?? [];

  async function handleAction(outcome: "approved" | "rejected") {
    setSubmitting(true);
    await fetch("/api/hermes/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        status: outcome === "approved" ? "done" : "rejected",
        ...(outcome === "rejected" && rejectNotes ? { error_message: rejectNotes } : {}),
      }),
    });

    // Content Cascade: create content_pieces from approved variants
    if (outcome === "approved" && task.agent_profile === "content-cascade") {
      try {
        await fetch("/api/content/cascade/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id }),
        });
      } catch {
        // Best-effort; task is already approved
      }
    }

    setSubmitting(false);
    window.location.reload();
  }

  return (
    <div className="border border-line rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center rounded-full bg-sage px-2 py-0.5 text-[10px] font-mono text-white shrink-0">
            {task.agent_profile}
          </span>
          <p className="text-sm font-medium text-ink truncate">{task.title}</p>
        </div>
        {task.entity_id && task.entity_type && getEntityHref(task.entity_type, task.entity_id) && (
          <Link
            href={getEntityHref(task.entity_type, task.entity_id)!}
            className="text-xs text-accent hover:underline shrink-0"
          >
            View entity
          </Link>
        )}
      </div>

      <p className="text-sm text-subtle mt-1 whitespace-pre-wrap line-clamp-4">
        {outputSummary}
      </p>

      {/* Cascade variant details */}
      {task.agent_profile === "content-cascade" && cascadeVariants.length > 0 && (
        <div className="mt-2 space-y-1">
          {cascadeVariants.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded bg-well px-1.5 py-0.5 font-mono text-subtle">
                {v.machine_type}
              </span>
              <span className="text-ink truncate">{v.title}</span>
              {v.one_ask_conflict && (
                <span className="text-semantic-brick font-medium shrink-0">CTA conflict</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        {!reviewing ? (
          <>
            <Button
              size="sm"
              onClick={() => handleAction("approved")}
              disabled={submitting}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReviewing(true)}
              disabled={submitting}
            >
              Reject
            </Button>
            <span className="text-xs text-faded ml-auto">
              {task.completed_at
                ? new Date(task.completed_at).toLocaleString()
                : new Date(task.created_at).toLocaleString()}
            </span>
          </>
        ) : (
          <div className="flex-1 space-y-2">
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Feedback for the agent (optional)..."
              className="w-full min-h-[60px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleAction("rejected")}
                disabled={submitting}
              >
                Confirm Reject
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReviewing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
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
  pendingAgentTasks = [],
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-list">
        {/* Drifting KPIs + Stale Artifacts */}
        <CockpitSection title="What is drifting" count={driftCount} defaultExpanded={driftCount > 0}>
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
                    {kpi.dod && kpi.dod.direction !== "flat" && (() => {
                      const isUp = kpi.dod!.direction === "up";
                      const dir = kpi.directionality ?? "up_is_good";
                      const isGood = dir === "up_is_good" ? isUp : dir === "down_is_good" ? !isUp : null;
                      const colorClass = isGood === true ? "text-semantic-green" : isGood === false ? "text-semantic-brick" : "text-subtle";
                      const arrow = isUp ? "↑" : "↓";
                      const pct = kpi.dod!.pctChange !== null ? `${Math.abs(kpi.dod!.pctChange).toFixed(1)}%` : "";
                      return (
                        <span className={`text-xs font-mono ${colorClass}`}>
                          {arrow}{pct}
                        </span>
                      );
                    })()}
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
          defaultExpanded={openDecisions.length > 0}
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
        <CockpitSection title="Bets at risk" count={atRiskBets.length + stalledBets.length} defaultExpanded={atRiskBets.length + stalledBets.length > 0}>
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
        <CockpitSection title="Who is blocked" count={openBlockers.length} defaultExpanded={openBlockers.length > 0}>
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
          defaultExpanded={upcomingMoves.length > 0}
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
          defaultExpanded={pendingCommitments.length > 0}
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
          defaultExpanded={todayPulses.length > 0}
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
        <CockpitSection title="Blocked moves" count={blockedMoves.length} defaultExpanded={blockedMoves.length > 0}>
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
          defaultExpanded={(cadenceReport?.metrics.filter((m) => m.is_overdue).length ?? 0) > 0}
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
      {/* Agent Inbox — tasks awaiting human review */}
      {pendingAgentTasks.length > 0 && (
        <div>
          <CockpitSection title="Agent Inbox" count={pendingAgentTasks.length}>
            <div className="space-y-2">
              {pendingAgentTasks.map((task) => (
                <AgentTaskReviewCard key={task.id} task={task} />
              ))}
            </div>
          </CockpitSection>
        </div>
      )}
      </div>
    </div>
  );
}
