"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityPicker } from "@/components/entity-picker";
import { Comments } from "@/components/comments";
import { TodoList } from "@/components/todo-list";
import { AddToTodoButton } from "@/components/add-to-todo-button";

// ============================================================
// Types
// ============================================================

type MoveCadence = "daily" | "weekly" | "biweekly" | "monthly";

interface MoveInstance {
  id: string;
  move_id: string;
  cycle_start: string;
  cycle_end: string;
  status: "pending" | "completed" | "missed" | "skipped";
  completed_at: string | null;
  notes: string | null;
}

interface ExternalSource {
  platform: string;
  category?: string;
  author?: string;
}

interface Move {
  id: string;
  title: string;
  description: string | null;
  lifecycle_status: "not_started" | "in_progress" | "shipped" | "cut";
  health_status: "green" | "yellow" | "red";
  due_date: string | null;
  owner_id: string;
  type: "milestone" | "recurring";
  position: number;
  cut_reason: string | null;
  kpi_link_ids: string[];
  effort_estimate: { value?: number; unit?: string } | null;
  cadence: MoveCadence | null;
  target_per_cycle: number | null;
  content_machine_id: string | null;
  external_source: ExternalSource | null;
  move_instances: MoveInstance[];
}

type MachineType = "newsletter" | "deep_content" | "short_form" | "live_event";

const machineLabels: Record<MachineType, string> = {
  newsletter: "Newsletter",
  deep_content: "Deep Content",
  short_form: "Short-Form",
  live_event: "Live Event",
};

const machineColors: Record<MachineType, string> = {
  newsletter: "bg-accent/10 text-accent",
  deep_content: "bg-accent-dim text-accent",
  short_form: "bg-brass/10 text-brass-text",
  live_event: "bg-sage/10 text-sage-text",
};

interface Blocker {
  id: string;
  description: string;
  severity: string;
  resolution_state: string;
}

interface Bet {
  id: string;
  organization_id: string;
  venture_id: string;
  outcome: string;
  mechanism: string | null;
  proof_by_week6: string | null;
  kill_criteria: string | null;
  health_status: "green" | "yellow" | "red";
  lifecycle_status: string;
  quarter: string | null;
  owner_id: string;
  resource_cap: { value?: number; unit?: string } | null;
  created_at: string;
  killed_at: string | null;
  kill_reason: string | null;
  moves: Move[];
}

const statusOrder = {
  in_progress: 0,
  not_started: 1,
  shipped: 2,
  cut: 3,
};

// ============================================================
// Recurring Move: Cycle Progress
// ============================================================

