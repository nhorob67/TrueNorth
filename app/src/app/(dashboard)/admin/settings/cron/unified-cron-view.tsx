"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VERCEL_CRONS, type VercelCronDefinition } from "@/lib/cron/vercel-registry";
import type { VercelCronExecution, HermesCronJob, HermesCronExecution } from "@/types/database";

type CronSection = "system" | "hermes" | "discord";

const SECTION_LABELS: Record<CronSection, string> = {
  system: "System Crons (Vercel)",
  hermes: "Agent Crons (Hermes)",
  discord: "Discord Broadcast Crons",
};

const SCHEDULE_PRESETS = [
  { label: "Every morning at 7am UTC", value: "0 7 * * *" },
  { label: "Every morning at 9am UTC", value: "0 9 * * *" },
  { label: "Every day at 5pm UTC", value: "0 17 * * *" },
  { label: "Every Monday at 8am UTC", value: "0 8 * * 1" },
  { label: "Every Monday at 9am UTC", value: "0 9 * * 1" },
  { label: "Every Friday at 4pm UTC", value: "0 16 * * 5" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Custom", value: "custom" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "green" | "red" | "yellow" | "neutral"> = {
    success: "green",
    error: "red",
    timeout: "yellow",
    skipped: "neutral",
  };
  return <Badge status={map[status] ?? "neutral"}>{status}</Badge>;
}

