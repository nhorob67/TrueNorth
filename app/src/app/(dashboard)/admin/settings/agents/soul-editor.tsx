"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface SoulEditorProps {
  agentId: string;
  currentSoul: string | null;
  profileName: string | null;
  onClose: () => void;
}

export function SoulEditor({ agentId, currentSoul, profileName, onClose }: SoulEditorProps) {
  const router = useRouter();
  const supabase = createClient();
  const [soul, setSoul] = useState(currentSoul ?? "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("agents")
      .update({ soul_content: soul.trim() || null })
      .eq("id", agentId);
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function handleSyncToVps() {
    if (!profileName) return;
    setSyncing(true);
    setSyncStatus("idle");
    try {
      const res = await fetch("/api/agents/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "to-vps",
          type: "soul",
          agentId,
          data: { profile_name: profileName, content: soul.trim() },
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
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          SOUL.md
        </label>
        <p className="text-xs text-subtle mb-2">
          Defines this agent&apos;s identity, purpose, authority, and operating rules.
          Synced to the Hermes profile on the VPS.
        </p>
        <textarea
          value={soul}
          onChange={(e) => setSoul(e.target.value)}
          placeholder={`# Agent Name\n\n## Identity\nYou are TrueNorth's...\n\n## Purpose\n...\n\n## Authority\n...\n\n## Operating Rules\n1. Always log actions via mcp_truenorth_actions_log_action\n2. ...`}
          className="w-full min-h-[200px] rounded-lg border border-line bg-surface px-3 py-2 text-sm font-mono focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
        <p className="text-xs text-faded mt-1">
          {soul.length} / 20,000 characters
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save SOUL"}
        </Button>
        {profileName && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncToVps}
            disabled={syncing || !soul.trim()}
          >
            {syncing ? "Syncing..." : "Sync to VPS"}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {syncStatus === "success" && (
          <span className="text-xs text-semantic-green">Synced</span>
        )}
        {syncStatus === "error" && (
          <span className="text-xs text-semantic-brick">Sync failed</span>
        )}
      </div>
    </div>
  );
}
