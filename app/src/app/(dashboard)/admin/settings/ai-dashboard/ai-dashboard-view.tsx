"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import type { Agent, AiAction } from "@/types/database";

// ============================================================
// Constants
// ============================================================

const CATEGORY_LABELS: Record<string, string> = {
  filter_guardian: "Filter Guardian",
  signal_watch: "Signal Watch",
  content_copilot: "Content Copilot",
  cockpit_advisor: "Cockpit Advisor",
  agenda_builder: "Agenda Builder",
};

const AUTONOMY_LEVELS: Record<number, string> = {
  0: "Disabled",
  1: "Suggest Only",
  2: "Suggest + Auto-apply if accepted 3x",
  3: "Auto-apply with review window",
  4: "Full Autonomy",
};

const OUTCOME_COLORS: Record<string, "green" | "yellow" | "red" | "neutral"> = {
  accepted: "green",
  overridden: "red",
  ignored: "yellow",
  pending: "neutral",
};

// ============================================================
// Types
// ============================================================

interface AgentMetrics {
  totalActions: number;
  accepted: number;
  overridden: number;
  ignored: number;
  pending: number;
  acceptanceRate: number | null;
  overrideRate: number | null;
  confidenceDistribution: { high: number; medium: number; low: number };
  overrideReasons: Array<{ reason: string; count: number }>;
  recentActions: AiAction[];
}

interface WeeklyTrend {
  weekLabel: string;
  acceptanceRate: number | null;
  total: number;
}

interface AiDashboardViewProps {
  agents: Agent[];
  actions: AiAction[];
  orgId: string;
  userId: string;
}

// ============================================================
// Utility functions
// ============================================================

function computeAgentMetrics(
  actions: AiAction[],
  agentCategory: string
): AgentMetrics {
  const agentActions = actions.filter(
    (a) => a.agent_category === agentCategory
  );

  const accepted = agentActions.filter((a) => a.outcome === "accepted").length;
  const overridden = agentActions.filter(
    (a) => a.outcome === "overridden"
  ).length;
  const ignored = agentActions.filter((a) => a.outcome === "ignored").length;
  const pending = agentActions.filter((a) => a.outcome === "pending").length;
  const nonPending = accepted + overridden + ignored;

  const acceptanceRate =
    accepted + overridden > 0
      ? Math.round((accepted / (accepted + overridden)) * 100)
      : null;

  const overrideRate =
    nonPending > 0 ? Math.round((overridden / nonPending) * 100) : null;

  // Confidence distribution
  const high = agentActions.filter((a) => a.confidence === "high").length;
  const medium = agentActions.filter((a) => a.confidence === "medium").length;
  const low = agentActions.filter((a) => a.confidence === "low").length;

  // Override reasons
  const reasonMap = new Map<string, number>();
  agentActions
    .filter((a) => a.outcome === "overridden" && a.override_reason)
    .forEach((a) => {
      const reason = a.override_reason!;
      reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
    });
  const overrideReasons = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalActions: agentActions.length,
    accepted,
    overridden,
    ignored,
    pending,
    acceptanceRate,
    overrideRate,
    confidenceDistribution: { high, medium, low },
    overrideReasons,
    recentActions: agentActions.slice(0, 10),
  };
}

