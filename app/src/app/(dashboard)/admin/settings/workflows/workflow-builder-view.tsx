"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import type { WorkflowTemplate, WorkflowExecution, WorkflowStep } from "@/types/database";

// ============================================================
// Types
// ============================================================

interface AgentInfo {
  id: string;
  name: string;
  category: string;
  hermes_profile_name: string | null;
  hermes_enabled: boolean;
}

interface WorkflowBuilderViewProps {
  templates: WorkflowTemplate[];
  executions: WorkflowExecution[];
  agents: AgentInfo[];
  orgId: string;
  isAdmin: boolean;
}

// ============================================================
// Helpers
// ============================================================

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  event: "Event-Driven",
  schedule: "Scheduled",
  threshold: "Threshold",
};

const STATUS_BADGE: Record<string, "green" | "yellow" | "red" | "neutral"> = {
  pending: "neutral",
  running: "yellow",
  completed: "green",
  failed: "red",
  cancelled: "neutral",
};

function agentName(profile: string, agents: AgentInfo[]): string {
  const agent = agents.find((a) => a.hermes_profile_name === profile);
  return agent?.name ?? profile;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ============================================================
// Preset Workflows
// ============================================================

const PRESET_WORKFLOWS: Array<{
  name: string;
  description: string;
  trigger_type: string;
  steps: WorkflowStep[];
}> = [
  {
    name: "Weekly Intelligence Brief",
    description: "Signal Watch collects anomalies, Cockpit Advisor synthesizes, Narrative Generator produces a memo",
    trigger_type: "schedule",
    steps: [
      { order: 1, agent_profile: "signal-watch", action: "collect_anomalies", input_mapping: {}, output_key: "signals", depends_on: [] },
      { order: 2, agent_profile: "cockpit-advisor", action: "synthesize", input_mapping: { signals: "$steps.1.output" }, output_key: "synthesis", depends_on: [1] },
      { order: 3, agent_profile: "narrative-generator", action: "generate_brief", input_mapping: { signals: "$steps.1.output", synthesis: "$steps.2.output" }, output_key: "brief", depends_on: [1, 2] },
    ],
  },
  {
    name: "New Idea Assessment",
    description: "Filter Guardian evaluates against strategic filters, then Cockpit Advisor assesses strategic fit",
    trigger_type: "event",
    steps: [
      { order: 1, agent_profile: "filter-guardian", action: "evaluate_filters", input_mapping: {}, output_key: "filter_results", depends_on: [] },
      { order: 2, agent_profile: "cockpit-advisor", action: "assess_strategic_fit", input_mapping: { filter_results: "$steps.1.output" }, output_key: "recommendation", depends_on: [1] },
    ],
  },
  {
    name: "Monthly Health Report",
    description: "Signal Watch and Health Interpreter analyze in parallel, then Narrative Generator produces a board memo",
    trigger_type: "schedule",
    steps: [
      { order: 1, agent_profile: "signal-watch", action: "monthly_analysis", input_mapping: {}, output_key: "kpi_analysis", depends_on: [] },
      { order: 2, agent_profile: "health-interpreter", action: "monthly_interpretation", input_mapping: {}, output_key: "health_analysis", depends_on: [] },
      { order: 3, agent_profile: "narrative-generator", action: "generate_board_memo", input_mapping: { kpi_analysis: "$steps.1.output", health_analysis: "$steps.2.output" }, output_key: "memo", depends_on: [1, 2] },
    ],
  },
];

// ============================================================
// Step Builder Component
// ============================================================

function StepEditor({
  steps,
  agents,
  onChange,
}: {
  steps: WorkflowStep[];
  agents: AgentInfo[];
  onChange: (steps: WorkflowStep[]) => void;
}) {
  const hermesAgents = agents.filter((a) => a.hermes_enabled && a.hermes_profile_name);

  function addStep() {
    const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.order)) + 1 : 1;
    onChange([
      ...steps,
      {
        order: nextOrder,
        agent_profile: hermesAgents[0]?.hermes_profile_name ?? "",
        action: "",
        input_mapping: {},
        depends_on: [],
      },
    ]);
  }

  function updateStep(index: number, updates: Partial<WorkflowStep>) {
    const updated = [...steps];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  }

  function removeStep(index: number) {
    const removed = steps[index];
    const updated = steps
      .filter((_, i) => i !== index)
      .map((s) => ({
        ...s,
        depends_on: s.depends_on.filter((d) => d !== removed.order),
      }));
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={idx} className="border border-line rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-faded bg-well px-2 py-0.5 rounded">
              Step {step.order}
            </span>
            {step.depends_on.length > 0 && (
              <span className="text-xs text-subtle">
                depends on: {step.depends_on.join(", ")}
              </span>
            )}
            <button
              onClick={() => removeStep(idx)}
              className="ml-auto text-xs text-semantic-brick hover:underline"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-subtle mb-1">Agent</label>
              <select
                value={step.agent_profile}
                onChange={(e) => updateStep(idx, { agent_profile: e.target.value })}
                className="w-full rounded-lg border border-line bg-well px-3 py-1.5 text-sm"
              >
                <option value="">Select agent...</option>
                {hermesAgents.map((a) => (
                  <option key={a.hermes_profile_name} value={a.hermes_profile_name!}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-subtle mb-1">Action</label>
              <input
                type="text"
                value={step.action}
                onChange={(e) => updateStep(idx, { action: e.target.value })}
                placeholder="e.g., analyze_kpis"
                className="w-full rounded-lg border border-line bg-well px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Dependencies */}
          {idx > 0 && (
            <div className="mt-2">
              <label className="block text-xs text-subtle mb-1">Depends On</label>
              <div className="flex gap-2 flex-wrap">
                {steps.slice(0, idx).map((prevStep) => {
                  const isSelected = step.depends_on.includes(prevStep.order);
                  return (
                    <button
                      key={prevStep.order}
                      onClick={() => {
                        const newDeps = isSelected
                          ? step.depends_on.filter((d) => d !== prevStep.order)
                          : [...step.depends_on, prevStep.order];
                        updateStep(idx, { depends_on: newDeps });
                      }}
                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                        isSelected
                          ? "bg-accent text-white border-accent"
                          : "bg-well text-subtle border-line hover:border-accent"
                      }`}
                    >
                      Step {prevStep.order}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={addStep}>
        + Add Step
      </Button>
    </div>
  );
}

// ============================================================
// Execution History
// ============================================================

function ExecutionRow({ execution }: { execution: WorkflowExecution }) {
  const [expanded, setExpanded] = useState(false);
  const stepResults = (execution.step_results ?? []) as Array<{
    step_order: number;
    agent_profile: string;
    status: string;
    error?: string;
    completed_at?: string;
  }>;

  return (
    <div className="border-b border-line/50 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-hovered text-sm"
      >
        <Badge status={STATUS_BADGE[execution.status] ?? "neutral"}>
          {execution.status}
        </Badge>
        <span className="text-subtle">
          {execution.current_step ?? 0}/{execution.total_steps ?? "?"} steps
        </span>
        <span className="text-faded ml-auto text-xs">{timeAgo(execution.started_at)}</span>
        <span className="text-faded text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && stepResults.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {stepResults.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-faded w-12">Step {r.step_order}</span>
              <span className="inline-flex items-center rounded-full bg-sage px-1.5 py-0.5 text-[9px] font-mono text-white">
                {r.agent_profile}
              </span>
              <Badge status={STATUS_BADGE[r.status] ?? "neutral"}>{r.status}</Badge>
              {r.error && <span className="text-semantic-brick truncate">{r.error}</span>}
            </div>
          ))}
          {execution.error_message && (
            <p className="text-xs text-semantic-brick mt-1">{execution.error_message}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Workflow Card
// ============================================================

function WorkflowCard({
  template,
  executions,
  agents,
  isAdmin,
  onRun,
  onToggle,
  onDelete,
}: {
  template: WorkflowTemplate;
  executions: WorkflowExecution[];
  agents: AgentInfo[];
  isAdmin: boolean;
  onRun: (id: string) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const steps = (template.steps ?? []) as WorkflowStep[];
  const templateExecs = executions.filter((e) => e.workflow_template_id === template.id);

  async function handleRun() {
    setRunning(true);
    await onRun(template.id);
    setRunning(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">{template.name}</h3>
                <Badge status={template.enabled ? "green" : "neutral"}>
                  {template.enabled ? "Active" : "Disabled"}
                </Badge>
                {template.is_preset && <Badge status="neutral">Preset</Badge>}
                <Badge status="neutral">
                  {TRIGGER_LABELS[template.trigger_type] ?? template.trigger_type}
                </Badge>
              </div>
              {template.description && (
                <p className="text-xs text-subtle mt-0.5">{template.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {template.enabled && (
              <Button size="sm" onClick={handleRun} disabled={running}>
                {running ? "Running..." : "Run Now"}
              </Button>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => onToggle(template.id, template.enabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    template.enabled ? "bg-accent" : "bg-well"
                  } cursor-pointer`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      template.enabled ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-faded"
                >
                  {expanded ? "▲" : "▼"}
                </button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Steps visualization */}
      <CardContent>
        <div className="flex items-center gap-1 flex-wrap">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-1">
              {idx > 0 && (
                <span className="text-faded text-xs">
                  {step.depends_on.length === 0 ? "‖" : "→"}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs">
                <span className="inline-flex items-center rounded-full bg-sage px-1 py-0.5 text-[8px] font-mono text-white">
                  {step.agent_profile}
                </span>
                <span className="text-ink">{step.action}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Execution history */}
        {expanded && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-semibold text-subtle uppercase mb-2">
              Recent Executions ({templateExecs.length})
            </p>
            {templateExecs.length === 0 ? (
              <p className="text-xs text-faded">No executions yet.</p>
            ) : (
              <div className="border border-line rounded-lg overflow-hidden">
                {templateExecs.slice(0, 10).map((exec) => (
                  <ExecutionRow key={exec.id} execution={exec} />
                ))}
              </div>
            )}
            {isAdmin && !template.is_preset && (
              <div className="mt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(template.id)}
                >
                  Delete Workflow
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Create Workflow Dialog
// ============================================================

function CreateWorkflowDialog({
  agents,
  orgId,
  onClose,
  presetSteps,
  presetName,
  presetDescription,
  presetTrigger,
}: {
  agents: AgentInfo[];
  orgId: string;
  onClose: () => void;
  presetSteps?: WorkflowStep[];
  presetName?: string;
  presetDescription?: string;
  presetTrigger?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(presetName ?? "");
  const [description, setDescription] = useState(presetDescription ?? "");
  const [triggerType, setTriggerType] = useState(presetTrigger ?? "manual");
  const [steps, setSteps] = useState<WorkflowStep[]>(presetSteps ?? []);

  async function handleCreate() {
    if (!name || steps.length === 0) return;
    setCreating(true);
    await supabase.from("workflow_templates").insert({
      organization_id: orgId,
      name: name.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      trigger_config: {},
      steps,
      enabled: true,
      is_preset: !!presetSteps,
    });
    setCreating(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onClose={onClose} title={presetSteps ? `Add Preset: ${presetName}` : "Create Workflow"}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[60px] rounded-lg border border-line bg-well px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Trigger</label>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm"
          >
            <option value="manual">Manual (Run Now button)</option>
            <option value="event">Event-Driven (entity changes)</option>
            <option value="schedule">Scheduled (cron)</option>
            <option value="threshold">Threshold (KPI breach)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Steps</label>
          <StepEditor steps={steps} agents={agents} onChange={setSteps} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || !name || steps.length === 0}
        >
          {creating ? "Creating..." : "Create Workflow"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ============================================================
// Main View
// ============================================================

export function WorkflowBuilderView({
  templates,
  executions,
  agents,
  orgId,
  isAdmin,
}: WorkflowBuilderViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [showCreate, setShowCreate] = useState(false);
  const [presetToAdd, setPresetToAdd] = useState<typeof PRESET_WORKFLOWS[number] | null>(null);

  // Which presets are already added?
  const addedPresetNames = new Set(
    templates.filter((t) => t.is_preset).map((t) => t.name)
  );

  const availablePresets = PRESET_WORKFLOWS.filter((p) => !addedPresetNames.has(p.name));

  async function handleRun(workflowId: string) {
    await fetch("/api/agents/run-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId }),
    });
    router.refresh();
  }

  async function handleToggle(id: string, enabled: boolean) {
    await supabase.from("workflow_templates").update({ enabled: !enabled }).eq("id", id);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await supabase.from("workflow_templates").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">
            Workflows
          </h2>
          <p className="text-subtle text-sm mt-1">
            Multi-agent orchestration pipelines. TrueNorth orchestrates, Hermes executes.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Create Workflow
          </Button>
        )}
      </div>

      {/* Preset templates (not yet added) */}
      {availablePresets.length > 0 && isAdmin && (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-ink">Available Presets</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {availablePresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setPresetToAdd(preset)}
                  className="border border-dashed border-line rounded-lg p-3 text-left hover:border-accent hover:bg-hovered transition-colors"
                >
                  <p className="text-sm font-medium text-ink">{preset.name}</p>
                  <p className="text-xs text-subtle mt-1">{preset.description}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {preset.steps.map((s, i) => (
                      <span key={i} className="text-[9px] font-mono text-sage">
                        {i > 0 && "→ "}
                        {s.agent_profile}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow list */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-subtle">
              No workflows configured. Create one or add a preset to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <WorkflowCard
              key={template.id}
              template={template}
              executions={executions}
              agents={agents}
              isAdmin={isAdmin}
              onRun={handleRun}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateWorkflowDialog
          agents={agents}
          orgId={orgId}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Preset add dialog */}
      {presetToAdd && (
        <CreateWorkflowDialog
          agents={agents}
          orgId={orgId}
          onClose={() => setPresetToAdd(null)}
          presetSteps={presetToAdd.steps}
          presetName={presetToAdd.name}
          presetDescription={presetToAdd.description}
          presetTrigger={presetToAdd.trigger_type}
        />
      )}
    </div>
  );
}
