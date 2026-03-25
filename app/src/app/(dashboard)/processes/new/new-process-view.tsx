"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutomationLevel } from "@/types/database";

// ============================================================
// Automation Level Config
// ============================================================

const AUTOMATION_LEVELS: {
  level: AutomationLevel;
  label: string;
  description: string;
}[] = [
  { level: 0, label: "Manual", description: "Fully human-executed" },
  { level: 1, label: "Assisted", description: "AI suggests, human executes" },
  { level: 2, label: "Partial", description: "AI executes parts, human reviews" },
  { level: 3, label: "Conditional", description: "AI executes, human spot-checks" },
  { level: 4, label: "Full", description: "AI executes autonomously" },
];

// ============================================================
// Main View
// ============================================================

export function NewProcessView({
  availableKpis,
  availableBets,
}: {
  availableKpis: Array<{ id: string; name: string }>;
  availableBets: Array<{ id: string; outcome: string }>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerConditions, setTriggerConditions] = useState("");
  const [automationLevel, setAutomationLevel] = useState<AutomationLevel>(0);
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([]);
  const [selectedBetIds, setSelectedBetIds] = useState<string[]>([]);
  const [kpiSearch, setKpiSearch] = useState("");
  const [betSearch, setBetSearch] = useState("");

  const filteredKpis = availableKpis.filter(
    (k) => !kpiSearch || k.name.toLowerCase().includes(kpiSearch.toLowerCase())
  );
  const filteredBets = availableBets.filter(
    (b) =>
      !betSearch || b.outcome.toLowerCase().includes(betSearch.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    // Insert the process
    const { data: newProcess, error: insertErr } = await supabase
      .from("processes")
      .insert({
        organization_id: userCtx.orgId,
        venture_id: userCtx.ventureId,
        name: name.trim(),
        description: description || null,
        trigger_conditions: triggerConditions || null,
        automation_level: automationLevel,
        linked_kpi_ids: selectedKpiIds,
        linked_bet_ids: selectedBetIds,
        owner_id: userCtx.userId,
        content: {},
        version: 1,
      })
      .select("id")
      .single();

    if (insertErr || !newProcess) {
      setError(insertErr?.message ?? "Failed to create process");
      setLoading(false);
      return;
    }

    // Insert first version
    await supabase.from("process_versions").insert({
      process_id: newProcess.id,
      version: 1,
      content: {},
      name: name.trim(),
      description: description || null,
      trigger_conditions: triggerConditions || null,
      changed_by: userCtx.userId,
    });

    router.push(`/processes/${newProcess.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => router.push("/processes")}
          className="text-sm text-subtle hover:text-ink"
        >
          &larr; Processes
        </button>
      </div>
      <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6 text-ink">
        Create New Process
      </h1>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            <Input
              id="name"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Customer Onboarding"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe this process..."
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink">
                Trigger Conditions
              </label>
              <textarea
                value={triggerConditions}
                onChange={(e) => setTriggerConditions(e.target.value)}
                rows={2}
                placeholder="When is this process triggered?"
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
              />
            </div>

            {/* Automation level selector */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink">
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
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line bg-surface text-ink hover:bg-canvas"
                    }`}
                  >
                    <span className="font-semibold">L{al.level}</span>
                    <span>{al.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-subtle">
                {AUTOMATION_LEVELS[automationLevel].description}
              </p>
            </div>

            {/* KPI Linker */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink">
                Link KPIs
              </label>
              <Input
                placeholder="Search KPIs..."
                value={kpiSearch}
                onChange={(e) => setKpiSearch(e.target.value)}
              />
              <div className="max-h-32 overflow-y-auto border border-line rounded-lg">
                {filteredKpis.map((k) => (
                  <label
                    key={k.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-canvas cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKpiIds.includes(k.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedKpiIds([...selectedKpiIds, k.id]);
                        } else {
                          setSelectedKpiIds(
                            selectedKpiIds.filter((x) => x !== k.id)
                          );
                        }
                      }}
                      className="rounded border-line text-accent focus:ring-accent-glow"
                    />
                    {k.name}
                  </label>
                ))}
                {filteredKpis.length === 0 && (
                  <p className="px-3 py-2 text-xs text-subtle">
                    No KPIs available
                  </p>
                )}
              </div>
            </div>

            {/* Bet Linker */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink">
                Link Bets
              </label>
              <Input
                placeholder="Search Bets..."
                value={betSearch}
                onChange={(e) => setBetSearch(e.target.value)}
              />
              <div className="max-h-32 overflow-y-auto border border-line rounded-lg">
                {filteredBets.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-canvas cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBetIds.includes(b.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBetIds([...selectedBetIds, b.id]);
                        } else {
                          setSelectedBetIds(
                            selectedBetIds.filter((x) => x !== b.id)
                          );
                        }
                      }}
                      className="rounded border-line text-accent focus:ring-accent-glow"
                    />
                    {b.outcome}
                  </label>
                ))}
                {filteredBets.length === 0 && (
                  <p className="px-3 py-2 text-xs text-subtle">
                    No Bets available
                  </p>
                )}
              </div>
            </div>

            {error && (
              <p className="text-sm text-semantic-brick">{error}</p>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Process"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
