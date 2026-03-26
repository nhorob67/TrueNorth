"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { isOverdue, timeAgo, formatKpiValue, PRIORITY_COLOR, healthBadgeStatus } from "@/lib/format";
import { KpiIconBadge } from "@/lib/kpi-icons";

interface HomeProps {
  kpis: Array<{
    id: string;
    name: string;
    unit: string | null;
    tier: number;
    current_value: number | null;
    target: number | null;
    health_status: string;
    icon: string | null;
    display_order: number;
  }>;
  atRiskBets: Array<{
    id: string;
    outcome: string;
    health_status: string;
    lifecycle_status: string;
  }>;
  missedCommitments: Array<{
    id: string;
    description: string;
    owner_id: string;
    due_date: string | null;
    status: string;
  }>;
  myTodos: Array<{
    id: string;
    title: string;
    priority: string;
    due_date: string | null;
    completed: boolean;
    linked_entity_type: string | null;
    linked_entity_id: string | null;
  }>;
  myMoves: Array<{
    id: string;
    title: string;
    due_date: string | null;
    health_status: string;
    lifecycle_status: string;
    bets: { outcome: string } | null;
  }>;
  recentActivity: Array<{
    id: string;
    body: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    author_id: string;
    user_profiles: { full_name: string } | null;
  }>;
  nextSyncLabel: string | null;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    due_date: string | null;
    owner_id: string;
    user_profiles: { full_name: string } | null;
  }>;
}

const supabase = createClient();

export function HomeView({
  kpis,
  atRiskBets,
  missedCommitments,
  myTodos,
  myMoves,
  recentActivity,
  nextSyncLabel,
  upcomingDeadlines,
}: HomeProps) {
  const router = useRouter();

  async function toggleTodo(id: string, completed: boolean) {
    await supabase.from("todos").update({ completed }).eq("id", id);
    router.refresh();
  }

  const overdueTodos = myTodos.filter((t) => isOverdue(t.due_date));
  const dueTodayOrUpcoming = myTodos.filter((t) => !isOverdue(t.due_date));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Home</h1>
        <p className="text-sm text-subtle mt-1">What needs your attention right now</p>
      </div>

      <section className="mb-8">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.10em] text-subtle mb-3">
          Today Overview
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {kpis.map((kpi) => (
            <Link key={kpi.id} href={`/strategy/scoreboard/${kpi.id}`}>
              <Card className="hover:border-accent/30 transition-colors cursor-pointer">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 truncate mr-2">
                      <KpiIconBadge iconKey={kpi.icon} healthStatus={kpi.health_status as "green" | "yellow" | "red"} />
                      <span className="text-xs text-subtle truncate">{kpi.name}</span>
                    </div>
                    <Badge status={healthBadgeStatus(kpi.health_status)} />
                  </div>
                  <div className="text-lg font-semibold font-mono">
                    {formatKpiValue(kpi.current_value, kpi.unit)}
                  </div>
                  {kpi.target != null && (
                    <div className="text-xs text-subtle">
                      target: {formatKpiValue(kpi.target, kpi.unit)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {atRiskBets.length > 0 && (
            <Card borderColor="var(--color-semantic-brick)">
              <CardHeader>
                <h3 className="text-sm font-semibold">
                  At-Risk Bets ({atRiskBets.length})
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {atRiskBets.map((bet) => (
                    <Link
                      key={bet.id}
                      href={`/execution/bets/${bet.id}`}
                      className="flex items-center justify-between py-1.5 hover:bg-hovered rounded px-2 -mx-2 transition-colors"
                    >
                      <span className="text-sm truncate mr-2">{bet.outcome}</span>
                      <Badge status={healthBadgeStatus(bet.health_status)} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {missedCommitments.length > 0 && (
            <Card borderColor="var(--color-semantic-ochre)">
              <CardHeader>
                <h3 className="text-sm font-semibold">
                  Missed Commitments ({missedCommitments.length})
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {missedCommitments.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-start gap-2 py-1">
                      <span className="text-semantic-brick text-xs mt-0.5">●</span>
                      <span className="text-sm">{c.description}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.10em] text-subtle mb-3">
          My Work
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Todos ({myTodos.length})
                </h3>
                <Link href="/todos" className="text-xs text-accent hover:underline">
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {myTodos.length === 0 ? (
                <p className="text-sm text-subtle">All clear. Enjoy this moment — it won&apos;t last.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...overdueTodos, ...dueTodayOrUpcoming].map((todo) => {
                    const overdue = isOverdue(todo.due_date);
                    return (
                      <label
                        key={todo.id}
                        className="flex items-start gap-2.5 py-1.5 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={() => toggleTodo(todo.id, !todo.completed)}
                          className="mt-0.5 rounded border-line accent-accent"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">{todo.title}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {overdue && (
                              <span className="text-xs text-semantic-brick font-medium">Overdue</span>
                            )}
                            {!overdue && todo.due_date && (
                              <span className="text-xs text-subtle">
                                {new Date(todo.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                            <span className={`text-xs ${PRIORITY_COLOR[todo.priority as keyof typeof PRIORITY_COLOR] ?? "text-subtle"}`}>
                              {todo.priority}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">
                My Moves Due Soon ({myMoves.length})
              </h3>
            </CardHeader>
            <CardContent>
              {myMoves.length === 0 ? (
                <p className="text-sm text-subtle">No moves due this week.</p>
              ) : (
                <div className="space-y-2">
                  {myMoves.map((move) => (
                    <div
                      key={move.id}
                      className="flex items-center justify-between py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{move.title}</div>
                        {move.bets && (
                          <div className="text-xs text-subtle truncate">
                            {move.bets.outcome}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {move.due_date && (
                          <span className={`text-xs ${isOverdue(move.due_date) ? "text-semantic-brick font-medium" : "text-subtle"}`}>
                            {new Date(move.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        <Badge status={healthBadgeStatus(move.health_status)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.10em] text-subtle mb-3">
              Activity
            </h2>
            <Card>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-subtle">No recent activity.</p>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent flex-shrink-0 mt-0.5">
                          {(item.user_profiles?.full_name ?? "?")[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] uppercase text-faded">
                              {item.entity_type}
                            </span>
                            <span className="text-xs text-subtle">{timeAgo(item.created_at)}</span>
                          </div>
                          <p className="text-sm line-clamp-2 mt-0.5">{item.body}</p>
                        </div>
                      </div>
                    ))}
                    <Link
                      href="/activity"
                      className="block text-xs text-accent hover:underline pt-1"
                    >
                      View all activity →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.10em] text-subtle mb-3">
              Upcoming
            </h2>
            <Card>
              <CardContent>
                <div className="space-y-3">
                  {nextSyncLabel && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span className="text-sm font-medium">{nextSyncLabel}</span>
                    </div>
                  )}

                  {upcomingDeadlines.length > 0 && (
                    <div>
                      <p className="text-xs text-subtle mb-2">Deadlines this week</p>
                      <div className="space-y-1.5">
                        {upcomingDeadlines.map((d) => (
                          <div key={d.id} className="flex items-center justify-between text-sm">
                            <span className="truncate mr-2">{d.title}</span>
                            <span className="text-xs text-subtle flex-shrink-0">
                              {d.due_date
                                ? new Date(d.due_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!nextSyncLabel && upcomingDeadlines.length === 0 && (
                    <p className="text-sm text-subtle">Nothing upcoming this week.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
