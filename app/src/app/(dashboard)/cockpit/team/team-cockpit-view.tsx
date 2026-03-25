"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AgentSummary {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
}

interface TeamCockpitProps {
  teamMembers: Array<{
    user_id: string;
    role: string;
    user_profiles: { full_name: string } | null;
  }>;
  moves: Array<{
    id: string;
    title: string;
    lifecycle_status: string;
    health_status: string;
    due_date: string | null;
    owner_id: string;
    bets: { outcome: string } | null;
  }>;
  kpis: Array<{
    id: string;
    name: string;
    health_status: string;
    owner_id: string;
  }>;
  pulseUserIds: string[];
  blockers: Array<{
    id: string;
    description: string;
    severity: string;
    owner_id: string;
  }>;
  agents: AgentSummary[];
}

const CATEGORY_LABELS: Record<string, string> = {
  filter_guardian: "Filter Guardian",
  signal_watch: "Signal Watch",
  content_copilot: "Content Copilot",
  cockpit_advisor: "Cockpit Advisor",
  agenda_builder: "Agenda Builder",
};

export function TeamCockpitView({
  teamMembers,
  moves,
  kpis,
  pulseUserIds,
  blockers,
  agents,
}: TeamCockpitProps) {
  return (
    <div>
      <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Team Cockpit</h1>

      <div className="space-y-6">
        {teamMembers.map((member) => {
          const memberMoves = moves.filter((m) => m.owner_id === member.user_id);
          const memberKpis = kpis.filter((k) => k.owner_id === member.user_id);
          const memberBlockers = blockers.filter((b) => b.owner_id === member.user_id);
          const hasPulsed = pulseUserIds.includes(member.user_id);

          return (
            <Card key={member.user_id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-sm font-medium text-accent">
                      {member.user_profiles?.full_name?.charAt(0) ?? "?"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {member.user_profiles?.full_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-subtle">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasPulsed ? (
                      <Badge status="green">Pulsed</Badge>
                    ) : (
                      <Badge status="neutral">No pulse</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Moves */}
                  <div>
                    <p className="text-xs font-semibold text-subtle uppercase mb-1">
                      Moves ({memberMoves.length})
                    </p>
                    {memberMoves.length === 0 ? (
                      <p className="text-xs text-subtle">No active moves</p>
                    ) : (
                      <div className="space-y-1">
                        {memberMoves.slice(0, 5).map((m) => (
                          <div key={m.id} className="flex items-center gap-1.5 text-xs">
                            <Badge status={m.health_status as "green" | "yellow" | "red"} />
                            <span className="truncate">{m.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* KPIs */}
                  <div>
                    <p className="text-xs font-semibold text-subtle uppercase mb-1">
                      KPIs ({memberKpis.length})
                    </p>
                    {memberKpis.length === 0 ? (
                      <p className="text-xs text-subtle">No KPIs owned</p>
                    ) : (
                      <div className="space-y-1">
                        {memberKpis.map((k) => (
                          <div key={k.id} className="flex items-center gap-1.5 text-xs">
                            <Badge status={k.health_status as "green" | "yellow" | "red"} />
                            <span className="truncate">{k.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Blockers */}
                  <div>
                    <p className="text-xs font-semibold text-subtle uppercase mb-1">
                      Blockers ({memberBlockers.length})
                    </p>
                    {memberBlockers.length === 0 ? (
                      <p className="text-xs text-subtle">Not blocked</p>
                    ) : (
                      <div className="space-y-1">
                        {memberBlockers.map((b) => (
                          <p key={b.id} className="text-xs text-semantic-brick">
                            {b.description}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Agents Section */}
      {agents.length > 0 && (
        <>
          <div className="border-t border-line my-8" />
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink mb-4">AI Agents</h2>
          <div className="space-y-4">
            {agents.map((agent) => (
              <Card key={agent.id} className="overflow-hidden">
                {/* Sage header bar — distinct from human team members */}
                <div className="h-2 bg-sage" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-sage"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{agent.name}</p>
                          <span className="inline-flex items-center rounded-full bg-sage px-2 py-0.5 text-[10px] font-medium text-white">
                            AI Agent
                          </span>
                        </div>
                        <p className="text-xs text-subtle">
                          {CATEGORY_LABELS[agent.category] ?? agent.category}
                        </p>
                      </div>
                    </div>
                    <Badge
                      status={
                        agent.status === "active"
                          ? "green"
                          : agent.status === "paused"
                            ? "yellow"
                            : "neutral"
                      }
                    >
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                {agent.description && (
                  <CardContent>
                    <p className="text-xs text-subtle">
                      {agent.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
