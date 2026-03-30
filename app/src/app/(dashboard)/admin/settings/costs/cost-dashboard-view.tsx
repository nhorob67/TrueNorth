"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";

// ============================================================
// Types
// ============================================================

interface UsageRow {
  id: string;
  hermes_profile: string;
  agent_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  estimated_cost: number;
  task_id: string | null;
  created_at: string;
}

interface AgentInfo {
  id: string;
  name: string;
  category: string;
  hermes_profile_name: string | null;
  hermes_enabled: boolean;
}

interface BudgetPolicy {
  id: string;
  organization_id: string;
  scope: string;
  agent_id: string | null;
  period: string;
  budget_cap: number;
  alert_threshold_pct: number;
  action_on_exceed: string;
  enabled: boolean;
  created_at: string;
}

type TimePeriod = "7d" | "14d" | "30d";

interface CostDashboardViewProps {
  usageRows: UsageRow[];
  agents: AgentInfo[];
  budgetPolicies: BudgetPolicy[];
  orgId: string;
  isAdmin: boolean;
}

// ============================================================
// Helpers
// ============================================================

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function daysAgoDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const PERIOD_DAYS: Record<TimePeriod, number> = { "7d": 7, "14d": 14, "30d": 30 };

const PERIOD_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const ACTION_LABELS: Record<string, string> = {
  alert: "Alert only",
  pause: "Pause agent",
  block: "Block execution",
};

// ============================================================
// Summary Cards
// ============================================================

