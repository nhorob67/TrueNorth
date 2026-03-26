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
import { DEFAULT_SYSTEM_PROMPTS } from "@/lib/cron/llm-composer";
import type {
  CronJob,
  CronExecution,
  CronJobType,
  ExternalSourceConfig,
  KitSubscribersConfig,
  DiscourseUnrepliedConfig,
} from "@/types/database";

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

const EXTERNAL_SOURCE_OPTIONS = [
  { value: "kit_subscribers", label: "Kit Newsletter Subscribers" },
  { value: "discourse_unreplied", label: "Discourse Unreplied Posts" },
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
// System Prompt Editor
// ============================================================

function SystemPromptEditor({
  value,
  onChange,
  sourceType,
}: {
  value: string;
  onChange: (val: string) => void;
  sourceType: string;
}) {
  const defaultPrompt = DEFAULT_SYSTEM_PROMPTS[sourceType] ?? "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-ink">
          System Prompt (LLM persona)
        </label>
        {value !== defaultPrompt && (
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => onChange(defaultPrompt)}
          >
            Reset to default
          </button>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the persona and communication style for the LLM..."
        className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm min-h-[120px] focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
      />

      <p className="text-xs text-subtle">
        {value.length} characters &middot; This prompt guides the LLM when composing Discord messages from the source data.
      </p>
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
  // Format template (template jobs only)
  handlebars_template: string;
  // Job type
  job_type: CronJobType;
  // External source config
  source_type: string;
  kit_api_key_env: string;
  discourse_api_key_env: string;
  discourse_api_username_env: string;
  discourse_base_url: string;
  discourse_exclude_usernames: string;
  system_prompt: string;
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
  job_type: "template",
  source_type: "kit_subscribers",
  kit_api_key_env: "KIT_API_KEY",
  discourse_api_key_env: "DISCOURSE_API_KEY",
  discourse_api_username_env: "DISCOURSE_API_USERNAME",
  discourse_base_url: "",
  discourse_exclude_usernames: "",
  system_prompt: DEFAULT_SYSTEM_PROMPTS.kit_subscribers ?? "",
};

function buildExternalConfig(form: JobFormData): ExternalSourceConfig | null {
  if (form.job_type !== "external_source") return null;

  switch (form.source_type) {
    case "kit_subscribers":
      return {
        source_type: "kit_subscribers",
        api_key_env: form.kit_api_key_env || "KIT_API_KEY",
      } satisfies KitSubscribersConfig;
    case "discourse_unreplied":
      return {
        source_type: "discourse_unreplied",
        api_key_env: form.discourse_api_key_env || "DISCOURSE_API_KEY",
        api_username_env: form.discourse_api_username_env || "DISCOURSE_API_USERNAME",
        base_url: form.discourse_base_url,
        exclude_usernames: form.discourse_exclude_usernames
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean),
      } satisfies DiscourseUnrepliedConfig;
    default:
      return null;
  }
}

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
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const isCustom = form.schedule === "custom";
  const effectiveSchedule = isCustom ? form.customSchedule : form.schedule;
  const isExternal = form.job_type === "external_source";

  // Auto-fill system prompt when source type changes
  function handleSourceTypeChange(newSourceType: string) {
    const defaultPrompt = DEFAULT_SYSTEM_PROMPTS[newSourceType] ?? "";
    setForm({
      ...form,
      source_type: newSourceType,
      system_prompt: defaultPrompt,
    });
  }

  async function handleTestFireExternal() {
    setTesting(true);
    setTestMessage(null);
    try {
      const res = await fetch("/api/cron/test-fire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalConfig: buildExternalConfig(form),
          systemPrompt: form.system_prompt,
          jobId: editId ?? "adhoc",
        }),
      });
      const data = await res.json();
      if (data.error) {
        setTestMessage(`Error: ${data.error}`);
      } else {
        setTestMessage(data.message);
      }
    } catch (err) {
      setTestMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTesting(false);
    }
  }

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
    if (!isExternal && form.handlebars_template.trim()) {
      formatTemplate.handlebars_template = form.handlebars_template;
    }

    const payload: Record<string, unknown> = {
      organization_id: orgId,
      venture_id: form.venture_id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      schedule: effectiveSchedule,
      query_template: isExternal ? form.source_type : form.query_template,
      discord_webhook_url: form.discord_webhook_url.trim() || null,
      enabled: form.enabled,
      format_template: Object.keys(formatTemplate).length > 0 ? formatTemplate : null,
      job_type: form.job_type,
      external_config: buildExternalConfig(form),
      system_prompt: isExternal ? form.system_prompt || null : null,
      updated_at: new Date().toISOString(),
    };

    let saveError: string | null = null;
    if (editId) {
      const { error: err } = await supabase
        .from("cron_jobs")
        .update(payload)
        .eq("id", editId);
      if (err) saveError = err.message;
    } else {
      const { error: err } = await supabase
        .from("cron_jobs")
        .insert(payload);
      if (err) saveError = err.message;
    }

    setSaving(false);
    if (saveError) {
      setError(saveError);
    } else {
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
          {/* Job Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Job Type
            </label>
            <div className="flex rounded-lg border border-line overflow-hidden">
              <button
                type="button"
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  !isExternal
                    ? "bg-accent text-white"
                    : "bg-surface text-subtle hover:bg-canvas"
                }`}
                onClick={() => setForm({ ...form, job_type: "template" })}
              >
                Database Template
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  isExternal
                    ? "bg-accent text-white"
                    : "bg-surface text-subtle hover:bg-canvas"
                }`}
                onClick={() => setForm({ ...form, job_type: "external_source" })}
              >
                External Source
              </button>
            </div>
            <p className="text-xs text-subtle mt-1">
              {isExternal
                ? "Fetches data from an external API, composes a message via LLM, and posts to Discord."
                : "Queries internal database templates and broadcasts structured data to Discord."}
            </p>
          </div>

          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={isExternal ? "Newsletter subscriber report" : "Morning KPI broadcast"}
            required
          />

          <Input
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={isExternal ? "Reports daily subscriber count changes" : "Posts KPI scoreboard to Discord every morning"}
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

          {/* Template-specific fields */}
          {!isExternal && (
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
          )}

          {/* External Source fields */}
          {isExternal && (
            <div className="space-y-4 p-4 rounded-lg border border-line bg-canvas">
              <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-subtle">
                External Source Configuration
              </p>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Source Type
                </label>
                <select
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                  value={form.source_type}
                  onChange={(e) => handleSourceTypeChange(e.target.value)}
                >
                  {EXTERNAL_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kit Subscribers config */}
              {form.source_type === "kit_subscribers" && (
                <Input
                  label="API Key env var name"
                  value={form.kit_api_key_env}
                  onChange={(e) => setForm({ ...form, kit_api_key_env: e.target.value })}
                  placeholder="KIT_API_KEY"
                />
              )}

              {/* Discourse Unreplied config */}
              {form.source_type === "discourse_unreplied" && (
                <div className="space-y-3">
                  <Input
                    label="API Key env var name"
                    value={form.discourse_api_key_env}
                    onChange={(e) => setForm({ ...form, discourse_api_key_env: e.target.value })}
                    placeholder="DISCOURSE_API_KEY"
                  />
                  <Input
                    label="API Username env var name"
                    value={form.discourse_api_username_env}
                    onChange={(e) => setForm({ ...form, discourse_api_username_env: e.target.value })}
                    placeholder="DISCOURSE_API_USERNAME"
                  />
                  <Input
                    label="Forum Base URL"
                    value={form.discourse_base_url}
                    onChange={(e) => setForm({ ...form, discourse_base_url: e.target.value })}
                    placeholder="https://community.example.com"
                  />
                  <Input
                    label="Excluded Usernames (comma-separated)"
                    value={form.discourse_exclude_usernames}
                    onChange={(e) => setForm({ ...form, discourse_exclude_usernames: e.target.value })}
                    placeholder="admin, system, myusername"
                  />
                </div>
              )}

              {/* System Prompt */}
              <SystemPromptEditor
                value={form.system_prompt}
                onChange={(val) => setForm({ ...form, system_prompt: val })}
                sourceType={form.source_type}
              />

              {/* Test Fire for External Source */}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestFireExternal}
                  disabled={testing}
                >
                  {testing ? "Composing message..." : "Test Fire (preview LLM message)"}
                </Button>
                {testMessage && (
                  <div className="mt-2 p-3 rounded-lg border border-line bg-surface">
                    <p className="text-xs font-medium text-subtle mb-1">LLM-composed message preview:</p>
                    <p className="text-sm text-ink whitespace-pre-wrap">{testMessage}</p>
                  </div>
                )}
              </div>
            </div>
          )}

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
            label="Discord Webhook URL"
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

          {/* Format Template Editor (template jobs only) */}
          {!isExternal && (
            <FormatTemplateEditor
              value={form.handlebars_template}
              onChange={(val) => setForm({ ...form, handlebars_template: val })}
            />
          )}

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
// External Source Test Result
// ============================================================

