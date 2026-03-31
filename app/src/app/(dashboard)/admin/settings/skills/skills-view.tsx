"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import type { AgentSkill } from "@/types/database";

// ============================================================
// Types
// ============================================================

type FilterMode = "all" | "pending" | "approved" | "auto_generated" | "shared";

interface AgentInfo {
  id: string;
  name: string;
  category: string;
  hermes_profile_name: string | null;
  hermes_enabled: boolean;
}

interface SkillsViewProps {
  skills: AgentSkill[];
  agents: AgentInfo[];
  orgId: string;
  isAdmin: boolean;
  userId: string;
}

// ============================================================
// Helpers
// ============================================================

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  vps_sync: "VPS Sync",
  auto_generated: "Auto-Generated",
};

function agentName(profile: string, agents: AgentInfo[]): string {
  const agent = agents.find((a) => a.hermes_profile_name === profile);
  return agent?.name ?? profile;
}

// ============================================================
// Skill Card
// ============================================================

function SkillCard({
  skill,
  isAdmin,
  onApprove,
  onReject,
  onToggleShare,
  onDelete,
  onUpdate,
}: {
  skill: AgentSkill;
  isAdmin: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onToggleShare: (id: string, shared: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, content: string, description: string | null) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(skill.skill_content);
  const [editDesc, setEditDesc] = useState(skill.skill_description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onUpdate(skill.id, editContent, editDesc.trim() || null);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-hovered transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-sage px-1.5 py-0.5 text-[9px] font-mono text-white shrink-0">
              {skill.agent_profile}
            </span>
            <p className="text-sm font-medium text-ink">{skill.skill_name}</p>
            {skill.auto_generated && (
              <Badge status="yellow">Auto-Generated</Badge>
            )}
            {skill.approved ? (
              <Badge status="green">Approved</Badge>
            ) : (
              <Badge status="neutral">Pending</Badge>
            )}
            {skill.shared && (
              <Badge status="neutral">Shared</Badge>
            )}
          </div>
          {skill.skill_description && (
            <p className="text-xs text-subtle mt-0.5 truncate">{skill.skill_description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-faded">v{skill.version}</span>
          <span className="text-xs text-faded">
            {SOURCE_LABELS[skill.source] ?? skill.source}
          </span>
          <span className="text-xs text-faded">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-line px-4 py-3">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Brief description of what this skill does..."
                  className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Skill Content (SKILL.md)</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[250px] rounded-lg border border-line bg-surface px-3 py-2 text-sm font-mono focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditContent(skill.skill_content);
                    setEditDesc(skill.skill_description ?? "");
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <pre className="text-sm text-subtle whitespace-pre-wrap font-mono bg-well rounded-lg p-3 max-h-[400px] overflow-y-auto">
                {skill.skill_content}
              </pre>

              {/* Actions */}
              {isAdmin && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line">
                  {!skill.approved && (
                    <>
                      <Button size="sm" onClick={() => onApprove(skill.id)}>
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onReject(skill.id)}
                      >
                        Reject & Delete
                      </Button>
                    </>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onToggleShare(skill.id, skill.shared)}
                  >
                    {skill.shared ? "Unshare" : "Share to Team"}
                  </Button>
                  {skill.approved && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onDelete(skill.id)}
                    >
                      Delete
                    </Button>
                  )}
                  <span className="ml-auto text-xs text-faded">
                    Created {new Date(skill.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Create Skill Dialog
// ============================================================

function CreateSkillDialog({
  agents,
  orgId,
  onClose,
}: {
  agents: AgentInfo[];
  orgId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [profile, setProfile] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  async function handleCreate() {
    if (!profile || !name || !content) return;
    setCreating(true);
    await supabase.from("agent_skills").insert({
      organization_id: orgId,
      agent_profile: profile,
      skill_name: name.trim(),
      skill_description: description.trim() || null,
      skill_content: content,
      auto_generated: false,
      approved: true, // Manual skills are pre-approved
      source: "manual",
    });
    setCreating(false);
    onClose();
    router.refresh();
  }

  const hermesAgents = agents.filter((a) => a.hermes_enabled && a.hermes_profile_name);

  return (
    <Dialog open onClose={onClose} title="Create Skill">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Agent Profile</label>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
          >
            <option value="">Select agent...</option>
            {hermesAgents.map((a) => (
              <option key={a.hermes_profile_name} value={a.hermes_profile_name!}>
                {a.name} ({a.hermes_profile_name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Skill Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., seasonal-kpi-adjustment"
            className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description..."
            className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Skill Content (SKILL.md)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"---\nplatforms: [macos, linux]\n---\n\n# Skill Name\n\n## When to Use\n...\n\n## Procedure\n...\n\n## Verification\n..."}
            className="w-full min-h-[200px] rounded-lg border border-line bg-surface px-3 py-2 text-sm font-mono focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || !profile || !name || !content}
        >
          {creating ? "Creating..." : "Create Skill"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ============================================================
// Main Skills View
// ============================================================

export function SkillsView({ skills, agents, orgId, isAdmin, userId }: SkillsViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  // Get unique profiles from skills
  const profiles = useMemo(() => {
    const set = new Set(skills.map((s) => s.agent_profile));
    return [...set].sort();
  }, [skills]);

  // Filter skills
  const filteredSkills = useMemo(() => {
    let result = skills;

    if (profileFilter !== "all") {
      result = result.filter((s) => s.agent_profile === profileFilter);
    }

    switch (filter) {
      case "pending":
        result = result.filter((s) => !s.approved);
        break;
      case "approved":
        result = result.filter((s) => s.approved);
        break;
      case "auto_generated":
        result = result.filter((s) => s.auto_generated);
        break;
      case "shared":
        result = result.filter((s) => s.shared);
        break;
    }

    return result;
  }, [skills, filter, profileFilter]);

  // Counts
  const pendingCount = skills.filter((s) => !s.approved).length;
  const autoCount = skills.filter((s) => s.auto_generated).length;
  const sharedCount = skills.filter((s) => s.shared).length;

  // Actions
  async function handleApprove(id: string) {
    await supabase
      .from("agent_skills")
      .update({ approved: true, approved_by: userId, approved_at: new Date().toISOString() })
      .eq("id", id);
    router.refresh();
  }

  async function handleReject(id: string) {
    await supabase.from("agent_skills").delete().eq("id", id);
    router.refresh();
  }

  async function handleToggleShare(id: string, currentlyShared: boolean) {
    await supabase
      .from("agent_skills")
      .update({ shared: !currentlyShared })
      .eq("id", id);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await supabase.from("agent_skills").delete().eq("id", id);
    router.refresh();
  }

  async function handleUpdate(id: string, content: string, description: string | null) {
    await supabase
      .from("agent_skills")
      .update({ skill_content: content, skill_description: description })
      .eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">
            Agent Skills
          </h2>
          <p className="text-subtle text-sm mt-1">
            {skills.length} skills across {profiles.length} agents
            {pendingCount > 0 && (
              <span className="text-semantic-ochre"> &middot; {pendingCount} pending review</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Create Skill
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Status filter */}
        <div className="flex gap-1 bg-well rounded-lg p-0.5">
          {([
            { key: "all", label: "All" },
            { key: "pending", label: `Pending (${pendingCount})` },
            { key: "approved", label: "Approved" },
            { key: "auto_generated", label: `Auto (${autoCount})` },
            { key: "shared", label: `Shared (${sharedCount})` },
          ] as Array<{ key: FilterMode; label: string }>).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                filter === key
                  ? "bg-surface text-ink shadow-sm"
                  : "text-subtle hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Profile filter */}
        {profiles.length > 1 && (
          <select
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className="rounded-lg border border-line bg-well px-3 py-1.5 text-xs font-mono"
          >
            <option value="all">All agents</option>
            {profiles.map((p) => (
              <option key={p} value={p}>
                {agentName(p, agents)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Skills list */}
      {filteredSkills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-subtle">
              {skills.length === 0
                ? "No skills yet. Skills are created as agents learn from their interactions, or you can create them manually."
                : "No skills match the current filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isAdmin={isAdmin}
              onApprove={handleApprove}
              onReject={handleReject}
              onToggleShare={handleToggleShare}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateSkillDialog
          agents={agents}
          orgId={orgId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