function humanSchedule(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [min, hour, dom, , dow] = parts;

  if (min.startsWith("*/")) return `Every ${min.slice(2)} minutes`;
  if (hour.startsWith("*/")) return `Every ${hour.slice(2)} hours`;
  if (dom !== "*" && dom.includes(",")) return `${dom} of each month at ${hour}:${min.padStart(2, "0")} UTC`;
  if (dow === "1" && dom === "*") return `Mondays at ${hour}:${min.padStart(2, "0")} UTC`;
  if (dom === "1" && hour !== "*") return `1st of month at ${hour}:${min.padStart(2, "0")} UTC`;
  if (hour !== "*" && min !== "*") return `Daily at ${hour}:${min.padStart(2, "0")} UTC`;
  return cron;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================
// Vercel System Crons Section
// ============================================================

function VercelCronRow({
  cron,
  executions,
}: {
  cron: VercelCronDefinition;
  executions: VercelCronExecution[];
}) {
  const [expanded, setExpanded] = useState(false);
  const cronExecs = executions.filter((e) => e.cron_path === cron.path);
  const lastExec = cronExecs[0];

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-hovered transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink">{cron.name}</p>
            {cron.isAiAgent && (
              <span className="inline-flex items-center rounded-full bg-sage px-1.5 py-0.5 text-[9px] font-mono text-white">
                AI
              </span>
            )}
          </div>
          <p className="text-xs text-subtle">{cron.description}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs font-mono text-faded">{humanSchedule(cron.schedule)}</span>
          {lastExec ? (
            <>
              <StatusBadge status={lastExec.status} />
              <span className="text-xs text-faded w-16 text-right">{timeAgo(lastExec.started_at)}</span>
            </>
          ) : (
            <span className="text-xs text-faded">No runs</span>
          )}
          <span className="text-xs text-faded">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && cronExecs.length > 0 && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-faded">
                <th className="text-left py-1 font-normal">Started</th>
                <th className="text-left py-1 font-normal">Status</th>
                <th className="text-left py-1 font-normal">Duration</th>
                <th className="text-left py-1 font-normal">Orgs</th>
                <th className="text-left py-1 font-normal">Error</th>
              </tr>
            </thead>
            <tbody>
              {cronExecs.slice(0, 10).map((exec) => (
                <tr key={exec.id} className="border-t border-line/50">
                  <td className="py-1.5 text-subtle">{new Date(exec.started_at).toLocaleString()}</td>
                  <td className="py-1.5"><StatusBadge status={exec.status} /></td>
                  <td className="py-1.5 text-subtle">{exec.duration_ms ? `${exec.duration_ms}ms` : "-"}</td>
                  <td className="py-1.5 text-subtle">{exec.organizations_processed}</td>
                  <td className="py-1.5 text-semantic-brick truncate max-w-[200px]">{exec.error_message ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Hermes Agent Crons Section
// ============================================================

interface HermesCronFormData {
  agent_profile: string;
  name: string;
  prompt: string;
  schedule: string;
  customSchedule: string;
  delivery_target: string;
  enabled: boolean;
}

const EMPTY_HERMES_FORM: HermesCronFormData = {
  agent_profile: "",
  name: "",
  prompt: "",
  schedule: "0 7 * * *",
  customSchedule: "",
  delivery_target: "supabase",
  enabled: true,
};

function HermesCronForm({
  initial,
  agentProfiles,
  orgId,
  onClose,
  editId,
}: {
  initial: HermesCronFormData;
  agentProfiles: Array<{ id: string; name: string; hermes_profile_name: string }>;
  orgId: string;
  onClose: () => void;
  editId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState<HermesCronFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [vpsWarning, setVpsWarning] = useState("");

  const isCustom = form.schedule === "custom";
  const effectiveSchedule = isCustom ? form.customSchedule : form.schedule;

  async function pushToVps(action: "register" | "update", jobId: string) {
    try {
      const res = await fetch("/api/hermes/cron/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          job: {
            id: jobId,
            orgId,
            profile: form.agent_profile,
            name: form.name.trim(),
            prompt: form.prompt.trim() || null,
            schedule: effectiveSchedule,
            enabled: form.enabled,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setVpsWarning(data.error ?? "VPS sync failed — job saved but won't execute until VPS is reachable.");
      }
    } catch {
      setVpsWarning("VPS sync failed — job saved but won't execute until VPS is reachable.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVpsWarning("");

    if (!form.agent_profile) {
      setError("Please select an agent profile.");
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (isCustom && !form.customSchedule.trim()) {
      setError("Please enter a custom cron expression.");
      return;
    }
    // Basic 5-part cron validation
    if (isCustom && form.customSchedule.trim().split(/\s+/).length !== 5) {
      setError("Cron expression must have 5 parts (e.g., */15 * * * *).");
      return;
    }

    setSaving(true);

    const payload = {
      organization_id: orgId,
      agent_profile: form.agent_profile,
      name: form.name.trim(),
      prompt: form.prompt.trim() || null,
      schedule: effectiveSchedule,
      delivery_target: form.delivery_target,
      enabled: form.enabled,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editId) {
        const { error: dbError } = await supabase
          .from("hermes_cron_jobs")
          .update(payload)
          .eq("id", editId);
        if (dbError) throw dbError;
        await pushToVps("update", editId);
      } else {
        const { data, error: dbError } = await supabase
          .from("hermes_cron_jobs")
          .insert(payload)
          .select("id")
          .single();
        if (dbError) {
          if (dbError.code === "23505") {
            setError("A cron job with this agent profile and name already exists.");
            setSaving(false);
            return;
          }
          throw dbError;
        }
        await pushToVps("register", data.id);
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cron job.");
    } finally {
      setSaving(false);
    }
  }

  // Check if current agent_profile is in the dropdown options (handles VPS-synced jobs)
  const profileInOptions = agentProfiles.some((a) => a.hermes_profile_name === form.agent_profile);
  const showFallbackOption = editId && form.agent_profile && !profileInOptions;

  return (
    <Card className="mb-4">
      <CardHeader>
        <p className="text-sm font-semibold text-ink">{editId ? "Edit Hermes Cron Job" : "New Hermes Cron Job"}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Agent Profile */}
          <div>
            <label className="text-xs font-mono text-faded uppercase tracking-widest block mb-1">Agent Profile</label>
            <select
              value={form.agent_profile}
              onChange={(e) => setForm({ ...form, agent_profile: e.target.value })}
              className="w-full bg-well border border-line rounded-[8px] px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent-glow/20 focus:outline-none"
            >
              <option value="">Select an agent...</option>
              {showFallbackOption && (
                <option value={form.agent_profile}>{form.agent_profile} (unknown profile)</option>
              )}
              {agentProfiles.map((a) => (
                <option key={a.id} value={a.hermes_profile_name}>
                  {a.name} ({a.hermes_profile_name})
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-mono text-faded uppercase tracking-widest block mb-1">Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Weekly Filter Review"
            />
          </div>

          {/* Prompt */}
          <div>
            <label className="text-xs font-mono text-faded uppercase tracking-widest block mb-1">Prompt (optional)</label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="Optional prompt to guide the agent's behavior on this schedule"
              rows={3}
              className="w-full bg-well border border-line rounded-[8px] px-3 py-2 text-sm text-ink placeholder:text-placeholder focus:ring-2 focus:ring-accent-glow/20 focus:outline-none resize-y"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="text-xs font-mono text-faded uppercase tracking-widest block mb-1">Schedule</label>
            <select
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              className="w-full bg-well border border-line rounded-[8px] px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent-glow/20 focus:outline-none"
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {isCustom && (
              <Input
                value={form.customSchedule}
                onChange={(e) => setForm({ ...form, customSchedule: e.target.value })}
                placeholder="*/15 * * * *"
                className="mt-2"
              />
            )}
          </div>

          {/* Delivery Target */}
          <div>
            <label className="text-xs font-mono text-faded uppercase tracking-widest block mb-1">Delivery Target</label>
            <select
              value={form.delivery_target}
              onChange={(e) => setForm({ ...form, delivery_target: e.target.value })}
              className="w-full bg-well border border-line rounded-[8px] px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent-glow/20 focus:outline-none"
            >
              <option value="supabase">Supabase</option>
              <option value="discord">Discord</option>
            </select>
          </div>

          {/* Enabled */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="rounded border-line accent-accent"
            />
            <span className="text-sm text-ink">Enabled</span>
          </label>

          {error && <p className="text-sm text-semantic-brick">{error}</p>}
          {vpsWarning && <p className="text-sm text-semantic-ochre">{vpsWarning}</p>}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function HermesCronRow({
  job,
  executions,
  onEdit,
  onDelete,
}: {
  job: HermesCronJob;
  executions: HermesCronExecution[];
  onEdit: (job: HermesCronJob) => void;
  onDelete: (jobId: string) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const jobExecs = executions.filter((e) => e.hermes_cron_job_id === job.id);
  const lastExec = jobExecs[0];

  async function handleToggle() {
    setToggling(true);
    const newEnabled = !job.enabled;
    await supabase
      .from("hermes_cron_jobs")
      .update({ enabled: newEnabled })
      .eq("id", job.id);

    // Push toggle to VPS
    try {
      await fetch("/api/hermes/cron/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          job: {
            id: job.id,
            orgId: job.organization_id,
            profile: job.agent_profile,
            name: job.name,
            prompt: job.prompt,
            schedule: job.schedule,
            enabled: newEnabled,
          },
        }),
      });
    } catch {
      // VPS push failed — toggle still saved to DB
    }

    setToggling(false);
    router.refresh();
  }

  return (
    <div className="border-b border-line last:border-b-0">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-sage px-1.5 py-0.5 text-[9px] font-mono text-white">
              {job.agent_profile}
            </span>
            <p className="text-sm font-medium text-ink">{job.name}</p>
          </div>
          {job.prompt && (
            <p className="text-xs text-subtle mt-0.5 truncate max-w-[400px]">{job.prompt}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-faded">{humanSchedule(job.schedule)}</span>
          <span className="text-xs text-faded">{job.delivery_target}</span>
          {lastExec ? (
            <>
              <StatusBadge status={lastExec.status} />
              <span className="text-xs text-faded">{timeAgo(lastExec.started_at)}</span>
            </>
          ) : job.last_run_status ? (
            <>
              <StatusBadge status={job.last_run_status} />
              {job.last_run_at && <span className="text-xs text-faded">{timeAgo(job.last_run_at)}</span>}
            </>
          ) : (
            <span className="text-xs text-faded">No runs</span>
          )}

          <Button variant="secondary" size="sm" onClick={() => onEdit(job)}>Edit</Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(job.id)}>Delete</Button>

          {/* Enable/disable toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              job.enabled ? "bg-accent" : "bg-well"
            } ${toggling ? "opacity-50" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                job.enabled ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>

          <button onClick={() => setExpanded(!expanded)} className="text-xs text-faded">
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {expanded && jobExecs.length > 0 && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-faded">
                <th className="text-left py-1 font-normal">Started</th>
                <th className="text-left py-1 font-normal">Status</th>
                <th className="text-left py-1 font-normal">Duration</th>
                <th className="text-left py-1 font-normal">Error</th>
              </tr>
            </thead>
            <tbody>
              {jobExecs.slice(0, 10).map((exec) => (
                <tr key={exec.id} className="border-t border-line/50">
                  <td className="py-1.5 text-subtle">{new Date(exec.started_at).toLocaleString()}</td>
                  <td className="py-1.5"><StatusBadge status={exec.status} /></td>
                  <td className="py-1.5 text-subtle">{exec.duration_ms ? `${exec.duration_ms}ms` : "-"}</td>
                  <td className="py-1.5 text-semantic-brick truncate max-w-[200px]">{exec.error_message ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Unified Cron View
// ============================================================

interface UnifiedCronViewProps {
  vercelExecs: VercelCronExecution[];
  hermesCrons: HermesCronJob[];
  hermesExecs: HermesCronExecution[];
  orgId: string;
  agentProfiles: Array<{ id: string; name: string; hermes_profile_name: string }>;
  children: React.ReactNode; // Existing CronView component
}

export function UnifiedCronView({
  vercelExecs,
  hermesCrons,
  hermesExecs,
  orgId,
  agentProfiles,
  children,
}: UnifiedCronViewProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<CronSection>("system");
  const [showHermesForm, setShowHermesForm] = useState(false);
  const [editingHermesJob, setEditingHermesJob] = useState<HermesCronJob | null>(null);

  const sections: CronSection[] = ["system", "hermes", "discord"];

  function startHermesEdit(job: HermesCronJob) {
    setEditingHermesJob(job);
    setShowHermesForm(true);
  }

  async function handleHermesDelete(jobId: string) {
    if (!confirm("Delete this Hermes cron job? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("hermes_cron_jobs").delete().eq("id", jobId);

    // Push delete to VPS
    try {
      await fetch("/api/hermes/cron/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId }),
      });
    } catch {
      // VPS push failed — job still deleted from DB
    }

    router.refresh();
  }

  function getHermesFormInitial(): HermesCronFormData {
    if (editingHermesJob) {
      const isPreset = SCHEDULE_PRESETS.some((p) => p.value === editingHermesJob.schedule);
      return {
        agent_profile: editingHermesJob.agent_profile,
        name: editingHermesJob.name,
        prompt: editingHermesJob.prompt ?? "",
        schedule: isPreset ? editingHermesJob.schedule : "custom",
        customSchedule: isPreset ? "" : editingHermesJob.schedule,
        delivery_target: editingHermesJob.delivery_target,
        enabled: editingHermesJob.enabled,
      };
    }
    return EMPTY_HERMES_FORM;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">
          Cron & Schedules
        </h2>
        <p className="text-subtle text-sm mt-1">
          Monitor system crons, Hermes agent schedules, and Discord broadcast jobs
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-line">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeSection === section
                ? "border-accent text-ink"
                : "border-transparent text-subtle hover:text-ink"
            }`}
          >
            {SECTION_LABELS[section]}
            {section === "hermes" && hermesCrons.length > 0 && (
              <span className="ml-1.5 text-xs font-mono text-faded">{hermesCrons.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* System Crons */}
      {activeSection === "system" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">
                Vercel System Crons
              </p>
              <span className="text-xs font-mono text-subtle">{VERCEL_CRONS.length} jobs</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {VERCEL_CRONS.map((cron) => (
              <VercelCronRow
                key={cron.path}
                cron={cron}
                executions={vercelExecs}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Hermes Agent Crons */}
      {activeSection === "hermes" && (
        <>
          {showHermesForm && (
            <HermesCronForm
              key={editingHermesJob?.id ?? "new"}
              initial={getHermesFormInitial()}
              agentProfiles={agentProfiles}
              orgId={orgId}
              editId={editingHermesJob?.id}
              onClose={() => {
                setShowHermesForm(false);
                setEditingHermesJob(null);
              }}
            />
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">
                  Hermes Agent Cron Jobs
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-subtle">{hermesCrons.length} jobs</span>
                  {!showHermesForm && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingHermesJob(null);
                        setShowHermesForm(true);
                      }}
                    >
                      + New Hermes Cron
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {hermesCrons.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-subtle">No Hermes cron jobs configured.</p>
                  <p className="text-xs text-faded mt-1">
                    Click &ldquo;+ New Hermes Cron&rdquo; above to create your first agent schedule.
                  </p>
                </div>
              ) : (
                hermesCrons.map((job) => (
                  <HermesCronRow
                    key={job.id}
                    job={job}
                    executions={hermesExecs}
                    onEdit={startHermesEdit}
                    onDelete={handleHermesDelete}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Discord Broadcast Crons (existing CronView) */}
      {activeSection === "discord" && children}
    </div>
  );
}
