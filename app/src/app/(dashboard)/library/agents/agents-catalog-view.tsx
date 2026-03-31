"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/loading";

interface CatalogAgent {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  automation_level: number;
  hermes_enabled: boolean;
  capabilities: string[];
  approved_skill_count: number;
  workflow_count: number;
  trust_summary: {
    acceptance_rate: number | null;
    tasks_completed: number | null;
  } | null;
}

const AUTOMATION_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Manual", color: "neutral" },
  1: { label: "Assisted", color: "neutral" },
  2: { label: "Partial", color: "yellow" },
  3: { label: "Conditional", color: "yellow" },
  4: { label: "Full", color: "green" },
};

const CATEGORY_LABELS: Record<string, string> = {
  governance: "Governance",
  sensing: "Sensing",
  operations: "Operations",
  synthesis: "Synthesis",
  production: "Production",
  execution: "Execution",
};

function AgentCard({ agent }: { agent: CatalogAgent }) {
  const auto = AUTOMATION_LABELS[agent.automation_level] ?? AUTOMATION_LABELS[0];
  const categoryLabel = CATEGORY_LABELS[agent.category] ?? agent.category;

  return (
    <Link href={`/library/agents/${agent.id}`}>
      <Card className="p-4 hover:border-accent/30 transition-colors cursor-pointer h-full">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-ink truncate">
              {agent.name}
            </h3>
            {agent.description && (
              <p className="text-sm text-subtle mt-1 line-clamp-2">
                {agent.description}
              </p>
            )}
          </div>
          {agent.hermes_enabled && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-sage-text bg-sage/10 rounded px-1.5 py-0.5">
              Hermes
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge status="neutral">{categoryLabel}</Badge>
          <Badge status={auto.color as "green" | "yellow" | "neutral"}>
            L{agent.automation_level} {auto.label}
          </Badge>
          {agent.status !== "active" && (
            <Badge status="neutral">{agent.status}</Badge>
          )}
        </div>

        {agent.capabilities.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-faded mb-1">
              Capabilities
            </p>
            <p className="text-xs text-subtle line-clamp-1">
              {agent.capabilities.join(" · ")}
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-faded border-t border-line pt-3 mt-auto">
          {agent.approved_skill_count > 0 && (
            <span>
              <span className="font-semibold text-subtle">
                {agent.approved_skill_count}
              </span>{" "}
              {agent.approved_skill_count === 1 ? "skill" : "skills"}
            </span>
          )}
          {agent.workflow_count > 0 && (
            <span>
              <span className="font-semibold text-subtle">
                {agent.workflow_count}
              </span>{" "}
              {agent.workflow_count === 1 ? "workflow" : "workflows"}
            </span>
          )}
          {agent.trust_summary?.acceptance_rate != null && (
            <span>
              <span className="font-semibold text-subtle">
                {Math.round(agent.trust_summary.acceptance_rate * 100)}%
              </span>{" "}
              acceptance
            </span>
          )}
          {agent.trust_summary?.tasks_completed != null && (
            <span>
              <span className="font-semibold text-subtle">
                {agent.trust_summary.tasks_completed}
              </span>{" "}
              tasks
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function FilterBar({
  category,
  setCategory,
  status,
  setStatus,
  hermesOnly,
  setHermesOnly,
  search,
  setSearch,
  categories,
}: {
  category: string;
  setCategory: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  hermesOnly: boolean;
  setHermesOnly: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  categories: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="bg-well text-sm text-ink rounded-[8px] border border-line px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c] ?? c}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="bg-well text-sm text-ink rounded-[8px] border border-line px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="archived">Archived</option>
      </select>

      <label className="flex items-center gap-2 text-sm text-subtle cursor-pointer">
        <input
          type="checkbox"
          checked={hermesOnly}
          onChange={(e) => setHermesOnly(e.target.checked)}
          className="rounded border-line accent-accent"
        />
        Hermes only
      </label>

      <input
        type="text"
        placeholder="Search agents..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-well text-sm text-ink rounded-[8px] border border-line px-3 py-1.5 placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-accent ml-auto w-56"
      />
    </div>
  );
}

export function AgentsCatalogView({ agents }: { agents: CatalogAgent[] }) {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [hermesOnly, setHermesOnly] = useState(false);
  const [search, setSearch] = useState("");

  const categories = useMemo(
    () => [...new Set(agents.map((a) => a.category))].sort(),
    [agents]
  );

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (category && a.category !== category) return false;
      if (status && a.status !== status) return false;
      if (hermesOnly && !a.hermes_enabled) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesName = a.name.toLowerCase().includes(q);
        const matchesDesc = a.description?.toLowerCase().includes(q);
        const matchesCaps = a.capabilities.some((c) =>
          c.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesDesc && !matchesCaps) return false;
      }
      return true;
    });
  }, [agents, category, status, hermesOnly, search]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          Agent Catalog
        </h1>
        <p className="text-sm text-subtle mt-1">
          Browse your organization&apos;s AI agents, their capabilities, and approved skills.
        </p>
      </div>

      <FilterBar
        category={category}
        setCategory={setCategory}
        status={status}
        setStatus={setStatus}
        hermesOnly={hermesOnly}
        setHermesOnly={setHermesOnly}
        search={search}
        setSearch={setSearch}
        categories={categories}
      />

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : agents.length > 0 ? (
        <EmptyState title="No agents match your filters." />
      ) : (
        <EmptyState title="No agents configured yet. Visit Admin to set up your agent team." />
      )}
    </div>
  );
}
