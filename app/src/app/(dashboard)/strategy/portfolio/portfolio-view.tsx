"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VenturePortfolioData {
  id: string;
  name: string;
  activeBetsCount: number;
  betsHealthDistribution: { green: number; yellow: number; red: number };
  redYellowKpiCount: number;
  openBlockerCount: number;
  highSeverityBlockerCount: number;
  todayPulseCount: number;
  totalMembers: number;
  topAlert: {
    type: "blocker" | "kpi" | "bet";
    label: string;
    severity: "red" | "yellow";
  } | null;
}

interface CrossVentureBlocker {
  id: string;
  description: string;
  severity: string;
  created_at: string;
  venture_name: string;
  venture_id: string;
}

interface CrossVentureCommitment {
  id: string;
  description: string;
  due_date: string | null;
  status: string;
  venture_name: string;
  venture_id: string;
}

interface CrossVentureDecision {
  id: string;
  title: string;
  created_at: string;
  venture_name: string;
  venture_id: string;
}

interface CrossVenturePulse {
  user_id: string;
  user_name: string;
  date: string;
  venture_name: string;
  venture_id: string;
}

interface PortfolioViewProps {
  ventures: VenturePortfolioData[];
  crossBlockers: CrossVentureBlocker[];
  crossCommitments: CrossVentureCommitment[];
  crossDecisions: CrossVentureDecision[];
  crossPulses: CrossVenturePulse[];
  ventureList: Array<{ id: string; name: string }>;
}

type TabKey = "blockers" | "commitments" | "decisions" | "pulses";

function computeAggregateHealth(v: VenturePortfolioData): "green" | "yellow" | "red" {
  if (
    v.betsHealthDistribution.red > 0 ||
    v.redYellowKpiCount > 0 && v.openBlockerCount > 2
  ) {
    return "red";
  }
  if (
    v.betsHealthDistribution.yellow > 0 ||
    v.redYellowKpiCount > 0 ||
    v.openBlockerCount > 0
  ) {
    return "yellow";
  }
  return "green";
}

const healthDotColor: Record<"green" | "yellow" | "red", string> = {
  green: "bg-semantic-green",
  yellow: "bg-semantic-ochre",
  red: "bg-semantic-brick",
};

const healthTextColor: Record<"green" | "yellow" | "red", string> = {
  green: "text-semantic-green",
  yellow: "text-semantic-ochre",
  red: "text-semantic-brick",
};

const healthLabel: Record<"green" | "yellow" | "red", string> = {
  green: "On Track",
  yellow: "Needs Attention",
  red: "At Risk",
};

function HealthDistributionBar({ dist }: { dist: { green: number; yellow: number; red: number } }) {
  const total = dist.green + dist.yellow + dist.red;
  if (total === 0) return <span className="text-xs text-subtle">No bets</span>;

  const greenPct = (dist.green / total) * 100;
  const yellowPct = (dist.yellow / total) * 100;
  const redPct = (dist.red / total) * 100;

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 rounded-full bg-line overflow-hidden flex">
        {greenPct > 0 && (
          <div className="h-full bg-semantic-green" style={{ width: `${greenPct}%` }} />
        )}
        {yellowPct > 0 && (
          <div className="h-full bg-semantic-ochre" style={{ width: `${yellowPct}%` }} />
        )}
        {redPct > 0 && (
          <div className="h-full bg-semantic-brick" style={{ width: `${redPct}%` }} />
        )}
      </div>
      <span className="text-xs font-mono text-subtle whitespace-nowrap">
        {dist.green}/{dist.yellow}/{dist.red}
      </span>
    </div>
  );
}

function VentureBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent">
      {name}
    </span>
  );
}

