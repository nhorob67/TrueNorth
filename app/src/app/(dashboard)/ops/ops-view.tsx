"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddToTodoButton } from "@/components/add-to-todo-button";

type Tab = "blockers" | "commitments" | "issues" | "decisions";

interface Decision {
  id: string;
  title: string;
  context: string | null;
  final_decision: string | null;
  decided_at: string | null;
  created_at: string;
}

interface Blocker {
  id: string;
  description: string;
  severity: string;
  resolution_state: string;
  created_at: string;
}

interface Commitment {
  id: string;
  description: string;
  due_date: string | null;
  status: string;
  created_at: string;
}

interface Issue {
  id: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

function QuickCreateBlocker({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user!.id)
      .limit(1)
      .single();

    await supabase.from("blockers").insert({
      organization_id: membership!.organization_id,
      description: description.trim(),
      severity,
      owner_id: user!.id,
    });

    setDescription("");
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
      <div className="flex-1">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the blocker..."
        />
      </div>
      <select
        value={severity}
        onChange={(e) => setSeverity(e.target.value)}
        className="rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>
      <Button type="submit" size="sm" disabled={loading}>Add</Button>
    </form>
  );
}

function QuickCreateCommitment({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user!.id)
      .limit(1)
      .single();

    await supabase.from("commitments").insert({
      organization_id: membership!.organization_id,
      description: description.trim(),
      due_date: dueDate || null,
      owner_id: user!.id,
    });

    setDescription("");
    setDueDate("");
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
      <div className="flex-1">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are you committing to?"
        />
      </div>
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-36"
      />
      <Button type="submit" size="sm" disabled={loading}>Add</Button>
    </form>
  );
}

function QuickCreateDecision({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user!.id)
      .limit(1)
      .single();

    await supabase.from("decisions").insert({
      organization_id: membership!.organization_id,
      title: title.trim(),
      context: context.trim() || null,
      owner_id: user!.id,
    });

    setTitle("");
    setContext("");
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 mb-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Decision title"
      />
      <div className="flex gap-2">
        <Input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Context (optional)"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={loading}>Add</Button>
      </div>
    </form>
  );
}

function QuickCreateIssue({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user!.id)
      .limit(1)
      .single();

    await supabase.from("issues").insert({
      organization_id: membership!.organization_id,
      description: description.trim(),
      severity,
      owner_id: user!.id,
    });

    setDescription("");
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
      <div className="flex-1">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
        />
      </div>
      <select
        value={severity}
        onChange={(e) => setSeverity(e.target.value)}
        className="rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>
      <Button type="submit" size="sm" disabled={loading}>Add</Button>
    </form>
  );
}

const severityBadge = (severity: string) => {
  const map: Record<string, "red" | "yellow" | "green" | "neutral"> = {
    critical: "red",
    high: "red",
    medium: "yellow",
    low: "neutral",
  };
  return map[severity] ?? "neutral";
};

export function OpsView({
  decisions,
  blockers,
  commitments,
  issues,
}: {
  decisions: Decision[];
  blockers: Blocker[];
  commitments: Commitment[];
  issues: Issue[];
}) {
  const [tab, setTab] = useState<Tab>("blockers");
  const router = useRouter();
  const refresh = () => router.refresh();

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "blockers", label: "Blockers", count: blockers.filter((b) => b.resolution_state === "open").length },
    { key: "commitments", label: "Commitments", count: commitments.filter((c) => c.status === "pending").length },
    { key: "decisions", label: "Decisions", count: decisions.filter((d) => !d.decided_at).length },
    { key: "issues", label: "Issues", count: issues.filter((i) => i.status === "open").length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Operations</h1>

      <div className="flex gap-1 mb-6 bg-ivory border border-warm-border rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-moss text-white"
                : "text-warm-gray hover:text-charcoal"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 text-xs opacity-75">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {tab === "blockers" && (
        <div>
          <QuickCreateBlocker onCreated={refresh} />
          <div className="space-y-2">
            {blockers.map((b) => (
              <Card key={b.id} borderColor={b.resolution_state === "open" ? "var(--color-semantic-brick)" : undefined}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${b.resolution_state !== "open" ? "line-through text-warm-gray" : ""}`}>
                      {b.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <AddToTodoButton
                        entityId={b.id}
                        entityType="blocker"
                        entityLabel={b.description}
                      />
                      <Badge status={severityBadge(b.severity)}>{b.severity}</Badge>
                      <span className="text-xs text-warm-gray">{b.resolution_state}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "commitments" && (
        <div>
          <QuickCreateCommitment onCreated={refresh} />
          <div className="space-y-2">
            {commitments.map((c) => (
              <Card key={c.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${c.status === "completed" ? "line-through text-warm-gray" : ""}`}>
                      {c.description}
                    </p>
                    <div className="flex items-center gap-2">
                      {c.due_date && (
                        <span className="text-xs text-warm-gray">
                          Due {new Date(c.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <Badge
                        status={
                          c.status === "completed"
                            ? "green"
                            : c.status === "missed"
                              ? "red"
                              : "neutral"
                        }
                      >
                        {c.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "decisions" && (
        <div>
          <QuickCreateDecision onCreated={refresh} />
          <div className="space-y-2">
            {decisions.map((d) => (
              <Card key={d.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      {d.context && (
                        <p className="text-xs text-warm-gray mt-0.5">{d.context}</p>
                      )}
                      {d.final_decision && (
                        <p className="text-sm text-semantic-green-text mt-1 font-medium">
                          Decision: {d.final_decision}
                        </p>
                      )}
                    </div>
                    <Badge status={d.decided_at ? "green" : "yellow"}>
                      {d.decided_at ? "Decided" : "Open"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "issues" && (
        <div>
          <QuickCreateIssue onCreated={refresh} />
          <div className="space-y-2">
            {issues.map((i) => (
              <Card key={i.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${i.status === "resolved" || i.status === "closed" ? "line-through text-warm-gray" : ""}`}>
                      {i.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge status={severityBadge(i.severity)}>{i.severity}</Badge>
                      <span className="text-xs text-warm-gray">{i.status}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
