"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/loading";
import { previewFormatTemplate, DEFAULT_FORMAT_TEMPLATE } from "@/lib/cron/format";
import type { CronJob, CronExecution } from "@/types/database";

// Template options (mirrors TEMPLATE_REGISTRY keys)
const TEMPLATE_OPTIONS = [
  { value: "kpi_scoreboard", label: "KPI Scoreboard" },
  { value: "weekly_priorities", label: "Weekly Priorities" },
  { value: "daily_work_summary", label: "Daily Work Summary" },
  { value: "blocker_report", label: "Blocker Report" },
  { value: "cockpit_summary", label: "Cockpit Summary" },
  { value: "stale_artifacts", label: "Stale Artifacts" },
  { value: "moves_progress", label: "Moves Progress" },
  { value: "rhythm_health", label: "Rhythm Health" },
  { value: "kpi_single", label: "KPI Detail View" },
  { value: "bet_status", label: "Bet Status Overview" },
  { value: "idea_vault_new", label: "Idea Vault" },
  { value: "funnel_health", label: "Funnel Health" },
  { value: "pulse_streaks", label: "Pulse Streaks" },
  { value: "commitment_tracker", label: "Commitment Tracker" },
  { value: "content_pipeline", label: "Content Pipeline" },
  { value: "kill_switch_report", label: "Kill Switch Report" },
  { value: "decision_log", label: "Decision Log" },
  { value: "portfolio_summary", label: "Portfolio Summary" },
  { value: "cadence_compliance", label: "Cadence Compliance" },
  { value: "automation_ladder", label: "Automation Ladder" },
  { value: "agent_performance", label: "Agent Performance" },
];

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

const DAY_FILTER_OPTIONS = [
  { value: "", label: "No filter" },
  { value: "weekday", label: "Weekdays only (Mon-Fri)" },
  { value: "month_start", label: "1st of month only" },
];

interface CronViewProps {
  cronJobs: CronJob[];
  executions: CronExecution[];
  orgId: string;
  ventures: Array<{ id: string; name: string }>;
}

function describeSchedule(schedule: string): string {
  const preset = SCHEDULE_PRESETS.find((p) => p.value === schedule);
  if (preset && preset.value !== "custom") return preset.label;
  return schedule;
}

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString();
}

// ============================================================
// Format Template Editor with Live Preview
// ============================================================

function FormatTemplateEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const preview = value ? previewFormatTemplate(value) : "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-ink">
          Format Template (Handlebars)
        </label>
        <div className="flex gap-2">
          {!value && (
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() => onChange(DEFAULT_FORMAT_TEMPLATE)}
            >
              Use default template
            </button>
          )}
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`{{title}}\n\n{{#each sections}}\n**{{heading}}**\n{{#each items}}\n{{status_emoji}} **{{label}}**: {{value}}\n{{/each}}\n{{/each}}`}
        className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-mono min-h-[120px] focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
      />

      <p className="text-xs text-subtle">
        Variables: {"{{title}}"}, {"{{heading}}"}, {"{{label}}"}, {"{{value}}"}, {"{{status_emoji}}"}. Loops: {"{{#each sections}}"}, {"{{#each items}}"}.
      </p>

      {showPreview && value && (
        <div className="p-3 rounded-lg bg-canvas border border-line">
          <p className="text-xs font-medium text-subtle mb-1">Live Preview (mock data):</p>
          <pre className="text-sm text-ink whitespace-pre-wrap font-sans">
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Create / Edit Form
// ============================================================

interface JobFormData {
  name: string;
  description: string;
  schedule: string;
  customSchedule: string;
  query_template: string;
  discord_webhook_url: string;
  venture_id: string;
  enabled: boolean;
  // Conditional logic
  only_if_data: boolean;
  day_filter: string;
  // Format template
  handlebars_template: string;
}

const EMPTY_FORM: JobFormData = {
  name: "",
  description: "",
  schedule: "0 7 * * *",
  customSchedule: "",
  query_template: "kpi_scoreboard",
  discord_webhook_url: "",
  venture_id: "",
  enabled: true,
  only_if_data: false,
  day_filter: "",
  handlebars_template: "",
};

function CronJobForm({
  initial,
  ventures,
  orgId,
  onClose,
  editId,
}: {
  initial: JobFormData;
  ventures: Array<{ id: string; name: string }>;
  orgId: string;
  onClose: () => void;
  editId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<JobFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [useComposed, setUseComposed] = useState(
    initial.query_template.includes(",")
  );

  const isCustom = form.schedule === "custom";
  const effectiveSchedule = isCustom ? form.customSchedule : form.schedule;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");

    const supabase = createClient();

    // Build format_template jsonb from conditions and handlebars
    const formatTemplate: Record<string, unknown> = {};
    if (form.only_if_data) formatTemplate.only_if_data = true;
    if (form.day_filter) formatTemplate.day_filter = form.day_filter;
    if (form.handlebars_template.trim()) {
      formatTemplate.handlebars_template = form.handlebars_template;
    }

    const payload = {
      organization_id: orgId,
      venture_id: form.venture_id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      schedule: effectiveSchedule,
      query_template: form.query_template,
      discord_webhook_url: form.discord_webhook_url.trim() || null,
      enabled: form.enabled,
      format_template: Object.keys(formatTemplate).length > 0 ? formatTemplate : null,
      updated_at: new Date().toISOString(),
    };

    if (editId) {
      const { error: err } = await supabase
        .from("cron_jobs")
        .update(payload)
        .eq("id", editId);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase
        .from("cron_jobs")
        .insert(payload);
      if (err) setError(err.message);
    }

    setSaving(false);
    if (!error) {
      onClose();
      router.refresh();
    }
  }

  return (
    <Card className="border-line bg-surface">
      <CardHeader>
        <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">
          {editId ? "Edit Cron Job" : "New Cron Job"}
        </h3>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Morning KPI broadcast"
            required
          />

          <Input
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Posts KPI scoreboard to Discord every morning"
          />

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Schedule
            </label>
            <select
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              value={
                SCHEDULE_PRESETS.some((p) => p.value === form.schedule)
                  ? form.schedule
                  : "custom"
              }
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setForm({ ...form, schedule: "custom", customSchedule: form.schedule === "custom" ? form.customSchedule : "" });
                } else {
                  setForm({ ...form, schedule: e.target.value });
                }
              }}
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {isCustom && (
              <Input
                label="Cron expression (5-field)"
                value={form.customSchedule}
                onChange={(e) =>
                  setForm({ ...form, customSchedule: e.target.value })
                }
                placeholder="*/15 * * * *"
                className="mt-2"
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-ink">
                Query Template{useComposed ? "s (comma-separated)" : ""}
              </label>
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() => setUseComposed(!useComposed)}
              >
                {useComposed ? "Single template" : "Compose multiple"}
              </button>
            </div>

            {useComposed ? (
              <div className="space-y-2">
                <Input
                  value={form.query_template}
                  onChange={(e) =>
                    setForm({ ...form, query_template: e.target.value })
                  }
                  placeholder="kpi_scoreboard,blocker_report"
                />
                <p className="text-xs text-subtle">
                  Comma-separated template keys. Results are merged into a single broadcast.
                </p>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className="text-xs px-2 py-0.5 rounded border border-line hover:bg-canvas text-subtle"
                      onClick={() => {
                        const current = form.query_template
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (!current.includes(t.value)) {
                          setForm({
                            ...form,
                            query_template: [...current, t.value].join(","),
                          });
                        }
                      }}
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <select
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                value={form.query_template}
                onChange={(e) =>
                  setForm({ ...form, query_template: e.target.value })
                }
              >
                {TEMPLATE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {ventures.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Venture (optional, leave blank for org-wide)
              </label>
              <select
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                value={form.venture_id}
                onChange={(e) =>
                  setForm({ ...form, venture_id: e.target.value })
                }
              >
                <option value="">All ventures</option>
                {ventures.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Discord Webhook URL (optional)"
            value={form.discord_webhook_url}
            onChange={(e) =>
              setForm({ ...form, discord_webhook_url: e.target.value })
            }
            placeholder="https://discord.com/api/webhooks/..."
          />

          {/* Conditional Logic Section */}
          <div className="space-y-3 p-3 rounded-lg border border-line bg-canvas">
            <p className="text-sm font-medium text-ink">Conditions</p>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.only_if_data}
                onChange={(e) => setForm({ ...form, only_if_data: e.target.checked })}
                className="rounded border-line"
              />
              Only send if data is present
            </label>

            <div>
              <label className="block text-xs font-medium text-subtle mb-1">
                Day Filter
              </label>
              <select
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                value={form.day_filter}
                onChange={(e) => setForm({ ...form, day_filter: e.target.value })}
              >
                {DAY_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Format Template Editor */}
          <FormatTemplateEditor
            value={form.handlebars_template}
            onChange={(val) => setForm({ ...form, handlebars_template: val })}
          />

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="rounded border-line"
            />
            Enabled
          </label>

          {error && (
            <p className="text-sm text-semantic-brick">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Execution History
// ============================================================

function ExecutionHistory({ executions }: { executions: CronExecution[] }) {
  if (executions.length === 0) {
    return (
      <p className="text-sm text-subtle italic">No executions yet</p>
    );
  }

  return (
    <div className="space-y-2">
      {executions.map((ex) => (
        <div
          key={ex.id}
          className="flex items-center justify-between text-sm border-b border-line pb-1"
        >
          <div className="flex items-center gap-2">
            <Badge
              status={
                ex.status === "success"
                  ? "green"
                  : ex.status === "error"
                    ? "red"
                    : "neutral"
              }
            >
              {ex.status}
            </Badge>
            <span className="text-subtle">{formatTime(ex.started_at)}</span>
          </div>
          <span className="text-subtle">
            {ex.records_processed} record{ex.records_processed !== 1 ? "s" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Test Fire Result Display
// ============================================================

interface TemplateResult {
  hasData: boolean;
  title: string;
  sections: Array<{
    heading: string;
    items: Array<{ label: string; value: string; status?: string }>;
  }>;
}

function TestResult({ result }: { result: TemplateResult }) {
  const statusEmoji: Record<string, string> = {
    green: "\uD83D\uDFE2",
    yellow: "\uD83D\uDFE1",
    red: "\uD83D\uDD34",
  };

  return (
    <div className="mt-3 p-3 rounded-lg bg-canvas border border-line text-sm">
      <p className="font-semibold text-ink mb-2">{result.title}</p>
      {!result.hasData && (
        <p className="text-subtle italic">No data to display</p>
      )}
      {result.sections.map((section, si) => (
        <div key={si} className="mb-2">
          <p className="font-medium text-ink">{section.heading}</p>
          <ul className="ml-4 space-y-0.5">
            {section.items.map((item, ii) => (
              <li key={ii} className="text-subtle">
                {item.status ? statusEmoji[item.status] + " " : ""}
                <span className="font-medium text-ink">
                  {item.label}
                </span>
                : {item.value}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Cron View
// ============================================================

export function CronView({ cronJobs, executions, orgId, ventures }: CronViewProps) {
  const router = useRouter();
  const supabase = createClient();

  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TemplateResult>>({});
  const [testingJob, setTestingJob] = useState<string | null>(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  async function handleSeedDefaults() {
    setSeedingDefaults(true);
    try {
      const res = await fetch("/api/cron/seed-defaults", { method: "POST" });
      const data = await res.json();
      if (data.success || data.skipped) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to seed defaults:", err);
    } finally {
      setSeedingDefaults(false);
    }
  }

  function getJobExecutions(jobId: string): CronExecution[] {
    return executions
      .filter((e) => e.cron_job_id === jobId)
      .slice(0, 5);
  }

  async function handleToggleEnabled(job: CronJob) {
    await supabase
      .from("cron_jobs")
      .update({ enabled: !job.enabled, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    router.refresh();
  }

  async function handleDelete(jobId: string) {
    if (!confirm("Delete this cron job? This cannot be undone.")) return;
    await supabase.from("cron_jobs").delete().eq("id", jobId);
    router.refresh();
  }

  async function handleTestFire(job: CronJob) {
    setTestingJob(job.id);
    try {
      // Run template directly via the browser Supabase client.
      const { executeTemplate } = await import("@/lib/cron/templates");
      const templateKeys = job.query_template.split(",").map((k: string) => k.trim()).filter(Boolean);

      let result: TemplateResult;
      if (templateKeys.length === 1) {
        result = await executeTemplate(
          templateKeys[0],
          supabase,
          job.organization_id,
          job.venture_id
        );
      } else {
        // Composed: run all and merge
        const results = await Promise.all(
          templateKeys.map((key: string) =>
            executeTemplate(key, supabase, job.organization_id, job.venture_id)
          )
        );
        const mergedSections = results.flatMap((r) => r.sections);
        const titles = results.map((r) => r.title).filter(Boolean);
        result = {
          hasData: results.some((r) => r.hasData),
          title: `Morning Briefing: ${titles.join(" + ")}`,
          sections: mergedSections,
        };
      }

      setTestResults((prev) => ({ ...prev, [job.id]: result }));
    } catch (err) {
      console.error("Test fire failed:", err);
    } finally {
      setTestingJob(null);
    }
  }

  function startEdit(job: CronJob) {
    setEditingJob(job);
    setShowForm(true);
  }

  function getFormInitial(): JobFormData {
    if (editingJob) {
      const isPreset = SCHEDULE_PRESETS.some(
        (p) => p.value === editingJob.schedule && p.value !== "custom"
      );
      const formatConfig = (editingJob.format_template ?? {}) as Record<string, unknown>;

      return {
        name: editingJob.name,
        description: editingJob.description ?? "",
        schedule: isPreset ? editingJob.schedule : "custom",
        customSchedule: isPreset ? "" : editingJob.schedule,
        query_template: editingJob.query_template,
        discord_webhook_url: editingJob.discord_webhook_url ?? "",
        venture_id: editingJob.venture_id ?? "",
        enabled: editingJob.enabled,
        only_if_data: formatConfig.only_if_data === true,
        day_filter: (formatConfig.day_filter as string) ?? "",
        handlebars_template: (formatConfig.handlebars_template as string) ?? "",
      };
    }
    return EMPTY_FORM;
  }

  function describeTemplate(queryTemplate: string): string {
    const keys = queryTemplate.split(",").map((k) => k.trim());
    return keys
      .map((k) => TEMPLATE_OPTIONS.find((t) => t.value === k)?.label ?? k)
      .join(" + ");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">Cron Broadcasts</h2>
          <p className="text-subtle text-sm mt-1">
            Schedule automated data broadcasts to Discord
          </p>
        </div>
        {!showForm && (
          <Button
            variant="primary"
            onClick={() => {
              setEditingJob(null);
              setShowForm(true);
            }}
          >
            New Cron Job
          </Button>
        )}
      </div>

      {cronJobs.length === 0 && !showForm && (
        <Card className="border-line bg-canvas">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">
                Get started with 5 pre-configured broadcast jobs
              </p>
              <p className="text-sm text-subtle mt-0.5">
                Morning Scoreboard, Weekly Priorities, Daily Recap, Blocker Nag,
                and Cockpit Daily — all created as disabled so you can configure
                webhooks first.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleSeedDefaults}
              disabled={seedingDefaults}
              className="ml-4 shrink-0"
            >
              {seedingDefaults ? "Setting up..." : "Set Up Defaults"}
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <CronJobForm
          initial={getFormInitial()}
          ventures={ventures}
          orgId={orgId}
          editId={editingJob?.id}
          onClose={() => {
            setShowForm(false);
            setEditingJob(null);
          }}
        />
      )}

      {cronJobs.length === 0 && !showForm ? (
        <EmptyState
          title="No cron jobs yet"
          description="Create a cron job to start broadcasting data to Discord on a schedule."
        />
      ) : (
        <div className="space-y-4">
          {cronJobs.map((job) => {
            const isExpanded = expandedJob === job.id;
            const jobExecs = getJobExecutions(job.id);
            const formatConfig = (job.format_template ?? {}) as Record<string, unknown>;
            const hasConditions = Boolean(formatConfig.only_if_data) || Boolean(formatConfig.day_filter);
            const isComposed = job.query_template.includes(",");

            return (
              <Card key={job.id} className="border-line bg-surface">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-ink">
                          {job.name}
                        </h3>
                        <Badge status={job.enabled ? "green" : "neutral"}>
                          {job.enabled ? "Active" : "Disabled"}
                        </Badge>
                        {job.last_run_status && (
                          <Badge
                            status={
                              job.last_run_status === "success"
                                ? "green"
                                : "red"
                            }
                          >
                            Last: {job.last_run_status}
                          </Badge>
                        )}
                        {isComposed && (
                          <Badge status="neutral">Composed</Badge>
                        )}
                        {hasConditions && (
                          <Badge status="neutral">Conditional</Badge>
                        )}
                      </div>
                      <p className="text-sm text-subtle">
                        {describeSchedule(job.schedule)} &middot;{" "}
                        {describeTemplate(job.query_template)}
                      </p>
                      {job.description && (
                        <p className="text-sm text-subtle mt-1">
                          {job.description}
                        </p>
                      )}
                      <p className="text-xs text-subtle mt-1">
                        Last run: {formatTime(job.last_run_at)}
                        {job.discord_webhook_url && " | Discord webhook configured"}
                      </p>
                      {hasConditions && (
                        <p className="text-xs text-subtle mt-0.5">
                          Conditions:{" "}
                          {formatConfig.only_if_data ? "skip if empty" : ""}
                          {formatConfig.only_if_data && formatConfig.day_filter ? " + " : ""}
                          {formatConfig.day_filter === "weekday" ? "weekdays only" : ""}
                          {formatConfig.day_filter === "month_start" ? "1st of month" : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTestFire(job)}
                        disabled={testingJob === job.id}
                      >
                        {testingJob === job.id ? "Running..." : "Test Fire"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleEnabled(job)}
                      >
                        {job.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(job)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(job.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Test fire result */}
                  {testResults[job.id] && (
                    <TestResult result={testResults[job.id]} />
                  )}

                  {/* Expandable execution history */}
                  <button
                    className="mt-3 text-sm text-accent hover:underline"
                    onClick={() =>
                      setExpandedJob(isExpanded ? null : job.id)
                    }
                  >
                    {isExpanded
                      ? "Hide execution history"
                      : `Show execution history (${jobExecs.length})`}
                  </button>

                  {isExpanded && (
                    <div className="mt-2">
                      <ExecutionHistory executions={jobExecs} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
