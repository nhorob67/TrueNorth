"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface AgentSkillSummary {
  id: string;
  skill_name: string;
  skill_description: string | null;
  source: string;
  version: number;
  shared: boolean;
  updated_at: string;
}

interface AgentWorkflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
}

interface KnowledgeSourceAccess {
  id: string;
  access_mode: string;
  name: string;
  source_type: string;
  status: string;
}

interface AgentExample {
  id: string;
  task_type: string;
  status: string;
  summary: string | null;
  completed_at: string | null;
}

interface AgentDetail {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  automation_level: number;
  hermes_enabled: boolean;
  capabilities: string[];
  approved_skills: AgentSkillSummary[];
  workflows: AgentWorkflow[];
  knowledge_sources: KnowledgeSourceAccess[];
  trust_summary: Record<string, unknown> | null;
  recent_examples: AgentExample[];
}

const AUTOMATION_LABELS: Record<number, string> = {
  0: "Manual",
  1: "Assisted",
  2: "Partial",
  3: "Conditional",
  4: "Full Autonomy",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  internal_entity: "Internal Data",
  upload: "Uploaded Files",
  web_page: "Web Pages",
  connector: "Connected Service",
};

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[10px] font-mono uppercase tracking-[0.10em] text-faded mb-3">
      {title}
    </h2>
  );
}

export function AgentDetailView({ agent }: { agent: AgentDetail }) {
  const trustMetrics = agent.trust_summary as Record<string, unknown> | null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/library/agents"
        className="text-sm text-subtle hover:text-ink transition-colors mb-4 inline-block"
      >
        &larr; Back to Agent Catalog
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-2xl font-bold text-ink">
            {agent.name}
          </h1>
          {agent.hermes_enabled && (
            <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-wider text-sage-text bg-sage/10 rounded px-1.5 py-0.5">
              Hermes
            </span>
          )}
        </div>
        {agent.description && (
          <p className="text-subtle">{agent.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge status="neutral">{agent.category}</Badge>
          <Badge status={agent.status === "active" ? "green" : "neutral"}>
            {agent.status}
          </Badge>
          <Badge status="neutral">
            L{agent.automation_level}{" "}
            {AUTOMATION_LABELS[agent.automation_level] ?? "Unknown"}
          </Badge>
        </div>
      </div>

      <div className="space-y-8">
        {/* Capabilities */}
        {agent.capabilities.length > 0 && (
          <section>
            <SectionHeader title="Capabilities" />
            <Card className="p-4">
              <ul className="space-y-1">
                {agent.capabilities.map((cap, i) => (
                  <li key={i} className="text-sm text-ink flex items-start gap-2">
                    <span className="text-accent mt-0.5">&#8226;</span>
                    {cap}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {/* Approved Skills */}
        <section>
          <SectionHeader title="Approved Skills" />
          {agent.approved_skills.length > 0 ? (
            <div className="space-y-2">
              {agent.approved_skills.map((skill) => (
                <Card key={skill.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink text-sm">
                        {skill.skill_name}
                      </h3>
                      {skill.skill_description && (
                        <p className="text-sm text-subtle mt-1">
                          {skill.skill_description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {skill.shared && (
                        <Badge status="neutral">Shared</Badge>
                      )}
                      <span className="text-[10px] font-mono text-faded">
                        v{skill.version}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-faded">
                    <span>Source: {skill.source}</span>
                    <span>
                      Updated:{" "}
                      {new Date(skill.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4">
              <p className="text-sm text-subtle">
                No approved skills yet.
              </p>
            </Card>
          )}
        </section>

        {/* Knowledge Access */}
        <section>
          <SectionHeader title="Knowledge Access" />
          {agent.knowledge_sources.length > 0 ? (
            <Card className="p-4">
              <div className="space-y-2">
                {agent.knowledge_sources.map((ks) => (
                  <div
                    key={ks.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-ink">{ks.name}</span>
                      <Badge status="neutral">
                        {SOURCE_TYPE_LABELS[ks.source_type] ?? ks.source_type}
                      </Badge>
                    </div>
                    <span className="text-xs text-faded">
                      {ks.access_mode === "read" ? "Full read" : "Citations only"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <p className="text-sm text-subtle">
                No knowledge sources connected.
              </p>
            </Card>
          )}
        </section>

        {/* Workflows */}
        {agent.workflows.length > 0 && (
          <section>
            <SectionHeader title="Workflows" />
            <div className="space-y-2">
              {agent.workflows.map((wf) => (
                <Card key={wf.id} className="p-4">
                  <h3 className="font-semibold text-ink text-sm">{wf.name}</h3>
                  {wf.description && (
                    <p className="text-sm text-subtle mt-1">
                      {wf.description}
                    </p>
                  )}
                  <span className="text-xs text-faded mt-1 inline-block">
                    Trigger: {wf.trigger_type}
                  </span>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Trust & Performance */}
        {trustMetrics && (
          <section>
            <SectionHeader title="Trust & Performance" />
            <Card className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {trustMetrics.tasks_completed != null && (
                  <div>
                    <p className="text-2xl font-display font-bold text-ink">
                      {trustMetrics.tasks_completed as number}
                    </p>
                    <p className="text-xs text-faded">Tasks completed</p>
                  </div>
                )}
                {trustMetrics.acceptance_rate != null && (
                  <div>
                    <p className="text-2xl font-display font-bold text-ink">
                      {Math.round(
                        (trustMetrics.acceptance_rate as number) * 100
                      )}
                      %
                    </p>
                    <p className="text-xs text-faded">Acceptance rate</p>
                  </div>
                )}
                {trustMetrics.override_rate != null && (
                  <div>
                    <p className="text-2xl font-display font-bold text-ink">
                      {Math.round(
                        (trustMetrics.override_rate as number) * 100
                      )}
                      %
                    </p>
                    <p className="text-xs text-faded">Override rate</p>
                  </div>
                )}
                {trustMetrics.total_cost != null && (
                  <div>
                    <p className="text-2xl font-display font-bold text-ink">
                      ${(trustMetrics.total_cost as number).toFixed(2)}
                    </p>
                    <p className="text-xs text-faded">Weekly cost</p>
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}

        {/* Example Uses */}
        {agent.recent_examples.length > 0 && (
          <section>
            <SectionHeader title="Recent Examples" />
            <div className="space-y-2">
              {agent.recent_examples.map((ex) => (
                <Card key={ex.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-ink">
                        {ex.task_type}
                      </span>
                      <Badge
                        status={ex.status === "approved" ? "green" : "neutral"}
                      >
                        {ex.status}
                      </Badge>
                    </div>
                    {ex.completed_at && (
                      <span className="text-xs text-faded">
                        {new Date(ex.completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {ex.summary && (
                    <p className="text-sm text-subtle mt-1 line-clamp-2">
                      {ex.summary}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
