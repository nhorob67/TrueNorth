"use client";

import { useState, useCallback } from "react";
import { OperatingHealthReport, OperatingHealthMetric, HealthStatus } from "@/types/database";

// ============================================================
// Types
// ============================================================

interface HealthViewProps {
  report: OperatingHealthReport;
  snapshots: Array<{
    composite_score: number;
    composite_status: string;
    ai_interpretation: string | null;
    created_at: string;
  }>;
  latestInterpretation: string | null;
  isSingleVenture: boolean;
  ventures: Array<{ id: string; name: string }>;
  currentVentureId: string;
}

type MetricKey =
  | "decision_velocity"
  | "blocker_half_life"
  | "strategy_connection_rate"
  | "execution_cadence_health"
  | "cross_venture_collaboration"
  | "kill_courage";

type DateRangeOption = "4w" | "quarter" | "6m" | "custom";

const DATE_RANGE_CONFIG: Record<DateRangeOption, { label: string; days: number }> = {
  "4w": { label: "Last 4 weeks", days: 28 },
  quarter: { label: "Last quarter", days: 90 },
  "6m": { label: "Last 6 months", days: 180 },
  custom: { label: "Custom", days: 30 },
};

// ============================================================
// Shared UI
// ============================================================

const statusColors: Record<HealthStatus, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-semantic-green/10", text: "text-semantic-green", dot: "bg-semantic-green" },
  yellow: { bg: "bg-semantic-ochre/10", text: "text-semantic-ochre", dot: "bg-semantic-ochre" },
  red: { bg: "bg-semantic-brick/10", text: "text-semantic-brick", dot: "bg-semantic-brick" },
};

const trendIcons: Record<string, string> = {
  improving: "\u2191",
  declining: "\u2193",
  stable: "\u2192",
};

