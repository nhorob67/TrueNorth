"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Agent, RoleCard } from "@/types/database";

const AUTOMATION_LABELS: Record<number, string> = {
  0: "L0 - Manual",
  1: "L1 - Assisted",
  2: "L2 - Semi-Auto",
  3: "L3 - Supervised",
  4: "L4 - Autonomous",
};

const CATEGORY_LABELS: Record<string, string> = {
  filter_guardian: "Filter Guardian",
  signal_watch: "Signal Watch",
  content_copilot: "Content Copilot",
  cockpit_advisor: "Cockpit Advisor",
  agenda_builder: "Agenda Builder",
};

const DEFAULT_AGENTS = [
  {
    name: "Filter Guardian",
    description: "Evaluates ideas against strategic filters",
    category: "filter_guardian",
    automation_level: 1,
  },
  {
    name: "Signal Watch",
    description: "Detects KPI anomalies and trend reversals",
    category: "signal_watch",
    automation_level: 1,
  },
  {
    name: "Content Copilot",
    description: "AI writing assistant for content creation",
    category: "content_copilot",
    automation_level: 1,
  },
];

interface TrustMetrics {
  totalActions: number;
  acceptanceRate: number | null;
  overrideRate: number | null;
}

interface AgentsViewProps {
  agents: Agent[];
  roleCards: RoleCard[];
  orgId: string;
  trustMetrics?: Record<string, TrustMetrics>;
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, "green" | "yellow" | "neutral"> = {
    active: "green",
    paused: "yellow",
    disabled: "neutral",
  };
  return <Badge status={statusMap[status] ?? "neutral"}>{status}</Badge>;
}

