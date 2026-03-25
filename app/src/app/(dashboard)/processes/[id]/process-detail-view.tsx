"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutomationLevel } from "@/types/database";

// ============================================================
// Types
// ============================================================

interface ProcessData {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_name: string;
  automation_level: AutomationLevel;
  lifecycle_status: string;
  version: number;
  content: Record<string, unknown>;
  trigger_conditions: string | null;
  linked_kpi_ids: string[];
  linked_bet_ids: string[];
  organization_id: string;
  venture_id: string;
  updated_at: string;
}

interface VersionData {
  id: string;
  version: number;
  content: Record<string, unknown>;
  name: string;
  description: string | null;
  trigger_conditions: string | null;
  changed_by: string;
  changed_by_name: string;
  created_at: string;
}

interface LinkedKpi {
  id: string;
  name: string;
  health_status: string;
}

interface LinkedBet {
  id: string;
  outcome: string;
  health_status: string;
}

// ============================================================
// Automation Level Config
// ============================================================

const AUTOMATION_LEVELS: {
  level: AutomationLevel;
  label: string;
  description: string;
  badge: "green" | "yellow" | "neutral";
}[] = [
  { level: 0, label: "Manual", description: "Fully human-executed", badge: "neutral" },
  { level: 1, label: "Assisted", description: "AI suggests, human executes", badge: "green" },
  { level: 2, label: "Partial", description: "AI executes parts, human reviews", badge: "yellow" },
  { level: 3, label: "Conditional", description: "AI executes, human spot-checks", badge: "yellow" },
  { level: 4, label: "Full", description: "AI executes autonomously", badge: "green" },
];

function healthToBadge(h: string): "green" | "yellow" | "red" | "neutral" {
  if (h === "green") return "green";
  if (h === "yellow") return "yellow";
  if (h === "red") return "red";
  return "neutral";
}

// ============================================================
// Automation Progress Bar
// ============================================================