function Sparkline({ data, status }: { data: number[]; status: HealthStatus }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 120;
  const height = 32;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const color = status === "green" ? "var(--color-semantic-green)" : status === "yellow" ? "var(--color-semantic-ochre)" : "var(--color-semantic-brick)";

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================
// MetricCard
// ============================================================

function MetricCard({
  metric,
  hideIfZero,
  isExpanded,
  onClick,
}: {
  metric: OperatingHealthMetric;
  hideIfZero?: boolean;
  isExpanded: boolean;
  onClick: () => void;
}) {
  if (hideIfZero && metric.value === 0 && metric.sparkline.every((v) => v === 0)) return null;

  const colors = statusColors[metric.status];

  return (
    <button
      onClick={onClick}
      className={`bg-surface border rounded-xl p-5 flex flex-col gap-3 text-left transition-all cursor-pointer hover:shadow-md ${
        isExpanded ? "border-accent ring-2 ring-accent/20" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{metric.label}</h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            {metric.status}
          </span>
          <svg
            className={`w-4 h-4 text-subtle transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-bold font-mono text-ink">{metric.value}</p>
          <p className="text-xs text-subtle mt-1">{metric.unit}</p>
        </div>
        <Sparkline data={metric.sparkline} status={metric.status} />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={
            metric.trend === "improving"
              ? "text-semantic-green"
              : metric.trend === "declining"
                ? "text-semantic-brick"
                : "text-subtle"
          }
        >
          {trendIcons[metric.trend]} {metric.trend}
        </span>
        {metric.trend_delta !== 0 && (
          <span className="text-subtle">
            ({metric.trend_delta > 0 ? "+" : ""}
            {metric.trend_delta} pts)
          </span>
        )}
      </div>
    </button>
  );
}

// ============================================================
// Drill-Down: Decision Velocity
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

function DecisionVelocityDrillDown({ data }: { data: any }) {
  if (!data) return <DrillDownLoading />;
  const { histogram, slowest_open, per_person_averages } = data;

  const maxBucket = Math.max(...Object.values(histogram as Record<string, number>), 1);

  return (
    <div className="space-y-6">
      {/* Histogram */}
      <div>
        <h4 className="text-sm font-semibold text-accent mb-3">Decision Time Distribution</h4>
        <div className="flex items-end gap-3 h-32">
          {Object.entries(histogram as Record<string, number>).map(([bucket, count]) => (
            <div key={bucket} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-mono text-ink">{count}</span>
              <div className="w-full bg-line/30 rounded-t-md relative" style={{ height: "100px" }}>
                <div
                  className="absolute bottom-0 w-full bg-accent/70 rounded-t-md transition-all"
                  style={{ height: `${maxBucket > 0 ? (count / maxBucket) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-subtle">{bucket}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Slowest Open Decisions */}
        <div>
          <h4 className="text-sm font-semibold text-accent mb-3">Slowest Open Decisions</h4>
          {slowest_open.length === 0 ? (
            <p className="text-sm text-subtle">No open decisions</p>
          ) : (
            <div className="space-y-2">
              {slowest_open.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-canvas rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{d.title}</p>
                    <p className="text-xs text-subtle">{d.assigned_to}</p>
                  </div>
                  <span
                    className={`text-xs font-mono font-semibold flex-shrink-0 ml-2 ${
                      d.days_open > 7 ? "text-semantic-brick" : d.days_open > 3 ? "text-semantic-ochre" : "text-ink"
                    }`}
                  >
                    {d.days_open}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per-Person Averages */}
        <div>
          <h4 className="text-sm font-semibold text-accent mb-3">Per-Person Averages</h4>
          {per_person_averages.length === 0 ? (
            <p className="text-sm text-subtle">No data</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-subtle border-b border-line">
                  <th className="text-left pb-2">Person</th>
                  <th className="text-right pb-2">Avg Days</th>
                  <th className="text-right pb-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {per_person_averages.map((p: any) => (
                  <tr key={p.user_id} className="border-b border-line/50">
                    <td className="py-1.5 text-ink">{p.name}</td>
                    <td className="py-1.5 text-right font-mono text-ink">{p.avg_days}d</td>
                    <td className="py-1.5 text-right font-mono text-subtle">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Drill-Down: Blocker Half-Life
// ============================================================

function BlockerHalfLifeDrillDown({ data }: { data: any }) {
  if (!data) return <DrillDownLoading />;
  const { severity_breakdown, longest_open, per_person_speed } = data;

  const severityColors: Record<string, string> = {
    critical: "bg-semantic-brick",
    high: "bg-semantic-ochre",
    medium: "bg-accent",
    low: "bg-sage",
  };

  const maxAvg = Math.max(...severity_breakdown.map((s: any) => s.avg_days), 1);

  return (
    <div className="space-y-6">
      {/* Severity Bars */}
      <div>
        <h4 className="text-sm font-semibold text-accent mb-3">Resolution Time by Severity</h4>
        <div className="space-y-3">
          {severity_breakdown.map((s: any) => (
            <div key={s.severity} className="flex items-center gap-3">
              <span className="text-xs text-ink w-16 capitalize">{s.severity}</span>
              <div className="flex-1 h-6 bg-line/30 rounded-md relative overflow-hidden">
                <div
                  className={`h-full rounded-md ${severityColors[s.severity] ?? "bg-accent"} opacity-70`}
                  style={{ width: `${maxAvg > 0 ? (s.avg_days / maxAvg) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-mono text-ink w-16 text-right">
                {s.avg_days}d avg
              </span>
              <span className="text-xs text-subtle w-8 text-right">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Longest Open */}
        <div>
          <h4 className="text-sm font-semibold text-accent mb-3">Longest-Open Blockers</h4>
          {longest_open.length === 0 ? (
            <p className="text-sm text-subtle">No open blockers</p>
          ) : (
            <div className="space-y-2">
              {longest_open.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-canvas rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                          b.severity === "critical"
                            ? "bg-semantic-brick/10 text-semantic-brick"
                            : b.severity === "high"
                              ? "bg-semantic-ochre/10 text-semantic-ochre"
                              : "bg-line text-subtle"
                        }`}
                      >
                        {b.severity}
                      </span>
                      <p className="text-sm text-ink truncate">{b.title}</p>
                    </div>
                    <p className="text-xs text-subtle mt-0.5">{b.owner}</p>
                  </div>
                  <span
                    className={`text-xs font-mono font-semibold flex-shrink-0 ml-2 ${
                      b.days_open > 14 ? "text-semantic-brick" : b.days_open > 7 ? "text-semantic-ochre" : "text-ink"
                    }`}
                  >
                    {b.days_open}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per-Person Speed */}
        <div>
          <h4 className="text-sm font-semibold text-accent mb-3">Resolution Speed by Person</h4>
          {per_person_speed.length === 0 ? (
            <p className="text-sm text-subtle">No data</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-subtle border-b border-line">
                  <th className="text-left pb-2">Person</th>
                  <th className="text-right pb-2">Avg Days</th>
                  <th className="text-right pb-2">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {per_person_speed.map((p: any) => (
                  <tr key={p.user_id} className="border-b border-line/50">
                    <td className="py-1.5 text-ink">{p.name}</td>
                    <td className="py-1.5 text-right font-mono text-ink">{p.avg_days}d</td>
                    <td className="py-1.5 text-right font-mono text-subtle">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Drill-Down: Strategy Connection Rate
// ============================================================

function StrategyConnectionDrillDown({ data }: { data: any }) {
  if (!data) return <DrillDownLoading />;
  const { team_heatmap, daily_trend } = data;

  return (
    <div className="space-y-6">
      {/* Team Heatmap */}
      <div>
        <h4 className="text-sm font-semibold text-accent mb-3">Team Connection Heatmap</h4>
        {team_heatmap.length === 0 ? (
          <p className="text-sm text-subtle">No pulse data in this window</p>
        ) : (
          <div className="space-y-2">
            {team_heatmap.map((u: any) => {
              const barColor =
                u.connection_rate >= 75
                  ? "bg-semantic-green"
                  : u.connection_rate >= 50
                    ? "bg-semantic-ochre"
                    : "bg-semantic-brick";
              return (
                <div key={u.user_id} className="flex items-center gap-3">
                  <span className="text-sm text-ink w-28 truncate">{u.name}</span>
                  <div className="flex-1 h-5 bg-line/30 rounded-md relative overflow-hidden">
                    <div
                      className={`h-full rounded-md ${barColor} opacity-70`}
                      style={{ width: `${u.connection_rate}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-ink w-12 text-right">
                    {u.connection_rate}%
                  </span>
                  <span className="text-xs text-subtle w-20 text-right">
                    {u.linked_items}/{u.total_items}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily Trend */}
      {daily_trend.length > 1 && (
        <div>
          <h4 className="text-sm font-semibold text-accent mb-3">Daily Connection Trend</h4>
          <DailyTrendChart data={daily_trend} />
        </div>
      )}
    </div>
  );
}

function DailyTrendChart({ data }: { data: Array<{ date: string; rate: number }> }) {
  const width = 600;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxRate = Math.max(...data.map((d) => d.rate), 100);
  const points = data
    .map((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
      const y = padding.top + chartH - (d.rate / maxRate) * chartH;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-32">
      {/* Y-axis labels */}
      <text x={padding.left - 5} y={padding.top + 4} textAnchor="end" className="fill-warm-gray text-[10px]">
        {maxRate}%
      </text>
      <text x={padding.left - 5} y={padding.top + chartH + 4} textAnchor="end" className="fill-warm-gray text-[10px]">
        0%
      </text>
      {/* Grid lines */}
      <line
        x1={padding.left}
        y1={padding.top + chartH / 2}
        x2={width - padding.right}
        y2={padding.top + chartH / 2}
        stroke="var(--color-chart-line)"
        strokeWidth={0.5}
        strokeDasharray="4,4"
      />
      {/* Line */}
      <polyline points={points} fill="none" stroke="var(--color-semantic-green)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* X-axis labels (first and last) */}
      {data.length > 0 && (
        <>
          <text x={padding.left} y={height - 2} textAnchor="start" className="fill-warm-gray text-[9px]">
            {data[0].date.slice(5)}
          </text>
          <text x={width - padding.right} y={height - 2} textAnchor="end" className="fill-warm-gray text-[9px]">
            {data[data.length - 1].date.slice(5)}
          </text>
        </>
      )}
    </svg>
  );
}

// ============================================================
// Drill-Down: Execution Cadence
// ============================================================

function ExecutionCadenceDrillDown({ data }: { data: any }) {
  if (!data) return <DrillDownLoading />;
  const { breakdown, missed_cadence_log } = data;

  const cadences = [
    { key: "pulse_rate", label: "Pulse Submission", value: breakdown.pulse_rate },
    { key: "kpi_update_rate", label: "KPI Updates", value: breakdown.kpi_update_rate },
    { key: "sync_attendance_rate", label: "Sync Attendance", value: breakdown.sync_attendance_rate },
    { key: "commitment_completion_rate", label: "Commitment Completion", value: breakdown.commitment_completion_rate },
  ];

  return (
    <div className="space-y-6">
      {/* Per-Cadence Breakdown */}
      <div>
        <h4 className="text-sm font-semibold text-accent mb-3">Cadence Breakdown</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cadences.map((c) => {
            const barColor =
              c.value >= 75 ? "bg-semantic-green" : c.value >= 50 ? "bg-semantic-ochre" : "bg-semantic-brick";
            return (
              <div key={c.key} className="bg-canvas rounded-lg p-3">
                <p className="text-xs text-subtle mb-2">{c.label}</p>
                <p className="text-2xl font-bold font-mono text-ink">{c.value}%</p>
                <div className="mt-2 h-1.5 bg-line/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${c.value}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Missed Cadence Log */}
      <div>
        <h4 className="text-sm font-semibold text-accent mb-3">Missed Commitments</h4>
        {missed_cadence_log.length === 0 ? (
          <p className="text-sm text-subtle">No missed commitments in this window</p>
        ) : (
          <div className="space-y-2">
            {missed_cadence_log.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-canvas rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{m.title}</p>
                  <p className="text-xs text-subtle">{m.owner}</p>
                </div>
                <span className="text-xs font-mono text-semantic-brick flex-shrink-0 ml-2">
                  due {m.due_date ? new Date(m.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Drill-Down: Cross-Venture Collaboration
// ============================================================

function CrossVentureDrillDown({ data }: { data: any }) {
  if (!data) return <DrillDownLoading />;
  const { top_collaborators, all_commenters } = data;

  return (
    <div className="space-y-6">
      {/* Top Cross-Venture Collaborators */}
      <div>
        <h4 className="text-sm font-semibold text-accent mb-3">Top Cross-Venture Collaborators</h4>
        {top_collaborators.length === 0 ? (
          <p className="text-sm text-subtle">No cross-venture collaboration detected</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {top_collaborators.map((c: any) => (
              <div key={c.user_id} className="bg-canvas rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-semibold">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                  <p className="text-xs text-subtle">
                    {c.ventures_touched} ventures, {c.comment_count} comments
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Commenters Table */}
      <div>
        <h4 className="text-sm font-semibold text-accent mb-3">Cross-Venture Activity</h4>
        {all_commenters.length === 0 ? (
          <p className="text-sm text-subtle">No data</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-subtle border-b border-line">
                <th className="text-left pb-2">Person</th>
                <th className="text-right pb-2">Ventures</th>
                <th className="text-right pb-2">Comments</th>
              </tr>
            </thead>
            <tbody>
              {all_commenters.map((c: any) => (
                <tr key={c.user_id} className="border-b border-line/50">
                  <td className="py-1.5 text-ink">{c.name}</td>
                  <td className="py-1.5 text-right font-mono text-ink">{c.ventures_touched}</td>
                  <td className="py-1.5 text-right font-mono text-subtle">{c.comment_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Drill-Down: Kill Courage
// ============================================================

function KillCourageDrillDown({ data }: { data: any }) {
  if (!data) return <DrillDownLoading />;
  const { timeline, summary } = data;

  const actionColors: Record<string, { bg: string; text: string; label: string }> = {
    killed: { bg: "bg-semantic-brick/10", text: "text-semantic-brick", label: "Killed" },
    completed: { bg: "bg-semantic-green/10", text: "text-semantic-green", label: "Completed" },
    active: { bg: "bg-semantic-ochre/10", text: "text-semantic-ochre", label: "Active" },
  };

  const healthDot: Record<string, string> = {
    green: "bg-semantic-green",
    yellow: "bg-semantic-ochre",
    red: "bg-semantic-brick",
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="flex gap-4">
        <div className="bg-canvas rounded-lg p-3 flex-1 text-center">
          <p className="text-2xl font-bold font-mono text-semantic-brick">{summary.killed_count}</p>
          <p className="text-xs text-subtle">Killed</p>
        </div>
        <div className="bg-canvas rounded-lg p-3 flex-1 text-center">
          <p className="text-2xl font-bold font-mono text-semantic-green">{summary.completed_count}</p>
          <p className="text-xs text-subtle">Completed</p>
        </div>
        <div className="bg-canvas rounded-lg p-3 flex-1 text-center">
          <p className="text-2xl font-bold font-mono text-semantic-ochre">{summary.limping_count}</p>
          <p className="text-xs text-subtle">Limping</p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h4 className="text-sm font-semibold text-accent mb-3">Decision Timeline</h4>
        {timeline.length === 0 ? (
          <p className="text-sm text-subtle">No bet decisions in this period</p>
        ) : (
          <div className="space-y-2">
            {timeline.map((t: any) => {
              const colors = actionColors[t.action] ?? actionColors.active;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 bg-canvas rounded-lg px-3 py-2"
                >
                  <span className="text-xs font-mono text-subtle w-20 flex-shrink-0">
                    {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${healthDot[t.health_at_decision] ?? "bg-faded"}`} />
                  <p className="text-sm text-ink truncate flex-1">{t.title}</p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                  >
                    {colors.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================
// Drill-Down Loading State
// ============================================================

function DrillDownLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <span className="w-5 h-5 border-2 border-line border-t-moss rounded-full animate-spin" />
      <span className="ml-2 text-sm text-subtle">Loading drill-down data...</span>
    </div>
  );
}

// ============================================================
// Drill-Down Panel Router
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DrillDownPanel({ metricKey, data }: { metricKey: MetricKey; data: any }) {
  switch (metricKey) {
    case "decision_velocity":
      return <DecisionVelocityDrillDown data={data} />;
    case "blocker_half_life":
      return <BlockerHalfLifeDrillDown data={data} />;
    case "strategy_connection_rate":
      return <StrategyConnectionDrillDown data={data} />;
    case "execution_cadence_health":
      return <ExecutionCadenceDrillDown data={data} />;
    case "cross_venture_collaboration":
      return <CrossVentureDrillDown data={data} />;
    case "kill_courage":
      return <KillCourageDrillDown data={data} />;
    default:
      return null;
  }
}

// ============================================================
// Main View
// ============================================================

export function HealthView({
  report: initialReport,
  snapshots,
  latestInterpretation,
  isSingleVenture,
  ventures,
  currentVentureId,
}: HealthViewProps) {
  const [report, setReport] = useState(initialReport);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState(latestInterpretation);
  const [expandedMetric, setExpandedMetric] = useState<MetricKey | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [drillDownData, setDrillDownData] = useState<Record<string, any>>({});
  const [drillDownLoading, setDrillDownLoading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>("4w");
  const [customDays, setCustomDays] = useState(30);
  const [selectedVentureId, setSelectedVentureId] = useState(currentVentureId);
  const [refreshing, setRefreshing] = useState(false);

  const windowDays = dateRange === "custom" ? customDays : DATE_RANGE_CONFIG[dateRange].days;

  // Refetch report when date range or venture changes
  const refetchReport = useCallback(async (days: number, ventureId: string) => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/health/compute?windowDays=${days}&ventureId=${ventureId}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error("Failed to refresh health:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (range: DateRangeOption) => {
      setDateRange(range);
      const days = range === "custom" ? customDays : DATE_RANGE_CONFIG[range].days;
      setExpandedMetric(null);
      setDrillDownData({});
      refetchReport(days, selectedVentureId);
    },
    [customDays, selectedVentureId, refetchReport]
  );

  // Handle venture change
  const handleVentureChange = useCallback(
    (ventureId: string) => {
      setSelectedVentureId(ventureId);
      setExpandedMetric(null);
      setDrillDownData({});
      refetchReport(windowDays, ventureId);
    },
    [windowDays, refetchReport]
  );

  // Handle custom days change
  const handleCustomDaysCommit = useCallback(() => {
    if (dateRange === "custom") {
      setExpandedMetric(null);
      setDrillDownData({});
      refetchReport(customDays, selectedVentureId);
    }
  }, [dateRange, customDays, selectedVentureId, refetchReport]);

  // Fetch drill-down data
  const fetchDrillDown = useCallback(
    async (metricKey: MetricKey) => {
      const cacheKey = `${metricKey}_${windowDays}_${selectedVentureId}`;
      if (drillDownData[cacheKey]) return;

      setDrillDownLoading(metricKey);
      try {
        const params = new URLSearchParams({
          metric: metricKey,
          windowDays: String(windowDays),
          ventureId: selectedVentureId,
        });
        const res = await fetch(`/api/health/drill-down?${params}`);
        if (res.ok) {
          const result = await res.json();
          setDrillDownData((prev) => ({ ...prev, [cacheKey]: result.data }));
        }
      } catch (err) {
        console.error("Failed to fetch drill-down:", err);
      } finally {
        setDrillDownLoading(null);
      }
    },
    [windowDays, selectedVentureId, drillDownData]
  );

  // Toggle metric expansion
  const handleMetricClick = useCallback(
    (metricKey: MetricKey) => {
      if (expandedMetric === metricKey) {
        setExpandedMetric(null);
      } else {
        setExpandedMetric(metricKey);
        fetchDrillDown(metricKey);
      }
    },
    [expandedMetric, fetchDrillDown]
  );

  const requestInterpretation = useCallback(async () => {
    setInterpreting(true);
    try {
      const res = await fetch("/api/health/interpret", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setInterpretation(data.interpretation?.interpretation ?? null);
      }
    } catch (err) {
      console.error("Failed to interpret:", err);
    } finally {
      setInterpreting(false);
    }
  }, []);

  const compositeColors = statusColors[report.composite_status];
  const metrics = Object.values(report.metrics);
  const metricKeys = Object.keys(report.metrics) as MetricKey[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">Operating Health</h1>
        <p className="text-sm text-subtle mt-1">
          Behavioral culture metrics derived from what your team does, not what they say.
        </p>
      </div>

      {/* Controls Row: Date Range + Venture Filter */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range Selector */}
        <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-1">
          {(Object.keys(DATE_RANGE_CONFIG) as DateRangeOption[]).map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key !== "custom") handleDateRangeChange(key);
                else setDateRange("custom");
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dateRange === key
                  ? "bg-accent text-white"
                  : "text-ink hover:bg-canvas"
              }`}
            >
              {DATE_RANGE_CONFIG[key].label}
            </button>
          ))}
        </div>

        {/* Custom days input */}
        {dateRange === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={7}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 30)}
              onBlur={handleCustomDaysCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomDaysCommit();
              }}
              className="w-20 px-2 py-1.5 text-xs font-mono border border-line rounded-md bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent-glow"
            />
            <span className="text-xs text-subtle">days</span>
          </div>
        )}

        {/* Venture Filter */}
        {!isSingleVenture && ventures.length > 1 && (
          <select
            value={selectedVentureId}
            onChange={(e) => handleVentureChange(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent-glow cursor-pointer"
          >
            {ventures.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}

        {/* Refresh indicator */}
        {refreshing && (
          <span className="flex items-center gap-1.5 text-xs text-subtle">
            <span className="w-3.5 h-3.5 border-2 border-line border-t-moss rounded-full animate-spin" />
            Refreshing...
          </span>
        )}
      </div>

      {/* Hero Score */}
      <div className="bg-surface border border-line rounded-xl p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center border-4 ${
                  report.composite_status === "green"
                    ? "border-semantic-green"
                    : report.composite_status === "yellow"
                      ? "border-semantic-ochre"
                      : "border-semantic-brick"
                }`}
              >
                <span className="text-4xl font-bold font-mono text-ink">
                  {report.composite_score}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">Composite Score</h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${compositeColors.bg} ${compositeColors.text}`}
                >
                  <span className={`w-2 h-2 rounded-full ${compositeColors.dot}`} />
                  {report.composite_status}
                </span>
              </div>
              {snapshots.length >= 2 && (
                <div className="mt-2">
                  <Sparkline
                    data={snapshots.map((s) => s.composite_score)}
                    status={report.composite_status as HealthStatus}
                  />
                  <p className="text-xs text-subtle mt-1">Trailing {snapshots.length} weeks</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Interpretation */}
        <div className="mt-6 border-t border-line pt-5">
          {interpretation ? (
            <div className="flex gap-3">
              <div className="w-1 bg-sage rounded-full flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-sage mb-1">AI Interpretation</p>
                <p className="text-sm text-ink leading-relaxed">{interpretation}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={requestInterpretation}
              disabled={interpreting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-sage/10 text-sage hover:bg-sage/20 transition-colors disabled:opacity-50"
            >
              {interpreting ? (
                <>
                  <span className="w-4 h-4 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Get AI Interpretation"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Grid + Drill-Down Panels */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, index) => {
            const metricKey = metricKeys[index];
            const isHidden = metricKey === "cross_venture_collaboration" && isSingleVenture;
            if (isHidden && metric.value === 0 && metric.sparkline.every((v) => v === 0)) return null;

            return (
              <MetricCard
                key={metric.key}
                metric={metric}
                hideIfZero={metricKey === "cross_venture_collaboration" && isSingleVenture}
                isExpanded={expandedMetric === metricKey}
                onClick={() => handleMetricClick(metricKey)}
              />
            );
          })}
        </div>

        {/* Drill-Down Panel */}
        {expandedMetric && (
          <div className="bg-surface border border-line rounded-xl p-6 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">
                {report.metrics[expandedMetric].label} — Drill-Down
              </h3>
              <button
                onClick={() => setExpandedMetric(null)}
                className="text-subtle hover:text-ink transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <DrillDownPanel
              metricKey={expandedMetric}
              data={
                drillDownLoading === expandedMetric
                  ? null
                  : drillDownData[`${expandedMetric}_${windowDays}_${selectedVentureId}`] ?? null
              }
            />
          </div>
        )}
      </div>

      {/* Snapshot History */}
      {snapshots.length > 0 && (
        <div className="bg-surface border border-line rounded-xl p-6">
          <h3 className="text-sm font-semibold text-ink mb-4">Score History</h3>
          <div className="space-y-2">
            {snapshots
              .slice()
              .reverse()
              .slice(0, 8)
              .map((s, i) => {
                const colors = statusColors[s.composite_status as HealthStatus];
                return (
                  <div key={i} className="flex items-center gap-4 text-sm">
                    <span className="text-subtle w-24 flex-shrink-0 font-mono text-xs">
                      {new Date(s.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <div className="flex-1 h-2 bg-line/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors.dot}`}
                        style={{ width: `${s.composite_score}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-ink w-8 text-right">
                      {s.composite_score}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