function CycleProgress({
  instances,
  target,
  cadence,
}: {
  instances: MoveInstance[];
  target: number;
  cadence: MoveCadence;
}) {
  // Find current cycle instances
  const now = new Date();
  const currentInstances = instances.filter(
    (i) => new Date(i.cycle_start) <= now && new Date(i.cycle_end) >= now
  );
  const completed = currentInstances.filter(
    (i) => i.status === "completed"
  ).length;

  // Rolling 3-cycle health
  const recentInstances = [...instances]
    .sort(
      (a, b) =>
        new Date(b.cycle_start).getTime() - new Date(a.cycle_start).getTime()
    )
    .slice(0, target * 3);
  const recentCompleted = recentInstances.filter(
    (i) => i.status === "completed"
  ).length;
  const recentTotal = recentInstances.length;
  const completionRate =
    recentTotal > 0 ? (recentCompleted / recentTotal) * 100 : 100;

  const cadenceLabel =
    cadence === "daily"
      ? "/day"
      : cadence === "weekly"
        ? "/wk"
        : cadence === "biweekly"
          ? "/2wk"
          : "/mo";

  return (
    <div className="flex items-center gap-2">
      {/* Current cycle dots */}
      <div className="flex gap-0.5">
        {Array.from({ length: target }).map((_, i) => (
          <span
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < completed ? "bg-semantic-green" : "bg-line"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-subtle">
        {completed}/{target}
        {cadenceLabel}
      </span>
      {/* Rolling health indicator */}
      <span
        className={`text-xs px-1.5 py-0.5 rounded ${
          completionRate >= 80
            ? "bg-semantic-green/10 text-semantic-green-text"
            : completionRate >= 50
              ? "bg-semantic-ochre/10 text-semantic-ochre-text"
              : "bg-semantic-brick/10 text-semantic-brick"
        }`}
      >
        {Math.round(completionRate)}%
      </span>
    </div>
  );
}

// ============================================================
// Move Instance Row (for recurring moves)
// ============================================================

function InstanceRow({
  instance,
  onComplete,
  onSkip,
}: {
  instance: MoveInstance;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const start = new Date(instance.cycle_start);
  const end = new Date(instance.cycle_end);

  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${
          instance.status === "completed"
            ? "bg-semantic-green"
            : instance.status === "missed"
              ? "bg-semantic-brick"
              : instance.status === "skipped"
                ? "bg-faded"
                : "bg-line"
        }`}
      />
      <span className="text-subtle">
        {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        {" – "}
        {end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </span>
      <span
        className={`ml-auto ${
          instance.status === "completed"
            ? "text-semantic-green-text"
            : instance.status === "missed"
              ? "text-semantic-brick"
              : "text-subtle"
        }`}
      >
        {instance.status}
      </span>
      {instance.status === "pending" && (
        <div className="flex gap-1 ml-1">
          <button
            onClick={onComplete}
            className="px-1.5 py-0.5 rounded bg-semantic-green/10 text-semantic-green-text hover:bg-semantic-green/20"
          >
            Done
          </button>
          <button
            onClick={onSkip}
            className="px-1.5 py-0.5 rounded bg-faded/10 text-subtle hover:bg-faded/20"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Move Row
// ============================================================

function MoveRow({
  move,
  orgId,
  onStatusChange,
  onRefresh,
}: {
  move: Move;
  orgId: string;
  onStatusChange: (id: string, status: string) => void;
  onRefresh: () => void;
}) {
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [showLinkKpi, setShowLinkKpi] = useState(false);
  const [showLinkBlocker, setShowLinkBlocker] = useState(false);

  const isRecurring = move.type === "recurring";
  const instances = move.move_instances ?? [];

  async function linkKpi(_entityType: string, entityId: string) {
    const existing = move.kpi_link_ids ?? [];
    if (existing.includes(entityId)) return;
    await supabase
      .from("moves")
      .update({ kpi_link_ids: [...existing, entityId] })
      .eq("id", move.id);
    setShowLinkKpi(false);
    onRefresh();
  }

  async function linkBlocker(_: string, blockerId: string) {
    await supabase
      .from("blockers")
      .update({ linked_entity_id: move.id, linked_entity_type: "move" })
      .eq("id", blockerId);
    setShowLinkBlocker(false);
    onRefresh();
  }

  async function completeInstance(instanceId: string) {
    await supabase
      .from("move_instances")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", instanceId);
    onRefresh();
  }

  async function skipInstance(instanceId: string) {
    const reason = prompt("Reason for skipping?");
    if (!reason) return;
    await supabase
      .from("move_instances")
      .update({ status: "skipped", skip_reason: reason })
      .eq("id", instanceId);
    onRefresh();
  }

  return (
    <div className="border-b border-line last:border-0">
      <div className="flex items-center gap-3 py-2">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            move.lifecycle_status === "shipped"
              ? "bg-semantic-green"
              : move.lifecycle_status === "in_progress"
                ? "bg-semantic-ochre"
                : move.lifecycle_status === "cut"
                  ? "bg-semantic-brick"
                  : "bg-faded"
          }`}
        />
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2">
            <p
              className={`text-sm font-medium ${
                move.lifecycle_status === "shipped" ||
                move.lifecycle_status === "cut"
                  ? "line-through text-subtle"
                  : ""
              }`}
            >
              {move.title}
            </p>
            {isRecurring && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                Recurring
              </span>
            )}
            {move.content_machine_id && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  machineColors[move.content_machine_id as MachineType] ??
                  "bg-line/50 text-subtle"
                }`}
              >
                {machineLabels[move.content_machine_id as MachineType] ??
                  move.content_machine_id}
              </span>
            )}
            {move.external_source && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-sage/10 text-sage-text">
                External: {move.external_source.platform}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {!isRecurring && move.due_date && (
              <span className="text-xs text-subtle">
                Due{" "}
                {new Date(move.due_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {move.effort_estimate?.value && (
              <span className="text-xs text-subtle">
                {move.effort_estimate.value}h
              </span>
            )}
            {(move.kpi_link_ids?.length ?? 0) > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-semantic-green/10 text-semantic-green-text">
                {move.kpi_link_ids.length} KPI
                {move.kpi_link_ids.length !== 1 ? "s" : ""}
              </span>
            )}
            {isRecurring && move.cadence && move.target_per_cycle && (
              <CycleProgress
                instances={instances}
                target={move.target_per_cycle}
                cadence={move.cadence}
              />
            )}
          </div>
        </button>
        <AddToTodoButton
          entityId={move.id}
          entityType="move"
          entityLabel={move.title}
        />
        <Badge status={move.health_status} />
        {!isRecurring && (
          <select
            value={move.lifecycle_status}
            onChange={(e) => onStatusChange(move.id, e.target.value)}
            className="text-xs border border-line rounded px-1.5 py-1 bg-surface"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="shipped">Shipped</option>
            <option value="cut">Cut</option>
          </select>
        )}
      </div>

      {expanded && (
        <div className="pl-5 pb-3 space-y-3">
          {/* Recurring move instances */}
          {isRecurring && instances.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-subtle uppercase mb-1">
                Recent Instances
              </p>
              <div>
                {instances
                  .sort(
                    (a, b) =>
                      new Date(b.cycle_start).getTime() -
                      new Date(a.cycle_start).getTime()
                  )
                  .slice(0, 10)
                  .map((instance) => (
                    <InstanceRow
                      key={instance.id}
                      instance={instance}
                      onComplete={() => completeInstance(instance.id)}
                      onSkip={() => skipInstance(instance.id)}
                    />
                  ))}
              </div>
            </div>
          )}

          {move.cut_reason && (
            <div className="text-xs p-2 bg-semantic-brick/5 border-l-2 border-semantic-brick rounded">
              <span className="font-medium">Cut reason:</span>{" "}
              {move.cut_reason}
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setShowLinkKpi(!showLinkKpi)}
            >
              Link KPI
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setShowLinkBlocker(!showLinkBlocker)}
            >
              Link Blocker
            </Button>
          </div>

          {showLinkKpi && (
            <EntityPicker
              entityTypes={["kpi"]}
              onSelect={linkKpi}
              placeholder="Search KPIs..."
            />
          )}
          {showLinkBlocker && (
            <EntityPicker
              entityTypes={["blocker"]}
              onSelect={linkBlocker}
              placeholder="Search blockers..."
            />
          )}

          {/* Soft warnings */}
          {(move.kpi_link_ids?.length ?? 0) === 0 &&
            move.lifecycle_status !== "cut" &&
            move.lifecycle_status !== "shipped" && (
              <div className="flex items-start gap-2 text-xs p-2 bg-semantic-ochre/5 border-l-2 border-semantic-ochre rounded">
                <span className="text-semantic-ochre font-medium flex-shrink-0">Tip:</span>
                <span className="text-ink">
                  This Move has no linked KPIs. Linking to a lead indicator helps track whether execution is driving outcomes.
                </span>
              </div>
            )}
          {isRecurring &&
            !move.content_machine_id &&
            move.lifecycle_status !== "cut" && (
              <div className="flex items-start gap-2 text-xs p-2 bg-semantic-ochre/5 border-l-2 border-semantic-ochre rounded">
                <span className="text-semantic-ochre font-medium flex-shrink-0">Tip:</span>
                <span className="text-ink">
                  This recurring Move has no content machine linked. If it tracks content output, link a content machine for auto-crediting.
                </span>
              </div>
            )}

          {/* Todos */}
          <div>
            <p className="text-xs font-semibold text-subtle uppercase mb-1">
              Sub-tasks
            </p>
            <TodoList entityId={move.id} entityType="move" orgId={orgId} />
          </div>

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-subtle uppercase mb-1">
              Comments
            </p>
            <Comments entityId={move.id} entityType="move" orgId={orgId} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Add Move Form (supports both Milestone and Recurring)
// ============================================================

function AddMoveForm({
  betId,
  organizationId,
  ventureId,
  onAdded,
}: {
  betId: string;
  organizationId: string;
  ventureId: string;
  onAdded: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [effort, setEffort] = useState("");
  const [loading, setLoading] = useState(false);
  const [moveType, setMoveType] = useState<"milestone" | "recurring">(
    "milestone"
  );
  const [cadence, setCadence] = useState<MoveCadence>("weekly");
  const [targetPerCycle, setTargetPerCycle] = useState("1");
  const [contentMachineId, setContentMachineId] = useState<string>("");
  const [showExternalSource, setShowExternalSource] = useState(false);
  const [extPlatform, setExtPlatform] = useState<string>("");
  const [extCategory, setExtCategory] = useState("");
  const [extAuthor, setExtAuthor] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload: Record<string, unknown> = {
      organization_id: organizationId,
      venture_id: ventureId,
      bet_id: betId,
      title: title.trim(),
      owner_id: user!.id,
      type: moveType,
    };

    if (moveType === "milestone") {
      payload.due_date = dueDate || null;
      payload.effort_estimate = effort
        ? { value: Number(effort), unit: "hours" }
        : null;
    } else {
      payload.cadence = cadence;
      payload.target_per_cycle = parseInt(targetPerCycle) || 1;
      payload.lifecycle_status = "in_progress";
      payload.content_machine_id = contentMachineId || null;
      if (extPlatform) {
        const externalSource: Record<string, string> = { platform: extPlatform };
        if (extCategory.trim()) externalSource.category = extCategory.trim();
        if (extAuthor.trim()) externalSource.author = extAuthor.trim();
        payload.external_source = externalSource;
      } else {
        payload.external_source = null;
      }
    }

    const { data: newMove } = await supabase
      .from("moves")
      .insert(payload)
      .select("id")
      .single();

    // For recurring moves, create initial instances for current cycle
    if (moveType === "recurring" && newMove) {
      const now = new Date();
      const cycleEnd = getCycleEnd(now, cadence);
      const target = parseInt(targetPerCycle) || 1;
      const instances = Array.from({ length: target }).map(() => ({
        move_id: newMove.id,
        cycle_start: now.toISOString(),
        cycle_end: cycleEnd.toISOString(),
        status: "pending",
      }));
      await supabase.from("move_instances").insert(instances);
    }

    setTitle("");
    setDueDate("");
    setEffort("");
    setTargetPerCycle("1");
    setContentMachineId("");
    setExtPlatform("");
    setExtCategory("");
    setExtAuthor("");
    setShowExternalSource(false);
    setLoading(false);
    onAdded();
  }

  return (
    <div className="mt-4 pt-3 border-t border-line">
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMoveType("milestone")}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            moveType === "milestone"
              ? "bg-accent text-white"
              : "text-subtle hover:text-ink border border-line"
          }`}
        >
          Milestone
        </button>
        <button
          type="button"
          onClick={() => setMoveType("recurring")}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            moveType === "recurring"
              ? "bg-accent text-white"
              : "text-subtle hover:text-ink border border-line"
          }`}
        >
          Recurring
        </button>
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              moveType === "milestone"
                ? "New milestone move..."
                : "New recurring rhythm..."
            }
            className="flex-1"
          />
          {moveType === "milestone" && (
            <>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-32"
              />
              <Input
                type="number"
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                placeholder="Hours"
                className="w-20"
              />
            </>
          )}
          {moveType === "recurring" && (
            <>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as MoveCadence)}
                className="text-xs border border-line rounded-lg px-2 py-2 bg-surface"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <Input
                type="number"
                min="1"
                max="10"
                value={targetPerCycle}
                onChange={(e) => setTargetPerCycle(e.target.value)}
                placeholder="Target"
                className="w-20"
              />
            </>
          )}
          <Button type="submit" size="sm" disabled={loading || !title.trim()}>
            Add
          </Button>
        </div>
        {moveType === "recurring" && (
          <>
            <div className="flex items-center gap-3">
              <p className="text-xs text-subtle">
                Target: {targetPerCycle || 1}x per{" "}
                {cadence === "biweekly" ? "2 weeks" : cadence}
              </p>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-subtle">Content Machine:</label>
                <select
                  value={contentMachineId}
                  onChange={(e) => setContentMachineId(e.target.value)}
                  className="text-xs border border-line rounded px-2 py-1 bg-surface"
                >
                  <option value="">None</option>
                  <option value="newsletter">Flagship Newsletter</option>
                  <option value="deep_content">Deep Content</option>
                  <option value="short_form">Short-Form Daily</option>
                  <option value="live_event">Monthly Live Event</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowExternalSource(!showExternalSource)}
                className="text-xs text-sage-text hover:text-sage underline"
              >
                {showExternalSource ? "Hide" : "External Source"}
              </button>
            </div>
            {showExternalSource && (
              <div className="flex items-center gap-2 flex-wrap p-2 bg-sage/5 border border-sage/20 rounded-lg">
                <label className="text-xs text-subtle">Platform:</label>
                <select
                  value={extPlatform}
                  onChange={(e) => setExtPlatform(e.target.value)}
                  className="text-xs border border-line rounded px-2 py-1 bg-surface"
                >
                  <option value="">None</option>
                  <option value="discourse">Discourse</option>
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="podcast">Podcast</option>
                  <option value="generic">Generic</option>
                </select>
                {extPlatform && (
                  <>
                    <Input
                      value={extCategory}
                      onChange={(e) => setExtCategory(e.target.value)}
                      placeholder="Category (optional)"
                      className="w-32 text-xs"
                    />
                    <Input
                      value={extAuthor}
                      onChange={(e) => setExtAuthor(e.target.value)}
                      placeholder="Author (optional)"
                      className="w-32 text-xs"
                    />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </form>
    </div>
  );
}

// ============================================================
// Week-6 Checkpoint
// ============================================================

function Week6Checkpoint({
  bet,
  onComplete,
}: {
  bet: Bet;
  onComplete: () => void;
}) {
  const supabase = createClient();
  const [evidence, setEvidence] = useState("");
  const [verdict, setVerdict] = useState<"green" | "yellow" | "red" | null>(null);
  const [pivotCriteria, setPivotCriteria] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const verdictLabels = {
    green: "Continue — Evidence supports the thesis",
    yellow: "Pivot — Adjust approach, new proof criteria for Week 9",
    red: "Kill — Insufficient evidence, reallocate resources",
  };

  async function handleSubmit() {
    if (!verdict || !evidence.trim()) return;
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Create a Decision object recording this checkpoint
    await supabase.from("decisions").insert({
      organization_id: bet.organization_id,
      venture_id: bet.venture_id,
      title: `Week-6 Checkpoint: ${bet.outcome}`,
      context: `Lead indicator evidence: ${evidence.trim()}`,
      options_considered: [
        "Continue (green)",
        "Pivot with new criteria (yellow)",
        "Kill and reallocate (red)",
      ],
      final_decision: verdictLabels[verdict],
      owner_id: user!.id,
      linked_entity_id: bet.id,
      linked_entity_type: "bet",
      decided_at: new Date().toISOString(),
    });

    // Update bet based on verdict
    if (verdict === "red") {
      // Kill the bet
      const lessonsLearned = prompt(
        "What did you learn from this bet? (This will be preserved in the Graveyard)"
      );
      await supabase
        .from("bets")
        .update({
          lifecycle_status: "completed",
          health_status: "red",
          kill_reason: lessonsLearned || "Killed at Week-6 checkpoint",
          killed_at: new Date().toISOString(),
        })
        .eq("id", bet.id);
    } else if (verdict === "yellow") {
      await supabase
        .from("bets")
        .update({
          health_status: "yellow",
          proof_by_week6: pivotCriteria.trim() || bet.proof_by_week6,
        })
        .eq("id", bet.id);
    } else {
      await supabase
        .from("bets")
        .update({ health_status: "green" })
        .eq("id", bet.id);
    }

    setSubmitting(false);
    onComplete();
  }

  return (
    <Card borderColor="var(--color-brass)" className="mb-6">
      <CardHeader className="bg-brass/10">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-brass-text" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h2 className="text-sm font-semibold text-brass-text">
            Week-6 Checkpoint
          </h2>
        </div>
        <p className="text-xs text-subtle mt-1">
          Present your lead indicator data and proof-by-week-6 evidence. The
          team will assign a verdict.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Proof by Week 6 reminder */}
        {bet.proof_by_week6 && (
          <div className="p-3 bg-canvas rounded-lg">
            <p className="text-xs font-semibold text-subtle uppercase mb-1">
              Original Proof Criteria
            </p>
            <p className="text-sm text-ink">{bet.proof_by_week6}</p>
          </div>
        )}

        {/* Evidence textarea */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            Evidence & Lead Indicator Data
          </label>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Present your evidence: What do the lead indicators show? What has shipped? What has the team learned?"
            className="w-full min-h-[100px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
          />
        </div>

        {/* Verdict selection */}
        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            Verdict
          </label>
          <div className="space-y-2">
            {(["green", "yellow", "red"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVerdict(v)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  verdict === v
                    ? v === "green"
                      ? "border-semantic-green bg-semantic-green/5"
                      : v === "yellow"
                        ? "border-semantic-ochre bg-semantic-ochre/5"
                        : "border-semantic-brick bg-semantic-brick/5"
                    : "border-line hover:bg-canvas"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      v === "green"
                        ? "bg-semantic-green"
                        : v === "yellow"
                          ? "bg-semantic-ochre"
                          : "bg-semantic-brick"
                    }`}
                  />
                  <span className="text-sm font-medium text-ink">
                    {verdictLabels[v]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Pivot criteria (only for yellow) */}
        {verdict === "yellow" && (
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              New Proof Criteria for Week 9
            </label>
            <textarea
              value={pivotCriteria}
              onChange={(e) => setPivotCriteria(e.target.value)}
              placeholder="What evidence do you need by Week 9 to continue this bet?"
              className="w-full min-h-[60px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !verdict || !evidence.trim()}
          >
            {submitting
              ? "Recording..."
              : verdict === "red"
                ? "Record & Kill Bet"
                : "Record Verdict"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Kill Bet Action
// ============================================================

function KillBetAction({
  bet,
  onKilled,
}: {
  bet: Bet;
  onKilled: () => void;
}) {
  const supabase = createClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [killing, setKilling] = useState(false);

  async function handleKill() {
    if (!lessonsLearned.trim()) return;
    setKilling(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Create Decision record
    await supabase.from("decisions").insert({
      organization_id: bet.organization_id,
      venture_id: bet.venture_id,
      title: `Bet killed: ${bet.outcome}`,
      context: `Kill criteria: ${bet.kill_criteria ?? "N/A"}`,
      final_decision: `Killed. Lessons: ${lessonsLearned.trim()}`,
      owner_id: user!.id,
      linked_entity_id: bet.id,
      linked_entity_type: "bet",
      decided_at: new Date().toISOString(),
    });

    // Kill the bet
    await supabase
      .from("bets")
      .update({
        lifecycle_status: "completed",
        health_status: "red",
        kill_reason: lessonsLearned.trim(),
        killed_at: new Date().toISOString(),
      })
      .eq("id", bet.id);

    setKilling(false);
    onKilled();
  }

  if (!showConfirm) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setShowConfirm(true)}
      >
        Kill Bet
      </Button>
    );
  }

  return (
    <Card borderColor="var(--color-semantic-brick)" className="mt-4">
      <CardContent className="py-3 space-y-3">
        <p className="text-sm font-medium text-semantic-brick">
          Kill this bet?
        </p>
        <p className="text-xs text-subtle">
          The bet will move to the Graveyard. This is the system working, not
          a failure — smart kills protect focus.
        </p>
        {bet.kill_criteria && (
          <div className="p-2 bg-canvas rounded text-xs">
            <span className="font-semibold">Kill criteria:</span>{" "}
            {bet.kill_criteria}
          </div>
        )}
        <textarea
          value={lessonsLearned}
          onChange={(e) => setLessonsLearned(e.target.value)}
          placeholder="What did you learn? What would you do differently? (Required — this gets preserved in the Graveyard)"
          className="w-full min-h-[80px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleKill}
            disabled={killing || !lessonsLearned.trim()}
          >
            {killing ? "Killing..." : "Confirm Kill"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowConfirm(false)}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Helpers
// ============================================================

function getCycleEnd(start: Date, cadence: MoveCadence): Date {
  const end = new Date(start);
  switch (cadence) {
    case "daily":
      end.setDate(end.getDate() + 1);
      break;
    case "weekly":
      end.setDate(end.getDate() + 7);
      break;
    case "biweekly":
      end.setDate(end.getDate() + 14);
      break;
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      break;
  }
  return end;
}

// ============================================================
// Execution Health Summary
// ============================================================

function ExecutionHealth({ moves }: { moves: Move[] }) {
  const active = moves.filter(
    (m) => m.lifecycle_status !== "cut" && m.lifecycle_status !== "shipped"
  );
  if (active.length === 0) return null;

  const greenCount = active.filter((m) => m.health_status === "green").length;
  const yellowCount = active.filter((m) => m.health_status === "yellow").length;
  const redCount = active.filter((m) => m.health_status === "red").length;
  const healthPct = Math.round((greenCount / active.length) * 100);

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xs text-subtle">Execution health:</span>
      <div className="flex gap-1">
        {greenCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-semantic-green/10 text-semantic-green-text">
            {greenCount} green
          </span>
        )}
        {yellowCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-semantic-ochre/10 text-semantic-ochre-text">
            {yellowCount} yellow
          </span>
        )}
        {redCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-semantic-brick/10 text-semantic-brick">
            {redCount} red
          </span>
        )}
      </div>
      <span className="text-xs font-mono text-subtle">{healthPct}%</span>
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function BetDetailView({
  bet,
  blockers,
}: {
  bet: Bet;
  blockers: Blocker[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showCheckpoint, setShowCheckpoint] = useState(false);

  // Week-6 checkpoint detection: bet is ~6 weeks old and still active
  const betAgeMs = Date.now() - new Date(bet.created_at).getTime();
  const betAgeWeeks = betAgeMs / (7 * 24 * 60 * 60 * 1000);
  const isCheckpointDue =
    bet.lifecycle_status === "active" &&
    betAgeWeeks >= 5.5 &&
    betAgeWeeks <= 8;

  const milestoneMoves = bet.moves
    .filter((m) => m.type === "milestone")
    .sort(
      (a, b) =>
        (statusOrder[a.lifecycle_status] ?? 99) -
        (statusOrder[b.lifecycle_status] ?? 99)
    );

  const recurringMoves = bet.moves.filter((m) => m.type === "recurring");

  // Effort rollup (milestones only)
  const activeMilestones = milestoneMoves.filter(
    (m) => m.lifecycle_status !== "cut"
  );
  const totalEffort = activeMilestones.reduce(
    (sum, m) => sum + (m.effort_estimate?.value ?? 0),
    0
  );
  const resourceCap = bet.resource_cap?.value ?? 0;

  async function handleMoveStatusChange(moveId: string, newStatus: string) {
    if (newStatus === "cut") {
      const reason = prompt("Why is this move being cut?");
      if (!reason) return;
      await supabase
        .from("moves")
        .update({ lifecycle_status: newStatus, cut_reason: reason })
        .eq("id", moveId);
    } else {
      await supabase
        .from("moves")
        .update({ lifecycle_status: newStatus })
        .eq("id", moveId);
    }
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Button
        variant="tertiary"
        size="sm"
        onClick={() => router.push("/execution/bets")}
        className="mb-4"
      >
        Back to War Room
      </Button>

      <Card>
        <CardHeader className="bg-accent/5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-[22px] font-bold tracking-[-0.02em]">{bet.outcome}</h1>
              {bet.mechanism && (
                <p className="text-sm text-subtle mt-1">{bet.mechanism}</p>
              )}
            </div>
            <Badge status={bet.health_status}>
              {bet.health_status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {/* Week-6 Checkpoint Banner */}
          {isCheckpointDue && !showCheckpoint && (
            <div className="mb-4 p-3 bg-brass/10 border border-brass/20 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-brass-text">
                  Week-6 Checkpoint Due
                </p>
                <p className="text-xs text-subtle mt-0.5">
                  This bet is {Math.round(betAgeWeeks)} weeks old. Time to
                  present evidence and assign a verdict.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowCheckpoint(true)}>
                Start Checkpoint
              </Button>
            </div>
          )}

          {showCheckpoint && (
            <Week6Checkpoint
              bet={bet}
              onComplete={() => {
                setShowCheckpoint(false);
                router.refresh();
              }}
            />
          )}

          <div className="grid grid-cols-2 gap-4 py-4 border-b border-line">
            {bet.proof_by_week6 && (
              <div>
                <p className="text-xs font-semibold text-subtle uppercase">
                  Proof by Week 6
                </p>
                <p className="text-sm mt-0.5">{bet.proof_by_week6}</p>
              </div>
            )}
            {bet.kill_criteria && (
              <div>
                <p className="text-xs font-semibold text-subtle uppercase">
                  Kill Criteria
                </p>
                <p className="text-sm mt-0.5">{bet.kill_criteria}</p>
              </div>
            )}
            {bet.quarter && (
              <div>
                <p className="text-xs font-semibold text-subtle uppercase">
                  Quarter
                </p>
                <p className="text-sm mt-0.5">{bet.quarter}</p>
              </div>
            )}
          </div>

          {/* Effort rollup */}
          {totalEffort > 0 && (
            <div className="py-3 border-b border-line">
              <div className="flex items-center justify-between text-sm">
                <span className="text-subtle">
                  Total effort:{" "}
                  <span className="font-mono font-medium text-ink">
                    {totalEffort}h
                  </span>
                </span>
                {resourceCap > 0 && (
                  <span
                    className={`font-mono text-xs ${totalEffort > resourceCap ? "text-semantic-brick" : "text-subtle"}`}
                  >
                    {totalEffort > resourceCap ? "Over cap" : "Within cap"}:{" "}
                    {totalEffort}/{resourceCap}h
                  </span>
                )}
              </div>
              {resourceCap > 0 && (
                <div className="h-2 rounded-full bg-line mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${totalEffort > resourceCap ? "bg-semantic-brick" : "bg-accent"}`}
                    style={{
                      width: `${Math.min((totalEffort / resourceCap) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Execution Health */}
          <ExecutionHealth moves={bet.moves} />

          {/* Milestone Moves Section */}
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-ink mb-2">
              Milestone Moves ({milestoneMoves.length})
            </h2>
            {milestoneMoves.length === 0 ? (
              <p className="text-sm text-subtle">
                No milestone moves yet.
              </p>
            ) : (
              <div>
                {milestoneMoves.map((move) => (
                  <MoveRow
                    key={move.id}
                    move={move}
                    orgId={bet.organization_id}
                    onStatusChange={handleMoveStatusChange}
                    onRefresh={() => router.refresh()}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recurring Moves Section */}
          {recurringMoves.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-ink mb-2">
                Recurring Rhythms ({recurringMoves.length})
              </h2>
              <div>
                {recurringMoves.map((move) => (
                  <MoveRow
                    key={move.id}
                    move={move}
                    orgId={bet.organization_id}
                    onStatusChange={handleMoveStatusChange}
                    onRefresh={() => router.refresh()}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add Move Form */}
          <AddMoveForm
            betId={bet.id}
            organizationId={bet.organization_id}
            ventureId={bet.venture_id}
            onAdded={() => router.refresh()}
          />

          {/* Blockers Section */}
          {blockers.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-semantic-brick mb-2">
                Blockers ({blockers.length})
              </h2>
              <div className="space-y-2">
                {blockers.map((b) => (
                  <div
                    key={b.id}
                    className="text-sm p-2 border-l-4 border-semantic-brick bg-semantic-brick/5 rounded"
                  >
                    {b.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kill Bet Action */}
          {bet.lifecycle_status === "active" && (
            <div className="mt-8 pt-4 border-t border-line">
              <KillBetAction
                bet={bet}
                onKilled={() => router.push("/execution/bets/graveyard")}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
