"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";

// ============================================================
// Types
// ============================================================

type IdeaClassification = "more" | "better" | "new";

type IdeaLifecycleStatus =
  | "quarantine"
  | "filter_review"
  | "scoring"
  | "candidate"
  | "archived"
  | "selected";

interface IdeaFilterResult {
  filter_id: string;
  filter_name: string;
  passed: boolean;
  reasoning: string;
  ai_generated: boolean;
}

interface Idea {
  id: string;
  venture_id: string;
  organization_id: string;
  name: string;
  description: string;
  classification: IdeaClassification | null;
  submitter_id: string;
  submitted_at: string;
  cooling_expires_at: string;
  lifecycle_status: IdeaLifecycleStatus;
  filter_results: IdeaFilterResult[];
  score_alignment: number | null;
  score_revenue: number | null;
  score_effort: number | null;
  score_total: number | null;
}

interface StrategicFilter {
  id: string;
  name: string;
  description: string;
}

// ============================================================
// Quarantine Timer
// ============================================================

function CoolingTimer({ expiresAt }: { expiresAt: string }) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const totalMs = 14 * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, expires.getTime() - now.getTime());
  const elapsedPct = Math.min(100, ((totalMs - remainingMs) / totalMs) * 100);
  const daysLeft = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  const isThawed = remainingMs <= 0;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-warm-gray mb-1">
        <span>{isThawed ? "Thawed" : `${daysLeft}d remaining`}</span>
        <span>{Math.round(elapsedPct)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-warm-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isThawed ? "bg-semantic-green" : "bg-moss/50"
          }`}
          style={{ width: `${elapsedPct}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Classification Badge
// ============================================================

const classificationColors: Record<IdeaClassification, string> = {
  more: "bg-semantic-green/10 text-semantic-green-text",
  better: "bg-semantic-ochre/10 text-semantic-ochre-text",
  new: "bg-moss/10 text-moss",
};

