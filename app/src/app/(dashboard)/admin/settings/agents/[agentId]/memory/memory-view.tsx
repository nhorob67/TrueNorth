"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AgentMemory, AgentMemoryType } from "@/types/database";

const MEMORY_TYPE_LABELS: Record<AgentMemoryType, string> = {
  core: "Core Knowledge",
  user: "User Profile",
  session: "Session Logs",
};

const MEMORY_TYPE_DESCRIPTIONS: Record<AgentMemoryType, string> = {
  core: "Agent-learned observations: patterns, conventions, lessons.",
  user: "Organization profile: brand voice, team preferences, domain terms.",
  session: "Summaries and key learnings from individual runs.",
};

interface MemoryViewProps {
  agent: {
    id: string;
    name: string;
    category: string;
    hermes_profile_name: string | null;
    hermes_enabled: boolean;
  };
  memories: AgentMemory[];
  isAdmin: boolean;
}

function MemoryEntry({
  memory,
  isAdmin,
  onSave,
  onDelete,
}: {
  memory: AgentMemory;
  isAdmin: boolean;
  onSave: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(memory.content);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(memory.id, content);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="border border-line rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink">{memory.key}</p>
          <span className="text-xs font-mono text-faded">v{memory.version}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-faded">
            {new Date(memory.updated_at).toLocaleDateString()}
          </span>
          {isAdmin && !editing && (
            <>
              <Button variant="tertiary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="tertiary" size="sm" onClick={() => onDelete(memory.id)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full min-h-[120px] rounded-lg border border-line bg-surface px-3 py-2 text-sm font-mono focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setContent(memory.content);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-subtle whitespace-pre-wrap">{memory.content}</p>
      )}
    </div>
  );
}

export function MemoryView({ agent, memories, isAdmin }: MemoryViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<AgentMemoryType>("core");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  const tabs: AgentMemoryType[] = ["core", "user", "session"];
  const filteredMemories = memories.filter((m) => m.memory_type === activeTab);

  const memoryCounts = {
    core: memories.filter((m) => m.memory_type === "core").length,
    user: memories.filter((m) => m.memory_type === "user").length,
    session: memories.filter((m) => m.memory_type === "session").length,
  };

  async function handleSave(memoryId: string, content: string) {
    await supabase
      .from("agent_memory")
      .update({ content })
      .eq("id", memoryId);
    router.refresh();
  }

  async function handleDelete(memoryId: string) {
    await supabase
      .from("agent_memory")
      .delete()
      .eq("id", memoryId);
    router.refresh();
  }

  async function handleSyncToVps() {
    if (!agent.hermes_profile_name) return;
    setSyncing(true);
    setSyncStatus("idle");
    try {
      const res = await fetch("/api/agents/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "to-vps",
          type: "memory",
          agentId: agent.id,
          data: {
            profile_name: agent.hermes_profile_name,
            content: JSON.stringify(
              memories.filter((m) => m.memory_type !== "session").map((m) => ({
                type: m.memory_type,
                key: m.key,
                content: m.content,
              }))
            ),
          },
        }),
      });
      setSyncStatus(res.ok ? "success" : "error");
    } catch {
      setSyncStatus("error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/settings/agents"
              className="text-sm text-subtle hover:text-ink"
            >
              AI Agents
            </Link>
            <span className="text-sm text-faded">/</span>
            <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">
              {agent.name} Memory
            </h2>
          </div>
          <p className="text-subtle text-sm">
            {memories.length} memories across {Object.values(memoryCounts).filter((c) => c > 0).length} categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          {agent.hermes_profile_name && agent.hermes_enabled && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncToVps}
              disabled={syncing}
            >
              {syncing ? "Syncing..." : "Sync to VPS"}
            </Button>
          )}
          {syncStatus === "success" && (
            <span className="text-xs text-semantic-green">Synced</span>
          )}
          {syncStatus === "error" && (
            <span className="text-xs text-semantic-brick">Failed</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-accent text-ink"
                : "border-transparent text-subtle hover:text-ink"
            }`}
          >
            {MEMORY_TYPE_LABELS[tab]}
            {memoryCounts[tab] > 0 && (
              <span className="ml-1.5 text-xs font-mono text-faded">
                {memoryCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        <p className="text-xs text-subtle mb-4">{MEMORY_TYPE_DESCRIPTIONS[activeTab]}</p>

        {filteredMemories.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-subtle">
                No {MEMORY_TYPE_LABELS[activeTab].toLowerCase()} entries yet.
              </p>
              <p className="text-xs text-faded mt-1">
                {activeTab === "session"
                  ? "Session memories are created automatically when the agent runs."
                  : "Memories are created as the agent learns from its interactions."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredMemories.map((memory) => (
              <MemoryEntry
                key={memory.id}
                memory={memory}
                isAdmin={isAdmin}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