function computeWeeklyTrends(actions: AiAction[]): WeeklyTrend[] {
  const now = Date.now();
  const weeks: WeeklyTrend[] = [];

  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
    const weekLabel = `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    const weekActions = actions.filter((a) => {
      const t = new Date(a.created_at).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    });

    const accepted = weekActions.filter(
      (a) => a.outcome === "accepted"
    ).length;
    const overridden = weekActions.filter(
      (a) => a.outcome === "overridden"
    ).length;

    weeks.push({
      weekLabel,
      acceptanceRate:
        accepted + overridden > 0
          ? Math.round((accepted / (accepted + overridden)) * 100)
          : null,
      total: weekActions.length,
    });
  }

  return weeks;
}

function acceptanceColor(rate: number | null): string {
  if (rate === null) return "text-subtle";
  if (rate >= 80) return "text-semantic-green";
  if (rate >= 60) return "text-semantic-ochre";
  return "text-semantic-brick";
}

// ============================================================
// Sub-components
// ============================================================

function MetricBox({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold text-subtle uppercase">{label}</p>
      <p className={`text-xl font-bold ${colorClass ?? "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function OutcomeBar({ metrics }: { metrics: AgentMetrics }) {
  const total = metrics.totalActions;
  if (total === 0) return <div className="h-3 rounded bg-line" />;

  const pctAccepted = (metrics.accepted / total) * 100;
  const pctOverridden = (metrics.overridden / total) * 100;
  const pctIgnored = (metrics.ignored / total) * 100;
  const pctPending = (metrics.pending / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded overflow-hidden">
        {pctAccepted > 0 && (
          <div
            className="bg-semantic-green"
            style={{ width: `${pctAccepted}%` }}
            title={`Accepted: ${metrics.accepted}`}
          />
        )}
        {pctOverridden > 0 && (
          <div
            className="bg-semantic-brick"
            style={{ width: `${pctOverridden}%` }}
            title={`Overridden: ${metrics.overridden}`}
          />
        )}
        {pctIgnored > 0 && (
          <div
            className="bg-semantic-ochre"
            style={{ width: `${pctIgnored}%` }}
            title={`Ignored: ${metrics.ignored}`}
          />
        )}
        {pctPending > 0 && (
          <div
            className="bg-faded/30"
            style={{ width: `${pctPending}%` }}
            title={`Pending: ${metrics.pending}`}
          />
        )}
      </div>
      <div className="flex gap-3 text-[10px] text-subtle">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-semantic-green" />
          Accepted ({metrics.accepted})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-semantic-brick" />
          Overridden ({metrics.overridden})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-semantic-ochre" />
          Ignored ({metrics.ignored})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-faded/30" />
          Pending ({metrics.pending})
        </span>
      </div>
    </div>
  );
}

function RecentActionsList({ actions }: { actions: AiAction[] }) {
  const [expanded, setExpanded] = useState(false);

  if (actions.length === 0) {
    return (
      <p className="text-sm text-subtle italic">
        No recent actions recorded.
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm font-medium text-accent hover:underline"
      >
        {expanded ? "Hide" : "Show"} Recent Actions ({actions.length})
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
          {actions.map((action) => (
            <div
              key={action.id}
              className="flex items-start gap-3 p-2 rounded-lg bg-canvas text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-subtle">
                  {new Date(action.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  &middot; {action.action_type}
                </p>
                <p className="text-ink truncate">
                  {action.output_summary}
                </p>
              </div>
              <Badge status={OUTCOME_COLORS[action.outcome] ?? "neutral"}>
                {action.outcome}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentPerformanceCard({
  agent,
  metrics,
}: {
  agent: Agent;
  metrics: AgentMetrics;
}) {
  const avgConfidence =
    metrics.totalActions > 0
      ? metrics.confidenceDistribution.high >= metrics.confidenceDistribution.medium &&
        metrics.confidenceDistribution.high >= metrics.confidenceDistribution.low
        ? "high"
        : metrics.confidenceDistribution.medium >= metrics.confidenceDistribution.low
          ? "medium"
          : "low"
      : "-";

  return (
    <Card className="border-line bg-surface overflow-hidden">
      <div className="h-2 bg-sage" />
      <CardHeader>
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-ink">{agent.name}</h3>
          <span className="inline-flex items-center rounded-full bg-sage px-2 py-0.5 text-xs font-medium text-white">
            AI
          </span>
        </div>
        <p className="text-sm text-subtle mt-0.5">
          {CATEGORY_LABELS[agent.category] ?? agent.category} &middot;{" "}
          {AUTONOMY_LEVELS[agent.automation_level] ??
            `L${agent.automation_level}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-4">
          <MetricBox label="Total Actions" value={String(metrics.totalActions)} />
          <MetricBox
            label="Acceptance"
            value={
              metrics.acceptanceRate !== null
                ? `${metrics.acceptanceRate}%`
                : "-"
            }
            colorClass={acceptanceColor(metrics.acceptanceRate)}
          />
          <MetricBox
            label="Override Rate"
            value={
              metrics.overrideRate !== null ? `${metrics.overrideRate}%` : "-"
            }
            colorClass={
              metrics.overrideRate !== null && metrics.overrideRate > 30
                ? "text-semantic-brick"
                : undefined
            }
          />
          <MetricBox label="Avg Confidence" value={avgConfidence} />
        </div>

        {/* Outcome distribution bar */}
        <OutcomeBar metrics={metrics} />

        {/* Recent actions */}
        <RecentActionsList actions={metrics.recentActions} />
      </CardContent>
    </Card>
  );
}

function OverrideAnalytics({ actions }: { actions: AiAction[] }) {
  // Group overrides by agent category
  const overridesByCategory = new Map<
    string,
    Array<{ reason: string; count: number }>
  >();

  const overrides = actions.filter(
    (a) => a.outcome === "overridden" && a.override_reason
  );
  const categoryReasons = new Map<string, Map<string, number>>();

  for (const o of overrides) {
    const cat = o.agent_category;
    if (!categoryReasons.has(cat)) categoryReasons.set(cat, new Map());
    const reasons = categoryReasons.get(cat)!;
    reasons.set(o.override_reason!, (reasons.get(o.override_reason!) ?? 0) + 1);
  }

  for (const [cat, reasons] of categoryReasons) {
    overridesByCategory.set(
      cat,
      Array.from(reasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );
  }

  const weeklyTrends = computeWeeklyTrends(actions);

  return (
    <Card className="border-line bg-surface">
      <CardHeader>
        <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">
          Override Analytics
        </h3>
        <p className="text-sm text-subtle">
          Where is the team pushing back?
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Override reasons by category */}
        {overridesByCategory.size === 0 ? (
          <p className="text-sm text-subtle italic">
            No overrides recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {Array.from(overridesByCategory.entries()).map(([cat, reasons]) => (
              <div key={cat}>
                <p className="text-sm font-semibold text-ink mb-1">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                <ul className="space-y-1">
                  {reasons.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-sm text-ink bg-canvas rounded px-3 py-1.5"
                    >
                      <span className="truncate">{r.reason}</span>
                      <span className="ml-2 font-mono text-xs text-subtle">
                        {r.count}x
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Weekly acceptance trend */}
        <div>
          <p className="text-sm font-semibold text-ink mb-2">
            Acceptance Rate — Last 4 Weeks
          </p>
          <div className="grid grid-cols-4 gap-2">
            {weeklyTrends.map((week, i) => (
              <div
                key={i}
                className="text-center p-2 rounded-lg bg-canvas"
              >
                <p className="text-[10px] text-subtle truncate">
                  {week.weekLabel}
                </p>
                <p
                  className={`text-lg font-bold ${acceptanceColor(week.acceptanceRate)}`}
                >
                  {week.acceptanceRate !== null
                    ? `${week.acceptanceRate}%`
                    : "-"}
                </p>
                <p className="text-[10px] text-subtle">
                  {week.total} actions
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AutonomyManager({
  agents,
  orgId,
  userId,
}: {
  agents: Agent[];
  orgId: string;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [confirmAgent, setConfirmAgent] = useState<Agent | null>(null);
  const [pendingLevel, setPendingLevel] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  async function handleLevelChange(agent: Agent, newLevel: number) {
    if (newLevel === agent.automation_level) return;
    setConfirmAgent(agent);
    setPendingLevel(newLevel);
  }

  async function confirmChange() {
    if (!confirmAgent) return;
    setSaving(true);

    // Update agent automation level
    await supabase
      .from("agents")
      .update({ automation_level: pendingLevel, updated_at: new Date().toISOString() })
      .eq("id", confirmAgent.id);

    // Create policy override audit trail
    await supabase.from("policy_overrides").insert({
      policy_name: "agent_autonomy_change",
      overridden_by: userId,
      justification: `Changed ${confirmAgent.name} autonomy from L${confirmAgent.automation_level} (${AUTONOMY_LEVELS[confirmAgent.automation_level]}) to L${pendingLevel} (${AUTONOMY_LEVELS[pendingLevel]})`,
      entity_id: confirmAgent.id,
      organization_id: orgId,
    });

    setSaving(false);
    setConfirmAgent(null);
    router.refresh();
  }

  return (
    <>
      <Card className="border-line bg-surface">
        <CardHeader>
          <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">
            Autonomy Management
          </h3>
          <p className="text-sm text-subtle">
            Control how much independence each AI agent has. Changes are
            audit-logged.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-3 rounded-lg bg-canvas"
              >
                <div>
                  <p className="font-medium text-ink">{agent.name}</p>
                  <p className="text-xs text-subtle">
                    Current: L{agent.automation_level} &mdash;{" "}
                    {AUTONOMY_LEVELS[agent.automation_level]}
                  </p>
                </div>
                <select
                  value={agent.automation_level}
                  onChange={(e) =>
                    handleLevelChange(agent, Number(e.target.value))
                  }
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
                >
                  {Object.entries(AUTONOMY_LEVELS).map(([level, label]) => (
                    <option key={level} value={level}>
                      L{level} - {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!confirmAgent}
        onClose={() => setConfirmAgent(null)}
        title="Confirm Autonomy Change"
        description={
          confirmAgent
            ? `Change ${confirmAgent.name} from L${confirmAgent.automation_level} to L${pendingLevel}?`
            : undefined
        }
      >
        {confirmAgent && (
          <>
            <div className="space-y-2 text-sm text-ink">
              <p>
                <span className="font-semibold">From:</span> L
                {confirmAgent.automation_level} &mdash;{" "}
                {AUTONOMY_LEVELS[confirmAgent.automation_level]}
              </p>
              <p>
                <span className="font-semibold">To:</span> L{pendingLevel}{" "}
                &mdash; {AUTONOMY_LEVELS[pendingLevel]}
              </p>
              {pendingLevel >= 3 && (
                <div className="mt-3 p-3 bg-semantic-ochre/10 rounded-lg border border-semantic-ochre/30">
                  <p className="text-sm font-medium text-semantic-ochre-text">
                    Warning: Level {pendingLevel} grants significant autonomy.
                    The agent{" "}
                    {pendingLevel === 3
                      ? "will auto-apply changes with a review window"
                      : "will operate with full autonomy"}
                    .
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmAgent(null)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={confirmChange} loading={saving}>
                Confirm Change
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </>
  );
}

// ============================================================
// Main component
// ============================================================

export function AiDashboardView({
  agents,
  actions,
  orgId,
  userId,
}: AiDashboardViewProps) {
  // Compute metrics per agent category
  const agentMetrics = useMemo(() => {
    const map = new Map<string, AgentMetrics>();
    for (const agent of agents) {
      map.set(agent.category, computeAgentMetrics(actions, agent.category));
    }
    return map;
  }, [agents, actions]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">
              AI Trust Dashboard
            </h2>
            <span className="inline-flex items-center rounded-full bg-sage px-2.5 py-0.5 text-xs font-medium text-white">
              Audit
            </span>
          </div>
          <p className="text-subtle text-sm mt-1">
            Monitor AI agent performance, acceptance rates, and manage autonomy
            levels
          </p>
        </div>
        <Link href="/admin/settings/agents">
          <Button variant="secondary" size="sm">
            Manage Agents
          </Button>
        </Link>
      </div>

      {/* Agent Performance Cards */}
      <div>
        <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-accent mb-3">
          Agent Performance
        </h3>
        <div className="space-y-4">
          {agents.map((agent) => {
            const metrics =
              agentMetrics.get(agent.category) ??
              computeAgentMetrics([], agent.category);
            return (
              <AgentPerformanceCard
                key={agent.id}
                agent={agent}
                metrics={metrics}
              />
            );
          })}
          {agents.length === 0 && (
            <p className="text-sm text-subtle italic">
              No agents configured. Visit the{" "}
              <Link href="/admin/settings/agents" className="text-accent underline">
                Agents page
              </Link>{" "}
              to set up AI agents.
            </p>
          )}
        </div>
      </div>

      {/* Override Analytics */}
      <div>
        <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-accent mb-3">
          Override Analytics
        </h3>
        <OverrideAnalytics actions={actions} />
      </div>

      {/* Autonomy Management */}
      <div>
        <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-accent mb-3">
          Autonomy Management
        </h3>
        <AutonomyManager agents={agents} orgId={orgId} userId={userId} />
      </div>
    </div>
  );
}