function ClassificationBadge({
  classification,
}: {
  classification: IdeaClassification;
}) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-medium ${classificationColors[classification]}`}
    >
      {classification.charAt(0).toUpperCase() + classification.slice(1)}
    </span>
  );
}

// ============================================================
// Idea Card
// ============================================================

function IdeaCard({
  idea,
  onSelect,
}: {
  idea: Idea;
  onSelect: (idea: Idea) => void;
}) {
  const isQuarantine = idea.lifecycle_status === "quarantine";
  const isFrozen =
    isQuarantine && new Date(idea.cooling_expires_at) > new Date();

  return (
    <button
      type="button"
      onClick={() => onSelect(idea)}
      className="w-full text-left"
    >
      <Card
        className={`transition-all hover:shadow-md ${
          isFrozen ? "opacity-60" : ""
        }`}
      >
        <CardContent className="py-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-charcoal leading-tight">
              {idea.name}
            </h3>
            {idea.classification && (
              <ClassificationBadge classification={idea.classification} />
            )}
          </div>
          <p className="text-xs text-warm-gray mt-1 line-clamp-2">
            {idea.description}
          </p>
          {isQuarantine && <CoolingTimer expiresAt={idea.cooling_expires_at} />}
          {idea.score_total !== null && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-xs font-mono font-medium text-charcoal">
                Score: {idea.score_total.toFixed(1)}
              </span>
            </div>
          )}
          <p className="text-xs text-warm-gray mt-1.5">
            {new Date(idea.submitted_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

// ============================================================
// Add Idea Form
// ============================================================

function AddIdeaForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const now = new Date();
    const coolingExpires = new Date(
      now.getTime() + 14 * 24 * 60 * 60 * 1000
    );

    const { error: insertError } = await supabase.from("ideas").insert({
      organization_id: userCtx.orgId,
      venture_id: userCtx.ventureId,
      name: name.trim(),
      description: description.trim(),
      submitter_id: userCtx.userId,
      submitted_at: now.toISOString(),
      cooling_expires_at: coolingExpires.toISOString(),
      lifecycle_status: "quarantine",
      filter_results: [],
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      setLoading(false);
      onClose();
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Submit New Idea</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Idea name (one sentence)"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description..."
            className="w-full min-h-[60px] rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20"
          />
          {error && <p className="text-xs text-semantic-brick">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading || !name.trim()}>
              {loading ? "Submitting..." : "Submit to Vault"}
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

// ============================================================
// Idea Detail Panel
// ============================================================

function IdeaDetailPanel({
  idea,
  strategicFilters,
  onClose,
}: {
  idea: Idea;
  strategicFilters: StrategicFilter[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [classification, setClassification] = useState<IdeaClassification | null>(
    idea.classification
  );
  const [filterResults, setFilterResults] = useState<IdeaFilterResult[]>(
    idea.filter_results ?? []
  );
  const [scoreAlignment, setScoreAlignment] = useState(
    idea.score_alignment?.toString() ?? ""
  );
  const [scoreRevenue, setScoreRevenue] = useState(
    idea.score_revenue?.toString() ?? ""
  );
  const [scoreEffort, setScoreEffort] = useState(
    idea.score_effort?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<
    "high" | "medium" | "low" | null
  >(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSourceInputs, setAiSourceInputs] = useState<string[] | null>(null);

  const coolingDone = new Date(idea.cooling_expires_at) <= new Date();
  const allFiltersPassed =
    filterResults.length > 0 &&
    filterResults.length === strategicFilters.length &&
    filterResults.every((r) => r.passed);

  // Calculate weighted score
  const alignment = parseFloat(scoreAlignment) || 0;
  const revenue = parseFloat(scoreRevenue) || 0;
  const effort = parseFloat(scoreEffort) || 0;
  const totalScore = alignment * 0.4 + revenue * 0.35 + effort * 0.25;

  function toggleFilterResult(filter: StrategicFilter) {
    const existing = filterResults.find((r) => r.filter_id === filter.id);
    if (existing) {
      setFilterResults(
        filterResults.map((r) =>
          r.filter_id === filter.id ? { ...r, passed: !r.passed } : r
        )
      );
    } else {
      setFilterResults([
        ...filterResults,
        {
          filter_id: filter.id,
          filter_name: filter.name,
          passed: true,
          reasoning: "",
          ai_generated: false,
        },
      ]);
    }
  }

  async function handleSave() {
    setSaving(true);

    const updates: Record<string, unknown> = {
      classification,
      filter_results: filterResults,
      updated_at: new Date().toISOString(),
    };

    if (scoreAlignment) updates.score_alignment = parseFloat(scoreAlignment);
    if (scoreRevenue) updates.score_revenue = parseFloat(scoreRevenue);
    if (scoreEffort) updates.score_effort = parseFloat(scoreEffort);
    if (scoreAlignment && scoreRevenue && scoreEffort) {
      updates.score_total = totalScore;
    }

    await supabase.from("ideas").update(updates).eq("id", idea.id);
    setSaving(false);
    router.refresh();
  }

  async function advanceStage() {
    const statusProgression: Record<IdeaLifecycleStatus, IdeaLifecycleStatus> = {
      quarantine: "filter_review",
      filter_review: "scoring",
      scoring: "candidate",
      candidate: "selected",
      archived: "quarantine",
      selected: "selected",
    };

    const nextStatus = statusProgression[idea.lifecycle_status];

    // Validate transitions
    if (idea.lifecycle_status === "quarantine" && !coolingDone) return;
    if (idea.lifecycle_status === "filter_review" && !allFiltersPassed) return;
    if (idea.lifecycle_status === "scoring" && !classification) return;

    await supabase
      .from("ideas")
      .update({
        lifecycle_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", idea.id);
    router.refresh();
  }

  async function runAiEvaluation() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/filter-guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: idea.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setFilterResults(data.results);
        setAiConfidence(data.confidence);
        setAiSummary(data.summary);
        setAiSourceInputs(data.sourceInputs);
      }
    } catch (err) {
      console.error("AI evaluation failed:", err);
    } finally {
      setAiLoading(false);
    }
  }

  async function archiveIdea() {
    await supabase
      .from("ideas")
      .update({
        lifecycle_status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", idea.id);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-ivory border-l border-warm-border shadow-xl z-50 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-charcoal">{idea.name}</h2>
            <p className="text-xs text-warm-gray mt-0.5">
              Submitted{" "}
              {new Date(idea.submitted_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-warm-gray hover:text-charcoal text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-charcoal mb-4">{idea.description}</p>

        {/* Stage indicator */}
        <div className="flex gap-1 mb-6">
          {(
            [
              "quarantine",
              "filter_review",
              "scoring",
              "candidate",
            ] as IdeaLifecycleStatus[]
          ).map((stage) => {
            const stages: IdeaLifecycleStatus[] = [
              "quarantine",
              "filter_review",
              "scoring",
              "candidate",
            ];
            const currentIdx = stages.indexOf(idea.lifecycle_status);
            const stageIdx = stages.indexOf(stage);
            const isActive = stageIdx === currentIdx;
            const isDone = stageIdx < currentIdx;

            return (
              <div
                key={stage}
                className={`flex-1 h-1.5 rounded-full ${
                  isActive
                    ? "bg-moss"
                    : isDone
                      ? "bg-semantic-green"
                      : "bg-warm-border"
                }`}
              />
            );
          })}
        </div>

        {/* Quarantine section */}
        {idea.lifecycle_status === "quarantine" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="py-3">
                <h3 className="text-sm font-semibold mb-2">
                  Cooling Period
                </h3>
                <CoolingTimer expiresAt={idea.cooling_expires_at} />
                {coolingDone && (
                  <p className="text-xs text-semantic-green-text mt-2 font-medium">
                    Cooling period complete. Ready for filter review.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter Review section */}
        {(idea.lifecycle_status === "filter_review" ||
          idea.lifecycle_status === "scoring" ||
          idea.lifecycle_status === "candidate") && (
          <div className="space-y-4">
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">
                    Strategic Filter Review
                  </h3>
                  {idea.lifecycle_status === "filter_review" &&
                    strategicFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={runAiEvaluation}
                        disabled={aiLoading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sage/10 text-sage border border-sage/30 hover:bg-sage/20 transition-colors disabled:opacity-50"
                      >
                        <span
                          className={`w-2 h-2 rounded-full bg-sage ${aiLoading ? "animate-pulse" : ""}`}
                        />
                        {aiLoading ? "Evaluating..." : "Evaluate with AI"}
                      </button>
                    )}
                </div>
                {aiConfidence && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sage/10 text-sage">
                      {aiConfidence.charAt(0).toUpperCase() +
                        aiConfidence.slice(1)}{" "}
                      confidence
                    </span>
                    {aiSummary && (
                      <span className="text-xs text-warm-gray truncate">
                        {aiSummary}
                      </span>
                    )}
                  </div>
                )}
                {strategicFilters.length === 0 ? (
                  <p className="text-xs text-warm-gray">
                    No strategic filters defined. Add filters on the Vision
                    Board first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {strategicFilters.map((filter) => {
                      const result = filterResults.find(
                        (r) => r.filter_id === filter.id
                      );
                      const passed = result?.passed ?? false;
                      const isReviewed = !!result;
                      const isAi = result?.ai_generated === true;
                      const canEdit =
                        idea.lifecycle_status === "filter_review";

                      return (
                        <div key={filter.id}>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() =>
                              canEdit && toggleFilterResult(filter)
                            }
                            className={`w-full text-left flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                              isReviewed && passed
                                ? "border-semantic-green/30 bg-semantic-green/5"
                                : isReviewed && !passed
                                  ? "border-semantic-brick/30 bg-semantic-brick/5"
                                  : "border-warm-border"
                            } ${canEdit ? "hover:bg-parchment cursor-pointer" : "cursor-default"}`}
                          >
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                isReviewed && passed
                                  ? "bg-semantic-green text-white"
                                  : isReviewed && !passed
                                    ? "bg-semantic-brick text-white"
                                    : "bg-warm-border text-warm-gray"
                              }`}
                            >
                              {isReviewed && passed
                                ? "\u2713"
                                : isReviewed && !passed
                                  ? "\u2717"
                                  : "?"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-charcoal">
                                  {filter.name}
                                </p>
                                {isAi && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sage/15 text-sage leading-none">
                                    AI
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-warm-gray truncate">
                                {filter.description}
                              </p>
                            </div>
                          </button>
                          {isAi && result.reasoning && (
                            <p className="text-xs italic text-warm-gray mt-1 ml-8 leading-relaxed">
                              {result.reasoning}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {aiSourceInputs && aiSourceInputs.length > 0 && (
                  <p className="text-xs text-warm-gray mt-3">
                    Based on: {aiSourceInputs.join(" + ")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Classification */}
        {(idea.lifecycle_status === "scoring" ||
          idea.lifecycle_status === "candidate") && (
          <Card className="mt-4">
            <CardContent className="py-3">
              <h3 className="text-sm font-semibold mb-2">Classification</h3>
              <div className="flex gap-2">
                {(["more", "better", "new"] as IdeaClassification[]).map(
                  (cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() =>
                        idea.lifecycle_status === "scoring" &&
                        setClassification(cls)
                      }
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        classification === cls
                          ? "border-moss bg-moss/10 text-moss"
                          : "border-warm-border text-warm-gray hover:border-moss/30"
                      }`}
                    >
                      {cls.charAt(0).toUpperCase() + cls.slice(1)}
                    </button>
                  )
                )}
              </div>
              <p className="text-xs text-warm-gray mt-2">
                {classification === "more"
                  ? "Doing more of what already works (scaling)."
                  : classification === "better"
                    ? "Improving an existing system (optimization)."
                    : classification === "new"
                      ? "Building something that doesn't exist yet (innovation)."
                      : "Select a classification before scoring."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Scoring */}
        {idea.lifecycle_status === "scoring" && classification && (
          <Card className="mt-4">
            <CardContent className="py-3">
              <h3 className="text-sm font-semibold mb-2">Scoring</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-warm-gray">
                    Alignment (40%) — 1-10
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={scoreAlignment}
                    onChange={(e) => setScoreAlignment(e.target.value)}
                    placeholder="1-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-warm-gray">
                    Revenue Potential (35%) — 1-10
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={scoreRevenue}
                    onChange={(e) => setScoreRevenue(e.target.value)}
                    placeholder="1-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-warm-gray">
                    Effort (25%) — 1-10
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={scoreEffort}
                    onChange={(e) => setScoreEffort(e.target.value)}
                    placeholder="1-10"
                  />
                </div>
                {scoreAlignment && scoreRevenue && scoreEffort && (
                  <div className="pt-2 border-t border-warm-border">
                    <p className="text-sm font-medium">
                      Weighted Score:{" "}
                      <span className="font-mono text-lg text-charcoal">
                        {totalScore.toFixed(1)}
                      </span>
                      <span className="text-warm-gray"> / 10</span>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Score display for candidates */}
        {idea.lifecycle_status === "candidate" && idea.score_total !== null && (
          <Card className="mt-4">
            <CardContent className="py-3">
              <h3 className="text-sm font-semibold mb-1">Score</h3>
              <p className="text-2xl font-mono font-bold text-charcoal">
                {idea.score_total.toFixed(1)}
                <span className="text-sm text-warm-gray font-normal">
                  {" "}
                  / 10
                </span>
              </p>
              <div className="flex gap-3 mt-1 text-xs text-warm-gray">
                <span>Alignment: {idea.score_alignment}</span>
                <span>Revenue: {idea.score_revenue}</span>
                <span>Effort: {idea.score_effort}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          {idea.lifecycle_status !== "archived" &&
            idea.lifecycle_status !== "selected" && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            )}

          {idea.lifecycle_status === "quarantine" && coolingDone && (
            <Button size="sm" variant="secondary" onClick={advanceStage}>
              Begin Filter Review
            </Button>
          )}

          {idea.lifecycle_status === "filter_review" && allFiltersPassed && (
            <Button size="sm" variant="secondary" onClick={advanceStage}>
              Advance to Scoring
            </Button>
          )}

          {idea.lifecycle_status === "scoring" &&
            classification &&
            scoreAlignment &&
            scoreRevenue &&
            scoreEffort && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await handleSave();
                  advanceStage();
                }}
              >
                Promote to Candidate
              </Button>
            )}

          {idea.lifecycle_status !== "archived" &&
            idea.lifecycle_status !== "selected" && (
              <Button size="sm" variant="tertiary" onClick={archiveIdea}>
                Archive
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Kanban Column
// ============================================================

const stageLabels: Record<IdeaLifecycleStatus, string> = {
  quarantine: "Quarantine",
  filter_review: "Filter Review",
  scoring: "Scoring",
  candidate: "Candidate",
  archived: "Archived",
  selected: "Selected",
};

const stageDescriptions: Record<string, string> = {
  quarantine: "14-day cooling period",
  filter_review: "Evaluated against strategic filters",
  scoring: "Classified and scored",
  candidate: "Ready for quarterly selection",
};

function KanbanColumn({
  stage,
  ideas,
  onSelect,
}: {
  stage: IdeaLifecycleStatus;
  ideas: Idea[];
  onSelect: (idea: Idea) => void;
}) {
  return (
    <div className="flex-1 min-w-[240px]">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-charcoal">
            {stageLabels[stage]}
          </h3>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-warm-gray/10 text-warm-gray">
            {ideas.length}
          </span>
        </div>
        {stageDescriptions[stage] && (
          <p className="text-xs text-warm-gray mt-0.5">
            {stageDescriptions[stage]}
          </p>
        )}
      </div>
      <div className="space-y-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function IdeaVaultView({
  ideas,
  strategicFilters,
}: {
  ideas: Idea[];
  strategicFilters: StrategicFilter[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const stages: IdeaLifecycleStatus[] = [
    "quarantine",
    "filter_review",
    "scoring",
    "candidate",
  ];

  const archivedIdeas = ideas.filter(
    (i) => i.lifecycle_status === "archived" || i.lifecycle_status === "selected"
  );

  if (ideas.length === 0 && !showAdd) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Idea Vault</h1>
        <EmptyState
          title="The Vault is empty"
          description="Submit your first idea. It will enter a 14-day quarantine before evaluation."
          action={<Button onClick={() => setShowAdd(true)}>Submit Idea</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Idea Vault</h1>
          <p className="text-sm text-warm-gray mt-0.5">
            Anti-distraction engine — ideas must survive quarantine and filters
            before becoming candidates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "Hide" : "Show"} Archived ({archivedIdeas.length})
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            Submit Idea
          </Button>
        </div>
      </div>

      {showAdd && <AddIdeaForm onClose={() => setShowAdd(false)} />}

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-4 mt-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            ideas={ideas.filter((i) => i.lifecycle_status === stage)}
            onSelect={setSelectedIdea}
          />
        ))}
      </div>

      {/* Archived section */}
      {showArchived && archivedIdeas.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wider mb-3">
            Archived & Selected
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {archivedIdeas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} onSelect={setSelectedIdea} />
            ))}
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedIdea && (
        <>
          <div
            className="fixed inset-0 bg-charcoal/20 z-40"
            onClick={() => setSelectedIdea(null)}
          />
          <IdeaDetailPanel
            idea={selectedIdea}
            strategicFilters={strategicFilters}
            onClose={() => setSelectedIdea(null)}
          />
        </>
      )}
    </div>
  );
}
