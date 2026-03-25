"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MyCockpitProps {
  moves: Array<{
    id: string;
    title: string;
    lifecycle_status: string;
    health_status: string;
    due_date: string | null;
    bets: { outcome: string } | null;
  }>;
  kpis: Array<{
    id: string;
    name: string;
    health_status: string;
    current_value: number | null;
    target: number | null;
    unit: string | null;
  }>;
  blockers: Array<{
    id: string;
    description: string;
    severity: string;
  }>;
  pulseStreak: number;
}

export function MyCockpitView({
  moves,
  kpis,
  blockers,
  pulseStreak,
}: MyCockpitProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">My Cockpit</h1>
        {pulseStreak > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-accent font-medium">
            <span className="text-lg">🔥</span>
            {pulseStreak} day streak
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Moves */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">My Moves ({moves.length})</h2>
          </CardHeader>
          <CardContent>
            {moves.length === 0 ? (
              <p className="text-sm text-subtle">No active moves assigned to you.</p>
            ) : (
              <div className="space-y-2">
                {moves.map((m) => (
                  <div key={m.id} className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      {m.bets && (
                        <p className="text-xs text-subtle">{m.bets.outcome}</p>
                      )}
                      {m.due_date && (
                        <p className="text-xs text-subtle">
                          Due {new Date(m.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      )}
                    </div>
                    <Badge status={m.health_status as "green" | "yellow" | "red"}>
                      {m.lifecycle_status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My KPIs */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">My KPIs ({kpis.length})</h2>
          </CardHeader>
          <CardContent>
            {kpis.length === 0 ? (
              <p className="text-sm text-subtle">No KPIs owned by you.</p>
            ) : (
              <div className="space-y-2">
                {kpis.map((k) => (
                  <div key={k.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">{k.name}</p>
                      <p className="text-xs text-subtle font-mono">
                        {k.current_value ?? "—"} / {k.target ?? "—"} {k.unit ?? ""}
                      </p>
                    </div>
                    <Badge status={k.health_status as "green" | "yellow" | "red"} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Blockers */}
        {blockers.length > 0 && (
          <Card borderColor="var(--color-semantic-brick)" className="md:col-span-2">
            <CardHeader>
              <h2 className="text-sm font-semibold text-semantic-brick">
                My Blockers ({blockers.length})
              </h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {blockers.map((b) => (
                  <div key={b.id} className="text-sm">
                    <p>{b.description}</p>
                    <p className="text-xs text-subtle">Severity: {b.severity}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