function AutomationBar({ level }: { level: AutomationLevel }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {AUTOMATION_LEVELS.map((al) => (
          <div
            key={al.level}
            className={`flex-1 h-3 rounded ${
              al.level <= level ? "bg-moss" : "bg-warm-border"
            }`}
            title={`L${al.level}: ${al.label}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-warm-gray">
        {AUTOMATION_LEVELS.map((al) => (
          <span key={al.level} className={al.level <= level ? "text-moss font-medium" : ""}>
            L{al.level}
          </span>
        ))}
      </div>
      <p className="text-sm text-charcoal">
        <span className="font-medium">L{level} — {AUTOMATION_LEVELS[level].label}:</span>{" "}
        {AUTOMATION_LEVELS[level].description}
      </p>
    </div>
  );
}

// ============================================================
// Version History
// ============================================================

function VersionHistory({ versions }: { versions: VersionData[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (versions.length === 0) {
    return <p className="text-sm text-warm-gray">No version history yet.</p>;
  }

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.id} className="border border-warm-border rounded-lg">
          <button
            onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-parchment/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-charcoal">v{v.version}</span>
              <span className="text-xs text-warm-gray">{v.changed_by_name}</span>
            </div>
            <span className="text-xs text-warm-gray">
              {new Date(v.created_at).toLocaleDateString()}
            </span>
          </button>
          {expandedId === v.id && (
            <div className="px-4 pb-3 border-t border-warm-border pt-3 space-y-2">
              <p className="text-sm font-medium text-charcoal">{v.name}</p>
              {v.description && (
                <p className="text-sm text-warm-gray">{v.description}</p>
              )}
              {v.trigger_conditions && (
                <p className="text-xs text-warm-gray italic">
                  Trigger: {v.trigger_conditions}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Edit Form
// ============================================================

function EditForm({
  process,
  onSave,
  onCancel,
  saving,
}: {
  process: ProcessData;
  onSave: (data: {
    name: string;
    description: string;
    trigger_conditions: string;
    automation_level: AutomationLevel;
    linked_kpi_ids: string[];
    linked_bet_ids: string[];
  }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(process.name);
  const [description, setDescription] = useState(process.description ?? "");
  const [triggerConditions, setTriggerConditions] = useState(
    process.trigger_conditions ?? ""
  );
  const [automationLevel, setAutomationLevel] = useState<AutomationLevel>(
    process.automation_level
  );

  // KPI / Bet linkers
  const [kpiSearch, setKpiSearch] = useState("");
  const [betSearch, setBetSearch] = useState("");
  const [availableKpis, setAvailableKpis] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [availableBets, setAvailableBets] = useState<
    Array<{ id: string; outcome: string }>
  >([]);
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>(
    process.linked_kpi_ids ?? []
  );
  const [selectedBetIds, setSelectedBetIds] = useState<string[]>(
    process.linked_bet_ids ?? []
  );

  const supabase = createClient();

  // Fetch available KPIs
  useEffect(() => {
    async function fetchKpis() {
      const { data } = await supabase
        .from("kpis")
        .select("id, name")
        .eq("organization_id", process.organization_id)
        .order("name");
      setAvailableKpis(data ?? []);
    }
    fetchKpis();
  }, [process.organization_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available Bets
  useEffect(() => {
    async function fetchBets() {
      const { data } = await supabase
        .from("bets")
        .select("id, outcome")
        .eq("organization_id", process.organization_id)
        .eq("lifecycle_status", "active")
        .order("created_at");
      setAvailableBets(data ?? []);
    }
    fetchBets();
  }, [process.organization_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredKpis = availableKpis.filter(
    (k) =>
      !kpiSearch || k.name.toLowerCase().includes(kpiSearch.toLowerCase())
  );
  const filteredBets = availableBets.filter(
    (b) =>
      !betSearch ||
      b.outcome.toLowerCase().includes(betSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Input
        id="name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className="space-y-1">
        <label className="block text-sm font-medium text-charcoal">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm text-charcoal placeholder:text-warm-gray focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-charcoal">
          Trigger Conditions
        </label>
        <textarea
          value={triggerConditions}
          onChange={(e) => setTriggerConditions(e.target.value)}
          rows={2}
          placeholder="When is this process used?"
          className="block w-full rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm text-charcoal placeholder:text-warm-gray focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20"
        />
      </div>

      {/* Automation level selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-charcoal">
          Automation Level
        </label>
        <div className="grid grid-cols-5 gap-2">
          {AUTOMATION_LEVELS.map((al) => (
            <button
              key={al.level}
              type="button"
              onClick={() => setAutomationLevel(al.level)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors ${
                automationLevel === al.level
                  ? "border-moss bg-moss/10 text-moss"
                  : "border-warm-border bg-ivory text-charcoal hover:bg-parchment"
              }`}
            >
              <span className="font-semibold">L{al.level}</span>
              <span>{al.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Linker */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-charcoal">
          Linked KPIs
        </label>
        <Input
          placeholder="Search KPIs..."
          value={kpiSearch}
          onChange={(e) => setKpiSearch(e.target.value)}
        />
        <div className="max-h-32 overflow-y-auto border border-warm-border rounded-lg">
          {filteredKpis.map((k) => (
            <label
              key={k.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-parchment cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selectedKpiIds.includes(k.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedKpiIds([...selectedKpiIds, k.id]);
                  } else {
                    setSelectedKpiIds(selectedKpiIds.filter((x) => x !== k.id));
                  }
                }}
                className="rounded border-warm-border text-moss focus:ring-moss"
              />
              {k.name}
            </label>
          ))}
          {filteredKpis.length === 0 && (
            <p className="px-3 py-2 text-xs text-warm-gray">No KPIs found</p>
          )}
        </div>
      </div>

      {/* Bet Linker */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-charcoal">
          Linked Bets
        </label>
        <Input
          placeholder="Search Bets..."
          value={betSearch}
          onChange={(e) => setBetSearch(e.target.value)}
        />
        <div className="max-h-32 overflow-y-auto border border-warm-border rounded-lg">
          {filteredBets.map((b) => (
            <label
              key={b.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-parchment cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selectedBetIds.includes(b.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedBetIds([...selectedBetIds, b.id]);
                  } else {
                    setSelectedBetIds(selectedBetIds.filter((x) => x !== b.id));
                  }
                }}
                className="rounded border-warm-border text-moss focus:ring-moss"
              />
              {b.outcome}
            </label>
          ))}
          {filteredBets.length === 0 && (
            <p className="px-3 py-2 text-xs text-warm-gray">No Bets found</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave({
              name,
              description,
              trigger_conditions: triggerConditions,
              automation_level: automationLevel,
              linked_kpi_ids: selectedKpiIds,
              linked_bet_ids: selectedBetIds,
            })
          }
          disabled={saving || !name.trim()}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function ProcessDetailView({
  process,
  versions,
  linkedKpis,
  linkedBets,
}: {
  process: ProcessData;
  versions: VersionData[];
  linkedKpis: LinkedKpi[];
  linkedBets: LinkedBet[];
}) {
  const router = useRouter();
  const userCtx = useUserContext();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentProcess, setCurrentProcess] = useState(process);

  const auto = AUTOMATION_LEVELS[currentProcess.automation_level];

  const [creatingTemplate, setCreatingTemplate] = useState(false);

  async function handleUseAsTemplate() {
    setCreatingTemplate(true);
    setError("");

    // Build editor-friendly body from process content
    const processContent = currentProcess.content;
    const bodyParts: string[] = [];

    bodyParts.push(`<h1>${currentProcess.name}</h1>`);
    if (currentProcess.description) {
      bodyParts.push(`<p>${currentProcess.description}</p>`);
    }
    if (currentProcess.trigger_conditions) {
      bodyParts.push(
        `<blockquote><strong>Trigger:</strong> ${currentProcess.trigger_conditions}</blockquote>`
      );
    }

    // If process content has steps or structured data, render them
    const steps = (processContent as Record<string, unknown>).steps as
      | Array<{ title?: string; body?: string }>
      | undefined;
    if (steps && Array.isArray(steps)) {
      bodyParts.push("<h2>Steps</h2>");
      steps.forEach((step, i) => {
        bodyParts.push(
          `<h3>${i + 1}. ${step.title ?? `Step ${i + 1}`}</h3>`
        );
        if (step.body) bodyParts.push(`<p>${step.body}</p>`);
      });
    }

    const bodyHtml = bodyParts.join("\n");

    const { data: piece, error: insertErr } = await supabase
      .from("content_pieces")
      .insert({
        organization_id: currentProcess.organization_id,
        venture_id: currentProcess.venture_id,
        title: `${currentProcess.name} (from process template)`,
        machine_type: "deep_content",
        lifecycle_status: "ideation",
        body_json: { type: "doc", content: [] },
        body_html: bodyHtml,
        owner_id: userCtx.userId,
      })
      .select("id")
      .single();

    if (insertErr || !piece) {
      setError(insertErr?.message ?? "Failed to create content piece");
      setCreatingTemplate(false);
      return;
    }

    router.push(`/content/${piece.id}`);
  }

  async function handleArchive() {
    const newStatus =
      currentProcess.lifecycle_status === "active" ? "archived" : "active";
    const { error: err } = await supabase
      .from("processes")
      .update({ lifecycle_status: newStatus })
      .eq("id", currentProcess.id);
    if (err) {
      setError(err.message);
    } else {
      router.refresh();
    }
  }

  async function handleSave(data: {
    name: string;
    description: string;
    trigger_conditions: string;
    automation_level: AutomationLevel;
    linked_kpi_ids: string[];
    linked_bet_ids: string[];
  }) {
    setSaving(true);
    setError("");

    const newVersion = currentProcess.version + 1;

    // Update the process
    const { error: updateErr } = await supabase
      .from("processes")
      .update({
        name: data.name,
        description: data.description || null,
        trigger_conditions: data.trigger_conditions || null,
        automation_level: data.automation_level,
        linked_kpi_ids: data.linked_kpi_ids,
        linked_bet_ids: data.linked_bet_ids,
        version: newVersion,
      })
      .eq("id", currentProcess.id);

    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }

    // Insert version record
    const { error: versionErr } = await supabase
      .from("process_versions")
      .insert({
        process_id: currentProcess.id,
        version: newVersion,
        content: currentProcess.content,
        name: data.name,
        description: data.description || null,
        trigger_conditions: data.trigger_conditions || null,
        changed_by: userCtx.userId,
      });

    if (versionErr) {
      setError(versionErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  // AI improvement suggestions
  const [aiSuggestions, setAiSuggestions] = useState<
    Array<{ title: string; why: string; nextStep: string }> | null
  >(null);
  const [aiAutomationAdvice, setAiAutomationAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function handleGetAiSuggestions() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/process-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: currentProcess.id }),
      });
      const data = await res.json();
      if (data.suggestions) setAiSuggestions(data.suggestions);
      if (data.automationAdvice) setAiAutomationAdvice(data.automationAdvice);
    } catch {
      setError("AI analysis failed. Check your connection.");
    }
    setAiLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/processes")}
              className="text-sm text-warm-gray hover:text-charcoal"
            >
              &larr; Processes
            </button>
          </div>
          <h1 className="text-2xl font-bold text-charcoal">
            {currentProcess.name}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-warm-gray">
              Owner: {currentProcess.owner_name}
            </span>
            <Badge
              status={
                currentProcess.lifecycle_status === "active"
                  ? "green"
                  : "neutral"
              }
            >
              {currentProcess.lifecycle_status}
            </Badge>
            <Badge status={auto.badge} dot={false}>
              L{currentProcess.automation_level} {auto.label}
            </Badge>
            <span className="text-xs text-warm-gray">
              v{currentProcess.version}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <Button
                variant="tertiary"
                onClick={handleUseAsTemplate}
                disabled={creatingTemplate}
              >
                {creatingTemplate ? "Creating..." : "Use as Template"}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="secondary" onClick={handleArchive}>
                {currentProcess.lifecycle_status === "active"
                  ? "Archive"
                  : "Reactivate"}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-semantic-brick">{error}</p>
      )}

      {editing ? (
        <Card>
          <CardContent className="pt-6">
            <EditForm
              process={currentProcess}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
              saving={saving}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {currentProcess.description && (
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold text-moss">
                    Description
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-charcoal whitespace-pre-wrap">
                    {currentProcess.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Trigger Conditions */}
            {currentProcess.trigger_conditions && (
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold text-moss">
                    Trigger Conditions
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-charcoal whitespace-pre-wrap">
                    {currentProcess.trigger_conditions}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Automation Level */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-moss">
                  Automation Level
                </h3>
              </CardHeader>
              <CardContent>
                <AutomationBar level={currentProcess.automation_level} />
              </CardContent>
            </Card>

            {/* Linked KPIs */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-moss">
                  Linked KPIs ({linkedKpis.length})
                </h3>
              </CardHeader>
              <CardContent>
                {linkedKpis.length === 0 ? (
                  <p className="text-sm text-warm-gray">No linked KPIs</p>
                ) : (
                  <div className="space-y-2">
                    {linkedKpis.map((k) => (
                      <div
                        key={k.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-charcoal">{k.name}</span>
                        <Badge status={healthToBadge(k.health_status)}>
                          {k.health_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Linked Bets */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-moss">
                  Linked Bets ({linkedBets.length})
                </h3>
              </CardHeader>
              <CardContent>
                {linkedBets.length === 0 ? (
                  <p className="text-sm text-warm-gray">No linked Bets</p>
                ) : (
                  <div className="space-y-2">
                    {linkedBets.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-charcoal">
                          {b.outcome}
                        </span>
                        <Badge status={healthToBadge(b.health_status)}>
                          {b.health_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Impact Analysis */}
            {(linkedKpis.length > 0 || linkedBets.length > 0) && (
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold text-moss">
                    Impact Analysis
                  </h3>
                </CardHeader>
                <CardContent className="space-y-2">
                  {linkedKpis.filter((k) => k.health_status === "red" || k.health_status === "yellow").length > 0 && (
                    <div className="text-xs p-2 bg-semantic-ochre/5 border-l-2 border-semantic-ochre rounded">
                      <span className="font-medium text-semantic-ochre">Warning:</span>{" "}
                      <span className="text-charcoal">
                        Changing this process may affect{" "}
                        {linkedKpis.filter((k) => k.health_status === "red").length > 0 && (
                          <span className="text-semantic-brick font-medium">
                            {linkedKpis.filter((k) => k.health_status === "red").length} red KPI{linkedKpis.filter((k) => k.health_status === "red").length > 1 ? "s" : ""}
                          </span>
                        )}
                        {linkedKpis.filter((k) => k.health_status === "red").length > 0 && linkedKpis.filter((k) => k.health_status === "yellow").length > 0 && " and "}
                        {linkedKpis.filter((k) => k.health_status === "yellow").length > 0 && (
                          <span className="text-semantic-ochre font-medium">
                            {linkedKpis.filter((k) => k.health_status === "yellow").length} yellow KPI{linkedKpis.filter((k) => k.health_status === "yellow").length > 1 ? "s" : ""}
                          </span>
                        )}
                        . Proceed carefully.
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-warm-gray">
                    {linkedKpis.length} linked KPI{linkedKpis.length !== 1 ? "s" : ""} · {linkedBets.length} linked bet{linkedBets.length !== 1 ? "s" : ""}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Improvement Suggestions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-sage">
                    AI Suggestions
                  </h3>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={handleGetAiSuggestions}
                    disabled={aiLoading}
                  >
                    {aiLoading ? "Analyzing..." : aiSuggestions ? "Refresh" : "Analyze"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!aiSuggestions && !aiLoading && (
                  <p className="text-xs text-warm-gray">
                    Get AI-powered improvement suggestions based on this process, its linked KPIs, and automation level.
                  </p>
                )}
                {aiSuggestions && (
                  <div className="space-y-3">
                    {aiSuggestions.map((s, i) => (
                      <div
                        key={i}
                        className="border-l-2 border-sage pl-2.5 space-y-0.5"
                      >
                        <p className="text-xs font-medium text-charcoal">
                          {s.title}
                        </p>
                        <p className="text-[10px] text-warm-gray">{s.why}</p>
                        <p className="text-[10px] text-sage-text">
                          Next: {s.nextStep}
                        </p>
                      </div>
                    ))}
                    {aiAutomationAdvice && (
                      <div className="mt-3 pt-3 border-t border-warm-border">
                        <p className="text-xs font-medium text-charcoal mb-0.5">
                          Automation Advice
                        </p>
                        <p className="text-[10px] text-warm-gray">
                          {aiAutomationAdvice}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Version History */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-moss">
                  Version History
                </h3>
              </CardHeader>
              <CardContent>
                <VersionHistory versions={versions} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
