"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// Types
// ============================================================

interface ProcessInfo {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  automation_level: number;
  lifecycle_status: string;
  linked_kpi_ids: string[];
  linked_bet_ids: string[];
  venture_id: string;
}

interface AgentInfo {
  id: string;
  name: string;
  category: string;
  automation_level: number;
  status: string;
}

// ============================================================
// Constants
// ============================================================

const LEVEL_LABELS: Record<number, string> = {
  0: "Manual",
  1: "Assisted",
  2: "Partial",
  3: "Conditional",
  4: "Full",
};

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  0: "Entirely human-driven. No automation involved.",
  1: "AI suggests, human decides and executes.",
  2: "AI executes some steps, human supervises.",
  3: "AI executes most steps, human approves exceptions.",
  4: "Fully automated. Human monitors outcomes only.",
};

const LEVEL_COLORS: Record<number, string> = {
  0: "bg-warm-gray",
  1: "bg-sage",
  2: "bg-semantic-ochre",
  3: "bg-moss",
  4: "bg-semantic-green",
};

// ============================================================
// Ladder Overview (Stacked Bar)
// ============================================================

function LadderOverview({ processes }: { processes: ProcessInfo[] }) {
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const p of processes) {
      const level = Math.min(4, Math.max(0, p.automation_level));
      counts[level]++;
    }
    return counts;
  }, [processes]);

  const total = processes.length || 1;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-charcoal">Ladder Overview</h2>
        <p className="text-xs text-warm-gray">
          Distribution of {processes.length} processes across automation levels
        </p>
      </CardHeader>
      <CardContent>
        {/* Stacked horizontal bar */}
        <div className="flex rounded-lg overflow-hidden h-10 mb-3">
          {distribution.map((count, level) =>
            count > 0 ? (
              <div
                key={level}
                className={`${LEVEL_COLORS[level]} flex items-center justify-center transition-all`}
                style={{ width: `${(count / total) * 100}%` }}
                title={`L${level} ${LEVEL_LABELS[level]}: ${count} processes`}
              >
                <span className="text-xs font-medium text-white drop-shadow-sm">
                  L{level}: {count}
                </span>
              </div>
            ) : null
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {distribution.map((count, level) => (
            <div key={level} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[level]}`} />
              <span className="text-xs text-warm-gray">
                L{level} {LEVEL_LABELS[level]} ({count})
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Advance Confirmation Dialog
// ============================================================

function AdvanceDialog({
  process,
  onConfirm,
  onCancel,
}: {
  process: ProcessInfo;
  onConfirm: (justification: string) => void;
  onCancel: () => void;
}) {
  const [justification, setJustification] = useState("");
  const nextLevel = Math.min(4, process.automation_level + 1);

  return (
    <div className="fixed inset-0 bg-charcoal/50 flex items-center justify-center z-50">
      <Card className="max-w-md w-full mx-4">
        <CardHeader>
          <h3 className="text-lg font-semibold text-charcoal">Advance Automation Level</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-charcoal font-medium">{process.name}</p>
            <p className="text-xs text-warm-gray mt-1">
              L{process.automation_level} {LEVEL_LABELS[process.automation_level]} &rarr;{" "}
              L{nextLevel} {LEVEL_LABELS[nextLevel]}
            </p>
          </div>

          <div className="bg-parchment rounded-lg p-3">
            <p className="text-xs font-medium text-charcoal mb-1">
              What changes at L{nextLevel}:
            </p>
            <p className="text-xs text-warm-gray">{LEVEL_DESCRIPTIONS[nextLevel]}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-charcoal block mb-1">
              Justification (required)
            </label>
            <Input
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why is this process ready to advance?"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm(justification)}
              disabled={!justification.trim()}
            >
              Advance to L{nextLevel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Process List Table
// ============================================================

function ProcessListTable({
  processes,
  sacredProcessIds,
  userNameMap,
  orgId,
  userId,
}: {
  processes: ProcessInfo[];
  sacredProcessIds: string[];
  userNameMap: Record<string, string>;
  orgId: string;
  userId: string;
}) {
  const [advancingProcess, setAdvancingProcess] = useState<ProcessInfo | null>(null);
  const [localProcesses, setLocalProcesses] = useState(processes);

  async function handleAdvance(justification: string) {
    if (!advancingProcess) return;
    const nextLevel = Math.min(4, advancingProcess.automation_level + 1);
    const isSacred = sacredProcessIds.includes(advancingProcess.id);

    if (isSacred) {
      alert("This process is on the Sacred Work list and cannot be automated.");
      setAdvancingProcess(null);
      return;
    }

    const supabase = createClient();

    // Update process
    const { error } = await supabase
      .from("processes")
      .update({ automation_level: nextLevel })
      .eq("id", advancingProcess.id);

    if (error) {
      alert("Failed to advance: " + error.message);
      setAdvancingProcess(null);
      return;
    }

    // Log the advancement
    await supabase.from("policy_overrides").insert({
      policy_name: "automation_level_advance",
      overridden_by: userId,
      justification,
      entity_id: advancingProcess.id,
      entity_type: "process",
      organization_id: orgId,
    });

    // Update local state
    setLocalProcesses((prev) =>
      prev.map((p) =>
        p.id === advancingProcess.id ? { ...p, automation_level: nextLevel } : p
      )
    );
    setAdvancingProcess(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-charcoal">Process List</h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-warm-border text-left text-warm-gray">
                  <th className="px-4 py-2">Process</th>
                  <th className="px-4 py-2">Level</th>
                  <th className="px-4 py-2">Owner</th>
                  <th className="px-4 py-2">KPIs</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {localProcesses.map((p) => {
                  const isSacred = sacredProcessIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-warm-border/50 hover:bg-parchment/50"
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-charcoal font-medium">{p.name}</span>
                          {isSacred && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-brass text-brass bg-brass/10">
                              Sacred
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className={`w-4 h-2 rounded-sm ${
                                level <= p.automation_level ? "bg-moss" : "bg-warm-border"
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-warm-gray">
                            L{p.automation_level}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-warm-gray">
                        {userNameMap[p.owner_id] ?? "Unknown"}
                      </td>
                      <td className="px-4 py-2 text-warm-gray">
                        {p.linked_kpi_ids?.length ?? 0}
                      </td>
                      <td className="px-4 py-2">
                        {p.automation_level < 4 && !isSacred ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setAdvancingProcess(p)}
                          >
                            Advance
                          </Button>
                        ) : isSacred ? (
                          <span className="text-warm-gray text-[10px]">Locked</span>
                        ) : (
                          <span className="text-semantic-green text-[10px]">Max level</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {advancingProcess && (
        <AdvanceDialog
          process={advancingProcess}
          onConfirm={handleAdvance}
          onCancel={() => setAdvancingProcess(null)}
        />
      )}
    </>
  );
}

// ============================================================
// Agent Status
// ============================================================

function AgentStatusSection({ agents }: { agents: AgentInfo[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-charcoal">Agent Status</h2>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <p className="text-sm text-warm-gray">No agents configured.</p>
        ) : (
          <div className="space-y-2">
            {agents.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 border-b border-warm-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-charcoal">{a.name}</p>
                  <p className="text-xs text-warm-gray">{a.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`w-3 h-2 rounded-sm ${
                          level <= a.automation_level ? "bg-moss" : "bg-warm-border"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-warm-gray">
                    L{a.automation_level} {LEVEL_LABELS[a.automation_level]}
                  </span>
                  <Badge
                    status={a.status === "active" ? "green" : a.status === "paused" ? "yellow" : "neutral"}
                    dot
                  >
                    {a.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sacred Work List
// ============================================================

function SacredWorkSection({
  processes,
  sacredProcessIds: initialSacredIds,
  orgId,
}: {
  processes: ProcessInfo[];
  sacredProcessIds: string[];
  orgId: string;
}) {
  const [sacredIds, setSacredIds] = useState<string[]>(initialSacredIds);
  const [addingProcessId, setAddingProcessId] = useState("");
  const [saving, setSaving] = useState(false);

  const sacredProcesses = processes.filter((p) => sacredIds.includes(p.id));
  const nonSacredProcesses = processes.filter((p) => !sacredIds.includes(p.id));

  async function saveSacredIds(next: string[]) {
    setSaving(true);
    const supabase = createClient();

    // Fetch current org settings then update
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const currentSettings = (org?.settings ?? {}) as Record<string, unknown>;
    await supabase
      .from("organizations")
      .update({
        settings: { ...currentSettings, sacred_process_ids: next },
      })
      .eq("id", orgId);

    setSacredIds(next);
    setSaving(false);
  }

  function addProcess() {
    if (!addingProcessId || sacredIds.includes(addingProcessId)) return;
    saveSacredIds([...sacredIds, addingProcessId]);
    setAddingProcessId("");
  }

  function removeProcess(id: string) {
    saveSacredIds(sacredIds.filter((s) => s !== id));
  }

  return (
    <Card className="border-brass" style={{ borderColor: "var(--color-brass)", borderWidth: "2px" }}>
      <CardHeader>
        <h2 className="text-lg font-semibold text-charcoal">Sacred Work</h2>
        <p className="text-xs text-warm-gray">
          Processes on this list cannot have their automation level raised above L0.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current sacred processes */}
        {sacredProcesses.length === 0 ? (
          <p className="text-sm text-warm-gray">No processes marked as sacred.</p>
        ) : (
          <div className="space-y-2">
            {sacredProcesses.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-parchment"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-brass text-brass bg-brass/10">
                    Sacred
                  </span>
                  <span className="text-sm text-charcoal">{p.name}</span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeProcess(p.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add process */}
        <div className="flex gap-2">
          <select
            value={addingProcessId}
            onChange={(e) => setAddingProcessId(e.target.value)}
            className="flex-1 text-sm border border-warm-border rounded-lg px-3 py-1.5 bg-ivory text-charcoal"
          >
            <option value="">Select a process to protect...</option>
            {nonSacredProcesses.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={addProcess}
            disabled={!addingProcessId || saving}
          >
            Add to Sacred List
          </Button>
        </div>

        {saving && <p className="text-xs text-warm-gray">Saving...</p>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Monthly Audit
// ============================================================

function MonthlyAudit({
  processes,
  orgId,
  userId,
  ventures,
}: {
  processes: ProcessInfo[];
  orgId: string;
  userId: string;
  ventures: Array<{ id: string; name: string }>;
}) {
  const [auditActive, setAuditActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [auditResults, setAuditResults] = useState<
    Array<{ processId: string; processName: string; response: "yes" | "no" | "skip" }>
  >([]);
  const [saving, setSaving] = useState(false);

  // Only audit L0-L2 processes
  const auditableProcesses = processes.filter(
    (p) => p.automation_level <= 2 && p.lifecycle_status === "active"
  );

  const currentProcess = auditActive ? auditableProcesses[currentIndex] : null;
  const progress = auditActive
    ? Math.round((currentIndex / auditableProcesses.length) * 100)
    : 0;

  function handleResponse(response: "yes" | "no" | "skip") {
    if (!currentProcess) return;
    setAuditResults((prev) => [
      ...prev,
      { processId: currentProcess.id, processName: currentProcess.name, response },
    ]);
    if (currentIndex + 1 < auditableProcesses.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      completeAudit([
        ...auditResults,
        { processId: currentProcess.id, processName: currentProcess.name, response },
      ]);
    }
  }

  async function completeAudit(
    results: Array<{ processId: string; processName: string; response: string }>
  ) {
    setSaving(true);
    const supabase = createClient();

    const ventureId = ventures[0]?.id ?? null;

    await supabase.from("meeting_logs").insert({
      organization_id: orgId,
      venture_id: ventureId,
      meeting_type: "automation_audit",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      facilitator_id: userId,
      output: {
        auditResults: results,
        totalReviewed: results.length,
        canAdvance: results.filter((r) => r.response === "yes").length,
        cannotAdvance: results.filter((r) => r.response === "no").length,
        skipped: results.filter((r) => r.response === "skip").length,
      },
    });

    setSaving(false);
    setAuditActive(false);
    setCurrentIndex(0);
    setAuditResults([]);
    alert("Audit saved to meeting logs.");
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-charcoal">Monthly Audit Checklist</h2>
        <p className="text-xs text-warm-gray">
          Review L0-L2 processes and assess which can be advanced.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!auditActive ? (
          <div className="text-center py-4">
            <p className="text-sm text-warm-gray mb-3">
              {auditableProcesses.length} processes at L0-L2 to review.
            </p>
            <Button
              onClick={() => {
                setAuditActive(true);
                setCurrentIndex(0);
                setAuditResults([]);
              }}
              disabled={auditableProcesses.length === 0}
            >
              Start Monthly Audit
            </Button>
          </div>
        ) : currentProcess ? (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-warm-gray">
                <span>
                  Process {currentIndex + 1} of {auditableProcesses.length}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-warm-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-moss rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Current process */}
            <div className="bg-parchment rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-charcoal">{currentProcess.name}</h3>
              {currentProcess.description && (
                <p className="text-xs text-warm-gray">{currentProcess.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-warm-gray">
                  Current: L{currentProcess.automation_level}{" "}
                  {LEVEL_LABELS[currentProcess.automation_level]}
                </span>
                <span className="text-xs text-warm-gray">&rarr;</span>
                <span className="text-xs text-charcoal font-medium">
                  L{Math.min(4, currentProcess.automation_level + 1)}{" "}
                  {LEVEL_LABELS[Math.min(4, currentProcess.automation_level + 1)]}
                </span>
              </div>
            </div>

            {/* Response buttons */}
            <div className="flex items-center gap-3">
              <p className="text-sm text-charcoal">Can this process be advanced?</p>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" onClick={() => handleResponse("yes")}>
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleResponse("no")}
                >
                  No
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() => handleResponse("skip")}
                >
                  Skip
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            {saving ? (
              <p className="text-sm text-warm-gray">Saving audit results...</p>
            ) : (
              <p className="text-sm text-warm-gray">Audit complete.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main View
// ============================================================

export function AutomationLadderView({
  processes,
  agents,
  sacredProcessIds,
  userNameMap,
  orgId,
  userId,
  ventures,
}: {
  processes: ProcessInfo[];
  agents: AgentInfo[];
  sacredProcessIds: string[];
  userNameMap: Record<string, string>;
  orgId: string;
  userId: string;
  ventures: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Automation Ladder</h1>
        <p className="text-sm text-warm-gray mt-1">
          Track and advance process automation across your organization.
        </p>
      </div>

      {/* Ladder Overview */}
      <LadderOverview processes={processes} />

      {/* Sacred Work */}
      <SacredWorkSection
        processes={processes}
        sacredProcessIds={sacredProcessIds}
        orgId={orgId}
      />

      {/* Process List */}
      <ProcessListTable
        processes={processes}
        sacredProcessIds={sacredProcessIds}
        userNameMap={userNameMap}
        orgId={orgId}
        userId={userId}
      />

      {/* Agent Status */}
      <AgentStatusSection agents={agents} />

      {/* Monthly Audit */}
      <MonthlyAudit
        processes={processes}
        orgId={orgId}
        userId={userId}
        ventures={ventures}
      />
    </div>
  );
}