export function PortfolioView({
  ventures,
  crossBlockers,
  crossCommitments,
  crossDecisions,
  crossPulses,
  ventureList,
}: PortfolioViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("blockers");
  const [pulseFilter, setPulseFilter] = useState<string>("all");
  const [switching, setSwitching] = useState<string | null>(null);

  async function handleVentureClick(ventureId: string) {
    setSwitching(ventureId);
    try {
      const res = await fetch("/api/ventures/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventureId }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setSwitching(null);
    }
  }

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "blockers", label: "Blockers", count: crossBlockers.length },
    { key: "commitments", label: "Commitments", count: crossCommitments.length },
    { key: "decisions", label: "Decisions", count: crossDecisions.length },
    { key: "pulses", label: "Pulses", count: crossPulses.length },
  ];

  const filteredPulses =
    pulseFilter === "all"
      ? crossPulses
      : crossPulses.filter((p) => p.venture_id === pulseFilter);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Portfolio Overview</h1>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
          {ventures.length} ventures
        </span>
      </div>

      {/* Venture Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {ventures.map((v) => {
          const health = computeAggregateHealth(v);
          const pulseRate =
            v.totalMembers > 0
              ? Math.round((v.todayPulseCount / v.totalMembers) * 100)
              : 0;

          return (
            <Card
              key={v.id}
              className="cursor-pointer transition-all hover:shadow-lg"
              onClick={() => handleVentureClick(v.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-accent">{v.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${healthDotColor[health]}`} />
                    <span className={`text-sm font-medium ${healthTextColor[health]}`}>
                      {healthLabel[health]}
                    </span>
                  </div>
                </div>
                {switching === v.id && (
                  <p className="text-xs text-subtle mt-1">Switching...</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Active Bets */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-subtle uppercase tracking-wider">
                        Active Bets
                      </span>
                      <span className="text-xs font-mono text-ink">{v.activeBetsCount}</span>
                    </div>
                    <HealthDistributionBar dist={v.betsHealthDistribution} />
                  </div>

                  {/* KPI Alerts */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-subtle uppercase tracking-wider">
                      KPI Alerts
                    </span>
                    <span
                      className={`text-sm font-mono ${
                        v.redYellowKpiCount > 0 ? "text-semantic-brick" : "text-semantic-green"
                      }`}
                    >
                      {v.redYellowKpiCount}
                    </span>
                  </div>

                  {/* Open Blockers */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-subtle uppercase tracking-wider">
                      Open Blockers
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-mono ${
                          v.openBlockerCount > 0 ? "text-semantic-brick" : "text-semantic-green"
                        }`}
                      >
                        {v.openBlockerCount}
                      </span>
                      {v.highSeverityBlockerCount > 0 && (
                        <span className="text-[10px] font-semibold uppercase text-semantic-brick bg-semantic-brick/10 px-1.5 py-0.5 rounded">
                          {v.highSeverityBlockerCount} critical
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pulse Rate */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-subtle uppercase tracking-wider">
                      Pulse Rate
                    </span>
                    <span className="text-sm font-mono text-ink">
                      {v.todayPulseCount}/{v.totalMembers} pulsed today
                      <span className="text-subtle ml-1">({pulseRate}%)</span>
                    </span>
                  </div>

                  {/* Top Alert */}
                  {v.topAlert && (
                    <div className="pt-2 border-t border-line">
                      <div className="flex items-center gap-2">
                        <Badge status={v.topAlert.severity === "red" ? "red" : "yellow"}>
                          {v.topAlert.type}
                        </Badge>
                        <span className="text-xs text-ink truncate">
                          {v.topAlert.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cross-Venture Aggregations */}
      <div>
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] mb-4">Cross-Venture View</h2>

        {/* Tab Bar */}
        <div className="flex border-b border-line mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-accent text-accent"
                  : "border-transparent text-subtle hover:text-ink hover:border-line"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs font-mono">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <Card>
          <CardContent>
            {activeTab === "blockers" && (
              <div className="space-y-3">
                {crossBlockers.length === 0 ? (
                  <p className="text-sm text-subtle">No open blockers across ventures</p>
                ) : (
                  crossBlockers.map((b) => (
                    <div key={b.id} className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <VentureBadge name={b.venture_name} />
                          <span className="text-[10px] font-semibold uppercase text-subtle">
                            {b.severity}
                          </span>
                        </div>
                        <p className="text-sm text-ink">{b.description}</p>
                        <p className="text-xs text-subtle">
                          Opened {new Date(b.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "commitments" && (
              <div className="space-y-3">
                {crossCommitments.length === 0 ? (
                  <p className="text-sm text-subtle">No pending commitments across ventures</p>
                ) : (
                  crossCommitments.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <VentureBadge name={c.venture_name} />
                          {c.status === "overdue" && (
                            <span className="text-[10px] font-semibold uppercase text-semantic-brick bg-semantic-brick/10 px-1.5 py-0.5 rounded">
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink">{c.description}</p>
                        {c.due_date && (
                          <p className="text-xs text-subtle">
                            Due {new Date(c.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "decisions" && (
              <div className="space-y-3">
                {crossDecisions.length === 0 ? (
                  <p className="text-sm text-subtle">No undecided decisions across ventures</p>
                ) : (
                  crossDecisions.map((d) => (
                    <div key={d.id} className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <VentureBadge name={d.venture_name} />
                        </div>
                        <p className="text-sm font-medium text-ink">{d.title}</p>
                        <p className="text-xs text-subtle">
                          Opened {new Date(d.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "pulses" && (
              <div>
                {/* Venture filter dropdown */}
                <div className="mb-3">
                  <select
                    value={pulseFilter}
                    onChange={(e) => setPulseFilter(e.target.value)}
                    className="text-sm border border-line rounded-lg px-3 py-1.5 bg-surface text-ink"
                  >
                    <option value="all">All Ventures</option>
                    {ventureList.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  {filteredPulses.length === 0 ? (
                    <p className="text-sm text-subtle">No pulses today</p>
                  ) : (
                    filteredPulses.map((p) => (
                      <div key={`${p.user_id}-${p.venture_id}`} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-semantic-green" />
                        <span className="text-sm text-ink">{p.user_name}</span>
                        <VentureBadge name={p.venture_name} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