function ExternalTestResult({ message }: { message: string }) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-canvas border border-line text-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-subtle mb-2">
        LLM-composed message
      </p>
      <p className="text-ink whitespace-pre-wrap">{message}</p>
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
  const [externalTestResults, setExternalTestResults] = useState<Record<string, string>>({});
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
      if (job.job_type === "external_source") {
        // External source test fire via API
        const res = await fetch("/api/cron/test-fire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalConfig: job.external_config,
            systemPrompt: job.system_prompt,
            jobId: job.id,
          }),
        });
        const data = await res.json();
        if (data.message) {
          setExternalTestResults((prev) => ({ ...prev, [job.id]: data.message }));
        }
      } else {
        // Template test fire (existing logic)
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
      }
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
      const extConfig = editingJob.external_config as ExternalSourceConfig | null;

      const base: JobFormData = {
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
        job_type: editingJob.job_type ?? "template",
        source_type: extConfig?.source_type ?? "kit_subscribers",
        kit_api_key_env: "KIT_API_KEY",
        discourse_api_key_env: "DISCOURSE_API_KEY",
        discourse_api_username_env: "DISCOURSE_API_USERNAME",
        discourse_base_url: "",
        discourse_exclude_usernames: "",
        system_prompt: editingJob.system_prompt ?? "",
      };

      // Populate source-specific fields from external_config
      if (extConfig?.source_type === "kit_subscribers") {
        base.kit_api_key_env = extConfig.api_key_env;
      } else if (extConfig?.source_type === "discourse_unreplied") {
        base.discourse_api_key_env = extConfig.api_key_env;
        base.discourse_api_username_env = extConfig.api_username_env;
        base.discourse_base_url = extConfig.base_url;
        base.discourse_exclude_usernames = extConfig.exclude_usernames.join(", ");
      }

      return base;
    }
    return EMPTY_FORM;
  }

  function describeTemplate(job: CronJob): string {
    if (job.job_type === "external_source") {
      const extConfig = job.external_config as ExternalSourceConfig | null;
      const opt = EXTERNAL_SOURCE_OPTIONS.find((o) => o.value === extConfig?.source_type);
      return opt?.label ?? extConfig?.source_type ?? "External";
    }
    const keys = job.query_template.split(",").map((k) => k.trim());
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
            const isComposed = job.job_type === "template" && job.query_template.includes(",");
            const isExternal = job.job_type === "external_source";

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
                        {isExternal ? (
                          <Badge status="neutral">External</Badge>
                        ) : isComposed ? (
                          <Badge status="neutral">Composed</Badge>
                        ) : null}
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
                        {hasConditions && (
                          <Badge status="neutral">Conditional</Badge>
                        )}
                      </div>
                      <p className="text-sm text-subtle">
                        {describeSchedule(job.schedule)} &middot;{" "}
                        {describeTemplate(job)}
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

                  {/* Test fire result (template jobs) */}
                  {testResults[job.id] && !isExternal && (
                    <TestResult result={testResults[job.id]} />
                  )}

                  {/* Test fire result (external source jobs) */}
                  {externalTestResults[job.id] && isExternal && (
                    <ExternalTestResult message={externalTestResults[job.id]} />
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