function RoleCardEditor({
  roleCard,
  agentId,
  orgId,
  onClose,
}: {
  roleCard: RoleCard | null;
  agentId: string;
  orgId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  const [outcomes, setOutcomes] = useState(
    roleCard?.outcomes_owned?.join("\n") ?? ""
  );
  const [authority, setAuthority] = useState(
    roleCard?.decision_authority ?? ""
  );
  const [interfaces, setInterfaces] = useState(roleCard?.interfaces ?? "");
  const [standard, setStandard] = useState(
    roleCard?.commitments_standard ?? ""
  );

  async function handleSave() {
    setSaving(true);
    const payload = {
      entity_id: agentId,
      entity_type: "agent" as const,
      organization_id: orgId,
      venture_assignments: [] as string[],
      outcomes_owned: outcomes
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean),
      metrics_moved: [] as string[],
      decision_authority: authority.trim(),
      interfaces: interfaces.trim(),
      commitments_standard: standard.trim(),
      updated_at: new Date().toISOString(),
    };

    if (roleCard) {
      await supabase
        .from("role_cards")
        .update(payload)
        .eq("id", roleCard.id);
    } else {
      await supabase.from("role_cards").insert(payload);
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Outcomes Owned
        </label>
        <textarea
          value={outcomes}
          onChange={(e) => setOutcomes(e.target.value)}
          placeholder="One outcome per line..."
          className="w-full min-h-[60px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Decision Authority
        </label>
        <textarea
          value={authority}
          onChange={(e) => setAuthority(e.target.value)}
          placeholder="What can this agent decide autonomously?"
          className="w-full min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Interfaces
        </label>
        <textarea
          value={interfaces}
          onChange={(e) => setInterfaces(e.target.value)}
          placeholder="What systems/people does this agent interact with?"
          className="w-full min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Commitments Standard
        </label>
        <textarea
          value={standard}
          onChange={(e) => setStandard(e.target.value)}
          placeholder="SLA or quality standard for this agent"
          className="w-full min-h-[40px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Role Card"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TrustMetricsSection({ metrics }: { metrics?: TrustMetrics }) {
  if (!metrics || metrics.totalActions === 0) {
    return (
      <div className="border-t border-line pt-3 mt-3">
        <p className="text-xs font-semibold text-subtle uppercase mb-1">Trust Metrics</p>
        <p className="text-sm text-subtle italic">No actions recorded yet.</p>
        <Link href="/admin/settings/ai-dashboard" className="text-xs text-accent hover:underline mt-1 inline-block">
          View AI Dashboard
        </Link>
      </div>
    );
  }

  function rateColor(rate: number | null): string {
    if (rate === null) return "text-subtle";
    if (rate >= 80) return "text-semantic-green";
    if (rate >= 60) return "text-semantic-ochre";
    return "text-semantic-brick";
  }

  return (
    <div className="border-t border-line pt-3 mt-3">
      <p className="text-xs font-semibold text-subtle uppercase mb-2">Trust Metrics (30d)</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-subtle">Acceptance</p>
          <p className={`text-base font-bold ${rateColor(metrics.acceptanceRate)}`}>
            {metrics.acceptanceRate !== null ? `${metrics.acceptanceRate}%` : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-subtle">Override Rate</p>
          <p className={`text-base font-bold ${rateColor(metrics.overrideRate !== null ? 100 - metrics.overrideRate : null)}`}>
            {metrics.overrideRate !== null ? `${metrics.overrideRate}%` : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-subtle">Total Actions</p>
          <p className="text-base font-bold text-ink">{metrics.totalActions}</p>
        </div>
      </div>
      <Link href="/admin/settings/ai-dashboard" className="text-xs text-accent hover:underline mt-2 inline-block">
        View full AI Dashboard &rarr;
      </Link>
    </div>
  );
}

function AgentCard({
  agent,
  roleCard,
  orgId,
  trustMetrics,
}: {
  agent: Agent;
  roleCard: RoleCard | null;
  orgId: string;
  trustMetrics?: TrustMetrics;
}) {
  const [editingRoleCard, setEditingRoleCard] = useState(false);

  return (
    <Card className="border-line bg-surface overflow-hidden">
      {/* Sage header bar */}
      <div className="h-2 bg-sage" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-sage"
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
                <h3 className="font-semibold text-ink">{agent.name}</h3>
                <span className="inline-flex items-center rounded-full bg-sage px-2 py-0.5 text-xs font-medium text-white">
                  AI Agent
                </span>
                <StatusBadge status={agent.status} />
              </div>
              <p className="text-sm text-subtle mt-0.5">
                {CATEGORY_LABELS[agent.category] ?? agent.category} &middot;{" "}
                {AUTOMATION_LABELS[agent.automation_level] ??
                  `L${agent.automation_level}`}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditingRoleCard(true)}
          >
            {roleCard ? "Edit Role Card" : "Set Up Role Card"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {agent.description && (
          <p className="text-sm text-ink mb-3">{agent.description}</p>
        )}

        {/* Role card details */}
        {roleCard && !editingRoleCard && (
          <div className="space-y-3 border-t border-line pt-3">
            {roleCard.outcomes_owned.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-subtle uppercase mb-1">
                  Outcomes Owned
                </p>
                <ul className="space-y-0.5">
                  {roleCard.outcomes_owned.map((outcome, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-ink flex items-start gap-2"
                    >
                      <span className="text-sage mt-0.5">•</span>
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {roleCard.decision_authority && (
              <div>
                <p className="text-xs font-semibold text-subtle uppercase mb-1">
                  Decision Authority
                </p>
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {roleCard.decision_authority}
                </p>
              </div>
            )}
            {roleCard.interfaces && (
              <div>
                <p className="text-xs font-semibold text-subtle uppercase mb-1">
                  Interfaces
                </p>
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {roleCard.interfaces}
                </p>
              </div>
            )}
            {roleCard.commitments_standard && (
              <div>
                <p className="text-xs font-semibold text-subtle uppercase mb-1">
                  Commitments Standard
                </p>
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {roleCard.commitments_standard}
                </p>
              </div>
            )}
          </div>
        )}

        {editingRoleCard && (
          <RoleCardEditor
            roleCard={roleCard}
            agentId={agent.id}
            orgId={orgId}
            onClose={() => setEditingRoleCard(false)}
          />
        )}

        {/* Trust Metrics */}
        <TrustMetricsSection metrics={trustMetrics} />
      </CardContent>
    </Card>
  );
}

export function AgentsView({ agents, roleCards, orgId, trustMetrics }: AgentsViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [seeding, setSeeding] = useState(false);

  // Auto-seed default agents if none exist
  useEffect(() => {
    if (agents.length === 0 && !seeding) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeeding(true);
      const rows = DEFAULT_AGENTS.map((a) => ({
        organization_id: orgId,
        name: a.name,
        description: a.description,
        category: a.category,
        automation_level: a.automation_level,
        status: "active",
      }));
      supabase
        .from("agents")
        .insert(rows)
        .then(() => {
          router.refresh();
          setSeeding(false);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function getRoleCard(agentId: string): RoleCard | null {
    return roleCards.find((rc) => rc.entity_id === agentId) ?? null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">AI Agents</h2>
          <p className="text-subtle text-sm mt-1">
            Manage AI agents, their automation levels, and role cards
          </p>
        </div>
        <Link href="/admin/settings/ai-dashboard">
          <Button variant="secondary" size="sm">
            AI Trust Dashboard
          </Button>
        </Link>
      </div>

      {seeding ? (
        <p className="text-sm text-subtle">Setting up default agents...</p>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              roleCard={getRoleCard(agent.id)}
              orgId={orgId}
              trustMetrics={trustMetrics?.[agent.category]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