function SummaryCards({
  totalCost,
  totalTokens,
  totalRequests,
  avgCostPerRequest,
}: {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  avgCostPerRequest: number;
}) {
  const cards = [
    { label: "Total Spend", value: formatCost(totalCost) },
    { label: "Total Tokens", value: formatTokens(totalTokens) },
    { label: "Requests", value: String(totalRequests) },
    { label: "Avg Cost / Request", value: formatCost(avgCostPerRequest) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="py-4">
            <p className="text-xs font-mono uppercase tracking-wider text-subtle">
              {card.label}
            </p>
            <p className="text-2xl font-display font-bold text-ink mt-1">
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Per-Agent Cost Breakdown
// ============================================================

function AgentCostTable({
  profileCosts,
  agents,
  totalCost,
}: {
  profileCosts: Map<string, { cost: number; tokens: number; requests: number; models: Set<string> }>;
  agents: AgentInfo[];
  totalCost: number;
}) {
  const sorted = [...profileCosts.entries()].sort((a, b) => b[1].cost - a[1].cost);

  function agentName(profile: string): string {
    const agent = agents.find((a) => a.hermes_profile_name === profile);
    return agent?.name ?? profile;
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-ink">Cost by Agent</p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-faded">
              <th className="text-left px-4 py-2 font-normal">Agent</th>
              <th className="text-right px-4 py-2 font-normal">Cost</th>
              <th className="text-right px-4 py-2 font-normal">% of Total</th>
              <th className="text-right px-4 py-2 font-normal">Tokens</th>
              <th className="text-right px-4 py-2 font-normal">Requests</th>
              <th className="text-left px-4 py-2 font-normal">Models</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([profile, data]) => {
              const pct = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
              return (
                <tr key={profile} className="border-b border-line/50 hover:bg-hovered">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-sage px-1.5 py-0.5 text-[9px] font-mono text-white">
                        {profile}
                      </span>
                      <span className="text-ink">{agentName(profile)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-ink">{formatCost(data.cost)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-well rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-subtle w-10 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-subtle">{formatTokens(data.tokens)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-subtle">{data.requests}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {[...data.models].map((m) => (
                        <Badge key={m} status="neutral">{m.split("/").pop()}</Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-subtle">
                  No token usage recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Model Breakdown
// ============================================================

function ModelBreakdown({
  modelCosts,
  totalCost,
}: {
  modelCosts: Map<string, { cost: number; tokens: number; requests: number }>;
  totalCost: number;
}) {
  const sorted = [...modelCosts.entries()].sort((a, b) => b[1].cost - a[1].cost);

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-ink">Cost by Model</p>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-subtle">No data yet.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map(([model, data]) => {
              const pct = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
              return (
                <div key={model}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-ink font-mono text-xs">{model}</span>
                    <span className="text-subtle font-mono text-xs">
                      {formatCost(data.cost)} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-well rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-faded mt-0.5">
                    <span>{formatTokens(data.tokens)} tokens</span>
                    <span>{data.requests} requests</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Daily Spend Trend
// ============================================================

function DailySpendChart({ dailyCosts }: { dailyCosts: Map<string, number> }) {
  const sorted = [...dailyCosts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxCost = Math.max(...sorted.map(([, c]) => c), 0.01);

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-ink">Daily Spend</p>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-subtle">No data yet.</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {sorted.map(([date, cost]) => {
              const height = (cost / maxCost) * 100;
              const shortDate = date.slice(5); // MM-DD
              return (
                <div
                  key={date}
                  className="flex-1 flex flex-col items-center gap-1"
                  title={`${date}: ${formatCost(cost)}`}
                >
                  <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
                    <div
                      className="w-full bg-accent/70 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-faded -rotate-45 origin-top-left translate-y-1">
                    {shortDate}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Budget Policies Section
// ============================================================

function BudgetPoliciesSection({
  policies,
  agents,
  orgId,
  isAdmin,
}: {
  policies: BudgetPolicy[];
  agents: AgentInfo[];
  orgId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [scope, setScope] = useState<"org" | "agent">("org");
  const [agentId, setAgentId] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [budgetCap, setBudgetCap] = useState("50");
  const [threshold, setThreshold] = useState("80");
  const [action, setAction] = useState("alert");

  function agentName(id: string | null): string {
    if (!id) return "All agents (org-wide)";
    const agent = agents.find((a) => a.id === id);
    return agent?.name ?? id;
  }

  async function handleCreate() {
    setCreating(true);
    await supabase.from("agent_budget_policies").insert({
      organization_id: orgId,
      scope,
      agent_id: scope === "agent" ? agentId || null : null,
      period,
      budget_cap: parseFloat(budgetCap),
      alert_threshold_pct: parseInt(threshold),
      action_on_exceed: action,
      enabled: true,
    });
    setCreating(false);
    setShowCreate(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await supabase.from("agent_budget_policies").delete().eq("id", id);
    router.refresh();
  }

  async function handleToggle(id: string, enabled: boolean) {
    await supabase.from("agent_budget_policies").update({ enabled: !enabled }).eq("id", id);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Budget Policies</p>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Add Policy
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {policies.length === 0 && !showCreate ? (
          <p className="text-sm text-subtle">
            No budget policies configured. Add one to set spending limits.
          </p>
        ) : (
          <div className="space-y-2">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="flex items-center justify-between border border-line rounded-lg px-3 py-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge status={policy.enabled ? "green" : "neutral"}>
                      {policy.enabled ? "Active" : "Disabled"}
                    </Badge>
                    <span className="text-sm text-ink">
                      {agentName(policy.agent_id)}
                    </span>
                  </div>
                  <p className="text-xs text-subtle mt-0.5">
                    {PERIOD_LABELS[policy.period] ?? policy.period} cap: ${Number(policy.budget_cap).toFixed(2)} &middot;{" "}
                    Alert at {policy.alert_threshold_pct}% &middot;{" "}
                    {ACTION_LABELS[policy.action_on_exceed] ?? policy.action_on_exceed}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(policy.id, policy.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        policy.enabled ? "bg-accent" : "bg-well"
                      } cursor-pointer`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          policy.enabled ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => handleDelete(policy.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create policy dialog */}
        {showCreate && (
          <Dialog
            open={showCreate}
            onClose={() => setShowCreate(false)}
            title="Create Budget Policy"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "org" | "agent")}
                  className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
                >
                  <option value="org">Organization-wide</option>
                  <option value="agent">Per agent</option>
                </select>
              </div>

              {scope === "agent" && (
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Agent</label>
                  <select
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
                  >
                    <option value="">Select agent...</option>
                    {agents.filter((a) => a.hermes_enabled).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink mb-1">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">Budget Cap ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budgetCap}
                  onChange={(e) => setBudgetCap(e.target.value)}
                  className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">Alert Threshold (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">Action on Exceed</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
                >
                  <option value="alert">Alert only (continue execution)</option>
                  <option value="pause">Pause agent</option>
                  <option value="block">Block execution</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || (scope === "agent" && !agentId)}
              >
                {creating ? "Creating..." : "Create Policy"}
              </Button>
            </DialogFooter>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Dashboard View
// ============================================================

export function CostDashboardView({
  usageRows,
  agents,
  budgetPolicies,
  orgId,
  isAdmin,
}: CostDashboardViewProps) {
  const [period, setPeriod] = useState<TimePeriod>("30d");

  // Filter rows by selected period
  const filteredRows = useMemo(() => {
    const cutoff = daysAgoDate(PERIOD_DAYS[period]);
    return usageRows.filter((r) => new Date(r.created_at) >= cutoff);
  }, [usageRows, period]);

  // Compute aggregates
  const { totalCost, totalTokens, totalRequests, profileCosts, modelCosts, dailyCosts } = useMemo(() => {
    let cost = 0;
    let tokens = 0;
    const profiles = new Map<string, { cost: number; tokens: number; requests: number; models: Set<string> }>();
    const models = new Map<string, { cost: number; tokens: number; requests: number }>();
    const daily = new Map<string, number>();

    for (const row of filteredRows) {
      const rowCost = Number(row.estimated_cost);
      const rowTokens = row.input_tokens + row.output_tokens;
      cost += rowCost;
      tokens += rowTokens;

      // Per profile
      const profileData = profiles.get(row.hermes_profile) ?? { cost: 0, tokens: 0, requests: 0, models: new Set<string>() };
      profileData.cost += rowCost;
      profileData.tokens += rowTokens;
      profileData.requests += 1;
      profileData.models.add(row.model);
      profiles.set(row.hermes_profile, profileData);

      // Per model
      const modelData = models.get(row.model) ?? { cost: 0, tokens: 0, requests: 0 };
      modelData.cost += rowCost;
      modelData.tokens += rowTokens;
      modelData.requests += 1;
      models.set(row.model, modelData);

      // Per day
      const dateKey = row.created_at.slice(0, 10);
      daily.set(dateKey, (daily.get(dateKey) ?? 0) + rowCost);
    }

    return {
      totalCost: cost,
      totalTokens: tokens,
      totalRequests: filteredRows.length,
      profileCosts: profiles,
      modelCosts: models,
      dailyCosts: daily,
    };
  }, [filteredRows]);

  const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">
            Token Costs
          </h2>
          <p className="text-subtle text-sm mt-1">
            Monitor agent token usage, model costs, and budget policies
          </p>
        </div>
        <div className="flex items-center gap-1 bg-well rounded-lg p-0.5">
          {(["7d", "14d", "30d"] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                period === p
                  ? "bg-surface text-ink shadow-sm"
                  : "text-subtle hover:text-ink"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <SummaryCards
        totalCost={totalCost}
        totalTokens={totalTokens}
        totalRequests={totalRequests}
        avgCostPerRequest={avgCostPerRequest}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DailySpendChart dailyCosts={dailyCosts} />
        </div>
        <ModelBreakdown modelCosts={modelCosts} totalCost={totalCost} />
      </div>

      {/* Agent breakdown */}
      <AgentCostTable
        profileCosts={profileCosts}
        agents={agents}
        totalCost={totalCost}
      />

      {/* Budget policies */}
      <BudgetPoliciesSection
        policies={budgetPolicies}
        agents={agents}
        orgId={orgId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
