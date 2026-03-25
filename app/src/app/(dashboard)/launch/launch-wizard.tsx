"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ONBOARDING_STEPS, completedCount } from "@/lib/onboarding";
import type { OnboardingProgress } from "@/lib/onboarding";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ParseImportResult,
  StepGuidanceResult,
  ImportTargetType,
  StepContext,
} from "@/lib/ai/launch-assistant";

interface WizardProps {
  progress: OnboardingProgress;
  ventureName: string;
  ventureSettings: Record<string, unknown>;
  ventureId: string;
  orgId: string;
  isSecondVenture?: boolean;
  firstVentureContext?: StepContext;
}

// ============================================================
// AI Import Panel — paste & parse unstructured text
// ============================================================

function ImportPanel({
  targetType,
  onImport,
}: {
  targetType: ImportTargetType;
  onImport: (items: Array<Record<string, unknown>>) => void;
}) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseImportResult | null>(null);
  const [error, setError] = useState("");

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ai/launch-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parse", text, targetType }),
      });
      const data = (await res.json()) as ParseImportResult;
      if (data.items && data.items.length > 0) {
        setResult(data);
      } else {
        setError("No items found. Try providing more detail.");
      }
    } catch {
      setError("Failed to parse. Please try again.");
    } finally {
      setParsing(false);
    }
  }

  function handleConfirm() {
    if (result?.items) {
      onImport(result.items);
      setResult(null);
      setText("");
    }
  }

  return (
    <div className="mt-4 p-4 rounded-lg border border-sage/40 bg-sage/5">
      <p className="text-sm font-medium text-ink mb-2">
        Paste &amp; Import
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste from a spreadsheet, doc, or notes..."
        className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm min-h-[80px] focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
      />
      <div className="flex items-center gap-2 mt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleParse}
          disabled={parsing || !text.trim()}
          className="!border-sage !text-sage hover:!bg-sage/10"
        >
          {parsing ? "Parsing..." : "Parse with AI"}
        </Button>
        {error && <p className="text-sm text-semantic-brick">{error}</p>}
      </div>

      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-subtle">
              Confidence: {result.confidence}
            </span>
          </div>
          {result.items.map((item, i) => (
            <div
              key={i}
              className="p-2 rounded border border-line bg-surface text-sm"
            >
              {Object.entries(item).map(([key, val]) => (
                <span key={key} className="mr-3">
                  <span className="font-medium text-ink">{key}:</span>{" "}
                  <span className="text-subtle">{String(val ?? "")}</span>
                </span>
              ))}
            </div>
          ))}
          {result.suggestions.length > 0 && (
            <ul className="text-xs text-subtle list-disc ml-4">
              {result.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          <Button variant="primary" size="sm" onClick={handleConfirm}>
            Import {result.items.length} item{result.items.length !== 1 ? "s" : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// AI Guidance Panel — contextual tips and suggestions
// ============================================================

function GuidancePanel({
  step,
  context,
  onSuggestion,
}: {
  step: number;
  context: StepContext;
  onSuggestion?: (text: string) => void;
}) {
  const [guidance, setGuidance] = useState<StepGuidanceResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset guidance when the step changes
  useEffect(() => {
    setGuidance(null);
  }, [step]);

  async function handleSuggest() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/launch-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guidance", step, context }),
      });
      const data = (await res.json()) as StepGuidanceResult;
      setGuidance(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 p-3 rounded-lg border border-sage/30 bg-sage/5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-sage">AI Guidance</p>
        <Button
          variant="tertiary"
          size="sm"
          onClick={handleSuggest}
          disabled={loading}
          className="!text-sage text-xs"
        >
          {loading ? "Thinking..." : "Suggest"}
        </Button>
      </div>

      {guidance && (
        <div className="space-y-2 mt-2">
          <p className="text-sm text-ink">{guidance.guidance}</p>

          {guidance.examples.length > 0 && (
            <div>
              <p className="text-xs font-medium text-subtle mb-1">Examples:</p>
              <ul className="space-y-1">
                {guidance.examples.map((ex, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="text-sm text-accent hover:underline text-left"
                      onClick={() => onSuggestion?.(ex)}
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guidance.tips.length > 0 && (
            <div>
              <p className="text-xs font-medium text-subtle mb-1">Tips:</p>
              <ul className="text-xs text-subtle list-disc ml-4 space-y-0.5">
                {guidance.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Progress Milestones
// ============================================================

const MILESTONES = [
  {
    label: "Foundation Set",
    description: "Vision defined",
    steps: [1, 2, 3],
    icon: "🏗️",
  },
  {
    label: "Scoreboard Live",
    description: "Measuring what matters",
    steps: [4, 5],
    icon: "📊",
  },
  {
    label: "Team Ready",
    description: "Bets placed, team onboarded",
    steps: [6, 7],
    icon: "👥",
  },
  {
    label: "System Active",
    description: "Cadence established",
    steps: [8, 9, 10],
    icon: "⚡",
  },
];

function LaunchMilestones({
  steps,
}: {
  steps: Record<string, { completed?: boolean }>;
}) {
  const achieved = MILESTONES.filter((m) =>
    m.steps.every((s) => steps[String(s)]?.completed)
  );

  if (achieved.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {achieved.map((m) => (
        <div
          key={m.label}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20"
        >
          <span className="text-sm">{m.icon}</span>
          <span className="text-xs font-semibold text-accent">{m.label}</span>
          <span className="text-[10px] text-subtle">{m.description}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Launch Wizard
// ============================================================

export function LaunchWizard({
  progress,
  ventureName,
  ventureSettings,
  ventureId,
  orgId,
  isSecondVenture,
  firstVentureContext,
}: WizardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(progress.current_step);
  const [loading, setLoading] = useState(false);

  // Step form state
  const [ventureName_, setVentureName] = useState(ventureName);
  const [bhag, setBhag] = useState((ventureSettings.bhag as string) ?? "");
  const [filters, setFilters] = useState<string[]>(
    (ventureSettings.strategic_filters as string[]) ?? ["", "", ""]
  );
  const [outcomes, setOutcomes] = useState<string[]>(
    (ventureSettings.annual_outcomes as string[]) ?? ["", "", ""]
  );
  const [syncDay, setSyncDay] = useState(
    (ventureSettings.weekly_sync_day as string) ?? "monday"
  );
  const [syncTime, setSyncTime] = useState(
    (ventureSettings.weekly_sync_time as string) ?? "09:00"
  );

  const done = completedCount(progress.steps);
  const allComplete = progress.completed;

  // Build context for AI guidance
  const buildContext = useCallback((): StepContext => {
    return {
      ventureName: ventureName_,
      bhag: bhag || undefined,
      filters: filters.filter((f) => f.trim()),
      outcomes: outcomes.filter((o) => o.trim()),
    };
  }, [ventureName_, bhag, filters, outcomes]);

  async function saveAndAdvance(stepData?: Record<string, unknown>) {
    setLoading(true);

    // Save step data to onboarding_progress
    const steps = { ...progress.steps };
    steps[String(currentStep)] = { completed: true, data: stepData };

    const nextStep = Math.min(currentStep + 1, ONBOARDING_STEPS.length);
    const nowAllComplete = ONBOARDING_STEPS.every(
      (s) => steps[String(s.number)]?.completed
    );

    await supabase
      .from("onboarding_progress")
      .update({ steps, current_step: nextStep, completed: nowAllComplete })
      .eq("venture_id", ventureId);

    progress.steps = steps;

    if (nowAllComplete) {
      router.push("/cockpit");
    } else {
      setCurrentStep(nextStep);
    }
    setLoading(false);
  }

  async function saveVentureSettings(settings: Record<string, unknown>) {
    const current = ventureSettings;
    await supabase
      .from("ventures")
      .update({ settings: { ...current, ...settings } })
      .eq("id", ventureId);
  }

  function skip() {
    const next = Math.min(currentStep + 1, ONBOARDING_STEPS.length);
    setCurrentStep(next);
  }

  // Navigate to a specific step (re-entry for completed steps)
  function goToStep(stepNumber: number) {
    setCurrentStep(stepNumber);
  }

  // Import handlers for different step types
  function handleFilterImport(items: Array<Record<string, unknown>>) {
    const imported = items
      .map((item) => String(item.name ?? item.description ?? ""))
      .filter(Boolean);
    setFilters((prev) => [...prev.filter((f) => f.trim()), ...imported].slice(0, 5));
  }

  function handleOutcomeImport(items: Array<Record<string, unknown>>) {
    const imported = items
      .map((item) => String(item.description ?? item.metric ?? ""))
      .filter(Boolean);
    setOutcomes((prev) => [...prev.filter((o) => o.trim()), ...imported].slice(0, 3));
  }

  const step = ONBOARDING_STEPS.find((s) => s.number === currentStep);

  // Determine if the current step supports import
  const importTargetType: ImportTargetType | null =
    currentStep === 3
      ? "filters"
      : currentStep === 4
        ? "outcomes"
        : currentStep === 5
          ? "kpis"
          : currentStep === 6
            ? "bets"
            : null;

  const handleImport =
    currentStep === 3
      ? handleFilterImport
      : currentStep === 4
        ? handleOutcomeImport
        : undefined;

  // Steps that show guidance
  const showGuidance = currentStep >= 2 && currentStep <= 6;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Launch Mode</h1>
          <p className="text-sm text-subtle">{done}/{ONBOARDING_STEPS.length} steps complete</p>
          {isSecondVenture && firstVentureContext && (
            <p className="text-xs text-sage mt-1">
              Based on your first venture — suggestions are pre-loaded
            </p>
          )}
        </div>
        {allComplete && (
          <Button variant="secondary" size="sm" onClick={() => router.push("/cockpit")}>
            Back to Cockpit
          </Button>
        )}
      </div>

      {/* Progress bar — clickable for re-entry */}
      <div className="flex gap-1 mb-8">
        {ONBOARDING_STEPS.map((s) => {
          const isCompleted = progress.steps[String(s.number)]?.completed;
          const isCurrent = s.number === currentStep;

          return (
            <button
              key={s.number}
              onClick={() => goToStep(s.number)}
              title={`${s.name}${isCompleted ? " (completed)" : ""}`}
              className={`flex-1 h-2 rounded-full transition-colors relative ${
                isCompleted
                  ? "bg-semantic-green"
                  : isCurrent
                    ? "bg-accent"
                    : "bg-line"
              }`}
            >
              {isCompleted && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] text-semantic-green">
                  &#10003;
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress Milestones */}
      <LaunchMilestones steps={progress.steps} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em]">
              Step {currentStep}: {step?.name}
            </h2>
            {progress.steps[String(currentStep)]?.completed && (
              <span className="text-xs text-semantic-green font-medium px-2 py-0.5 rounded-full bg-semantic-green/10">
                Completed
              </span>
            )}
          </div>
          <p className="text-sm text-subtle mb-4">{step?.description}</p>

          {/* Step 1: Name Venture */}
          {currentStep === 1 && (
            <Input
              label="Venture Name"
              value={ventureName_}
              onChange={(e) => setVentureName(e.target.value)}
              placeholder="My Venture"
            />
          )}

          {/* Step 2: BHAG */}
          {currentStep === 2 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink">
                Big Hairy Audacious Goal
              </label>
              <textarea
                value={bhag}
                onChange={(e) => setBhag(e.target.value)}
                placeholder="What does the world look like when you succeed at the biggest scale? Think 10-25 years out."
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm min-h-[100px] focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
              />
            </div>
          )}

          {/* Step 3: Strategic Filters */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-subtle">
                Define 3-5 filters that help you say yes or no to new ideas.
              </p>
              {filters.map((f, i) => (
                <Input
                  key={i}
                  label={`Filter ${i + 1}`}
                  value={f}
                  onChange={(e) => {
                    const newFilters = [...filters];
                    newFilters[i] = e.target.value;
                    setFilters(newFilters);
                  }}
                  placeholder={`e.g., "Must serve existing audience"`}
                />
              ))}
              {filters.length < 5 && (
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => setFilters([...filters, ""])}
                >
                  + Add filter
                </Button>
              )}
            </div>
          )}

          {/* Step 4: Annual Outcomes */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-subtle">
                Define up to 3 annual outcomes. What must be true by year-end?
              </p>
              {outcomes.map((o, i) => (
                <Input
                  key={i}
                  label={`Outcome ${i + 1}`}
                  value={o}
                  onChange={(e) => {
                    const newOutcomes = [...outcomes];
                    newOutcomes[i] = e.target.value;
                    setOutcomes(newOutcomes);
                  }}
                  placeholder={`e.g., "$100K ARR"`}
                />
              ))}
            </div>
          )}

          {/* Steps 5-6: Redirect to existing pages */}
          {currentStep === 5 && (
            <div className="text-center py-4">
              <p className="text-sm text-subtle mb-4">
                Create your first KPIs to track what matters.
              </p>
              <Button onClick={() => router.push("/scoreboard/new")}>
                Create KPI
              </Button>
            </div>
          )}

          {currentStep === 6 && (
            <div className="text-center py-4">
              <p className="text-sm text-subtle mb-4">
                Choose up to 3 quarterly bets to focus your team.
              </p>
              <Button onClick={() => router.push("/bets/new")}>
                Create Bet
              </Button>
            </div>
          )}

          {/* Step 7: Invite */}
          {currentStep === 7 && (
            <div className="text-center py-4">
              <p className="text-sm text-subtle mb-4">
                Invite your team members to join.
              </p>
              <Button onClick={() => router.push("/settings")}>
                Go to Settings
              </Button>
            </div>
          )}

          {/* Step 8: First Pulse */}
          {currentStep === 8 && (
            <div className="text-center py-4">
              <p className="text-sm text-subtle mb-4">
                Submit your first daily pulse to build the habit.
              </p>
              <Button onClick={() => router.push("/pulse")}>
                Go to Pulse
              </Button>
            </div>
          )}

          {/* Step 9: Weekly Sync */}
          {currentStep === 9 && (
            <div className="space-y-3">
              <p className="text-sm text-subtle">
                Schedule your weekly sync meeting.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-ink">Day</label>
                  <select
                    value={syncDay}
                    onChange={(e) => setSyncDay(e.target.value)}
                    className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  >
                    {["monday", "tuesday", "wednesday", "thursday", "friday"].map((d) => (
                      <option key={d} value={d}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Time"
                  type="time"
                  value={syncTime}
                  onChange={(e) => setSyncTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 10: Monthly Review */}
          {currentStep === 10 && (
            <div className="text-center py-4">
              <p className="text-sm text-subtle mb-4">
                Your monthly operating review will be auto-generated from your data.
                Complete this step to finish Launch Mode.
              </p>
            </div>
          )}

          {/* AI Import Panel — shown on steps 3, 4, 5, 6 */}
          {importTargetType && handleImport && (
            <ImportPanel targetType={importTargetType} onImport={handleImport} />
          )}

          {/* For steps 5 & 6, show import without direct onImport (items go to KPI/Bet pages) */}
          {importTargetType && !handleImport && (currentStep === 5 || currentStep === 6) && (
            <ImportPanel
              targetType={importTargetType}
              onImport={(items) => {
                // Show parsed items as guidance — user will create via the respective pages
                const desc = items
                  .map((item) =>
                    Object.values(item)
                      .filter(Boolean)
                      .map(String)
                      .join(" - ")
                  )
                  .join("\n");
                if (desc) {
                  alert(`Parsed ${items.length} item(s). Use these as reference when creating:\n\n${desc}`);
                }
              }}
            />
          )}

          {/* AI Guidance Panel */}
          {showGuidance && (
            <GuidancePanel
              step={currentStep}
              context={buildContext()}
              onSuggestion={(text) => {
                // Auto-fill based on current step
                if (currentStep === 2) {
                  setBhag(text);
                } else if (currentStep === 3) {
                  const emptyIndex = filters.findIndex((f) => !f.trim());
                  if (emptyIndex >= 0) {
                    const newFilters = [...filters];
                    newFilters[emptyIndex] = text;
                    setFilters(newFilters);
                  } else if (filters.length < 5) {
                    setFilters([...filters, text]);
                  }
                } else if (currentStep === 4) {
                  const emptyIndex = outcomes.findIndex((o) => !o.trim());
                  if (emptyIndex >= 0) {
                    const newOutcomes = [...outcomes];
                    newOutcomes[emptyIndex] = text;
                    setOutcomes(newOutcomes);
                  }
                }
              }}
            />
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="tertiary" size="sm" onClick={skip}>
            Skip for now
          </Button>
          <Button
            disabled={loading}
            onClick={async () => {
              // Save venture-level settings for relevant steps
              if (currentStep === 1) {
                await supabase
                  .from("ventures")
                  .update({ name: ventureName_ })
                  .eq("id", ventureId);
              }
              if (currentStep === 2) {
                await saveVentureSettings({ bhag });
              }
              if (currentStep === 3) {
                await saveVentureSettings({
                  strategic_filters: filters.filter((f) => f.trim()),
                });
              }
              if (currentStep === 4) {
                await saveVentureSettings({
                  annual_outcomes: outcomes.filter((o) => o.trim()),
                });
              }
              if (currentStep === 9) {
                await saveVentureSettings({
                  weekly_sync_day: syncDay,
                  weekly_sync_time: syncTime,
                });
              }
              await saveAndAdvance();
            }}
          >
            {loading
              ? "Saving..."
              : currentStep === ONBOARDING_STEPS.length
                ? "Complete Launch Mode"
                : progress.steps[String(currentStep)]?.completed
                  ? "Update & Continue"
                  : "Next"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
