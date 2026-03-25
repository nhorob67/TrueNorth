"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";

interface StrategicFilter {
  id: string;
  name: string;
  description: string;
}

interface AnnualOutcome {
  id: string;
  description: string;
  constraints: {
    team_size?: string;
    budget_cap?: string;
    timeline?: string;
    complexity?: string;
  };
}

interface Vision {
  id: string;
  venture_id: string;
  organization_id: string;
  bhag: string;
  strategic_filters: StrategicFilter[];
  annual_outcomes: AnnualOutcome[];
  not_doing_list: string[];
  year: number;
  locked: boolean;
}

interface Snapshot {
  id: string;
  created_at: string;
  created_by: string;
}

function generateId() {
  return crypto.randomUUID();
}

// ============================================================
// BHAG Section
// ============================================================

function BhagSection({
  bhag,
  editing,
  onChange,
}: {
  bhag: string;
  editing: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <h2 className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-accent mb-2">
        Big Hairy Audacious Goal
      </h2>
      <Card>
        <CardContent>
          {editing ? (
            <textarea
              value={bhag}
              onChange={(e) => onChange(e.target.value)}
              className="w-full min-h-[80px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
              placeholder="What is the bold, long-term vision for this venture?"
            />
          ) : (
            <p className="text-lg font-medium text-ink leading-relaxed">
              {bhag || "No BHAG defined yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Strategic Filters
// ============================================================

function StrategicFiltersSection({
  filters,
  editing,
  onChange,
}: {
  filters: StrategicFilter[];
  editing: boolean;
  onChange: (filters: StrategicFilter[]) => void;
}) {
  function addFilter() {
    onChange([
      ...filters,
      { id: generateId(), name: "", description: "" },
    ]);
  }

  function updateFilter(id: string, field: "name" | "description", value: string) {
    onChange(
      filters.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  }

  function removeFilter(id: string) {
    onChange(filters.filter((f) => f.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-accent">
          Strategic Filters
        </h2>
        {editing && (
          <Button variant="tertiary" size="sm" onClick={addFilter}>
            + Add Filter
          </Button>
        )}
      </div>
      <Card>
        <CardContent>
          {filters.length === 0 && !editing && (
            <p className="text-sm text-subtle">
              No strategic filters defined. These are used to evaluate new ideas.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {filters.map((filter) => (
              <div
                key={filter.id}
                className={editing ? "p-4 rounded-lg border border-line bg-canvas" : "py-[18px] px-5 rounded-lg border border-line bg-surface"}
              >
                {editing ? (
                  <div className="space-y-2">
                    <Input
                      value={filter.name}
                      onChange={(e) =>
                        updateFilter(filter.id, "name", e.target.value)
                      }
                      placeholder="Filter name"
                    />
                    <textarea
                      value={filter.description}
                      onChange={(e) =>
                        updateFilter(filter.id, "description", e.target.value)
                      }
                      placeholder="What does this filter evaluate?"
                      className="w-full min-h-[60px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
                    />
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => removeFilter(filter.id)}
                      className="text-semantic-brick"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-[14px] font-semibold text-ink mb-1.5">
                      {filter.name}
                    </h3>
                    <p className="text-[13px] text-subtle leading-relaxed">
                      {filter.description}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Annual Outcomes
// ============================================================

function AnnualOutcomesSection({
  outcomes,
  editing,
  onChange,
}: {
  outcomes: AnnualOutcome[];
  editing: boolean;
  onChange: (outcomes: AnnualOutcome[]) => void;
}) {
  function addOutcome() {
    if (outcomes.length >= 3) return;
    onChange([
      ...outcomes,
      { id: generateId(), description: "", constraints: {} },
    ]);
  }

  function updateOutcome(id: string, description: string) {
    onChange(
      outcomes.map((o) => (o.id === id ? { ...o, description } : o))
    );
  }

  function updateConstraint(
    id: string,
    key: keyof AnnualOutcome["constraints"],
    value: string
  ) {
    onChange(
      outcomes.map((o) =>
        o.id === id
          ? { ...o, constraints: { ...o.constraints, [key]: value } }
          : o
      )
    );
  }

  function removeOutcome(id: string) {
    onChange(outcomes.filter((o) => o.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-accent">
          Annual Outcomes ({outcomes.length}/3)
        </h2>
        {editing && outcomes.length < 3 && (
          <Button variant="tertiary" size="sm" onClick={addOutcome}>
            + Add Outcome
          </Button>
        )}
      </div>
      <Card>
        <CardContent>
        {outcomes.length === 0 && !editing && (
          <p className="text-sm text-subtle">
            No annual outcomes defined yet.
          </p>
        )}
        <div className="space-y-4">
          {outcomes.map((outcome, idx) => (
            <div
              key={outcome.id}
              className="p-4 rounded-lg border border-line bg-canvas"
            >
              {editing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-subtle uppercase">
                      Outcome {idx + 1}
                    </span>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => removeOutcome(outcome.id)}
                      className="text-semantic-brick ml-auto"
                    >
                      Remove
                    </Button>
                  </div>
                  <textarea
                    value={outcome.description}
                    onChange={(e) =>
                      updateOutcome(outcome.id, e.target.value)
                    }
                    placeholder="Describe this annual outcome..."
                    className="w-full min-h-[60px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={outcome.constraints.team_size ?? ""}
                      onChange={(e) =>
                        updateConstraint(outcome.id, "team_size", e.target.value)
                      }
                      placeholder="Team size"
                      label="Team Size"
                    />
                    <Input
                      value={outcome.constraints.budget_cap ?? ""}
                      onChange={(e) =>
                        updateConstraint(outcome.id, "budget_cap", e.target.value)
                      }
                      placeholder="Budget cap"
                      label="Budget Cap"
                    />
                    <Input
                      value={outcome.constraints.timeline ?? ""}
                      onChange={(e) =>
                        updateConstraint(outcome.id, "timeline", e.target.value)
                      }
                      placeholder="Timeline"
                      label="Timeline"
                    />
                    <Input
                      value={outcome.constraints.complexity ?? ""}
                      onChange={(e) =>
                        updateConstraint(outcome.id, "complexity", e.target.value)
                      }
                      placeholder="Complexity"
                      label="Complexity"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-faded mb-1">
                    Outcome {idx + 1}
                  </p>
                  <p className="text-sm font-medium text-ink">
                    {outcome.description}
                  </p>
                  {Object.entries(outcome.constraints).some(([, v]) => v) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {outcome.constraints.team_size && (
                        <span className="font-mono text-[10px] font-medium tracking-[0.03em] px-2 py-[3px] rounded bg-accent-dim text-accent">
                          Team: {outcome.constraints.team_size}
                        </span>
                      )}
                      {outcome.constraints.budget_cap && (
                        <span className="font-mono text-[10px] font-medium tracking-[0.03em] px-2 py-[3px] rounded bg-accent-dim text-accent">
                          Budget: {outcome.constraints.budget_cap}
                        </span>
                      )}
                      {outcome.constraints.timeline && (
                        <span className="font-mono text-[10px] font-medium tracking-[0.03em] px-2 py-[3px] rounded bg-accent-dim text-accent">
                          Timeline: {outcome.constraints.timeline}
                        </span>
                      )}
                      {outcome.constraints.complexity && (
                        <span className="font-mono text-[10px] font-medium tracking-[0.03em] px-2 py-[3px] rounded bg-accent-dim text-accent">
                          Complexity: {outcome.constraints.complexity}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Not Doing List
// ============================================================

function NotDoingSection({
  items,
  editing,
  onChange,
}: {
  items: string[];
  editing: boolean;
  onChange: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState("");

  function addItem() {
    if (!newItem.trim()) return;
    onChange([...items, newItem.trim()]);
    setNewItem("");
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <h2 className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-accent mb-2">
        Not Doing List
      </h2>
      <p className="text-[13px] text-faded mb-3">
        Sacred commitments to what this venture will NOT pursue.
      </p>
      <Card>
        <CardContent>
          {items.length === 0 && !editing && (
            <p className="text-sm text-subtle">
              No items on the Not Doing list yet.
            </p>
          )}
          <ul className="space-y-0">
            {items.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-0"
              >
                <span className="text-faded text-[14px] leading-none">
                  &times;
                </span>
                <span className="text-[14px] text-subtle leading-relaxed flex-1">{item}</span>
                {editing && (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => removeItem(idx)}
                    className="text-semantic-brick"
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {editing && (
            <div className="flex gap-2 mt-3">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="We will NOT..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={addItem}
                disabled={!newItem.trim()}
              >
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Version History
// ============================================================

function VersionHistory({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) return null;

  return (
    <div className="border-t border-line pt-5">
      <h2 className="font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-faded mb-3">
        Version History
      </h2>
      <div className="space-y-1">
        {snapshots.map((snap) => (
          <div
            key={snap.id}
            className="flex items-center gap-3 py-1.5 text-xs text-faded"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-faded/50" />
            <span>
              {new Date(snap.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Vision Board View
// ============================================================

export function VisionBoardView({
  vision,
  snapshots,
}: {
  vision: Vision | null;
  snapshots: Snapshot[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();
  const isAdmin = userCtx.orgRole === "admin";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [bhag, setBhag] = useState(vision?.bhag ?? "");
  const [filters, setFilters] = useState<StrategicFilter[]>(
    vision?.strategic_filters ?? []
  );
  const [outcomes, setOutcomes] = useState<AnnualOutcome[]>(
    vision?.annual_outcomes ?? []
  );
  const [notDoing, setNotDoing] = useState<string[]>(
    vision?.not_doing_list ?? []
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload = {
      bhag,
      strategic_filters: filters,
      annual_outcomes: outcomes,
      not_doing_list: notDoing,
      year: new Date().getFullYear(),
      organization_id: userCtx.orgId,
      venture_id: userCtx.ventureId,
    };

    if (vision) {
      // Create snapshot before updating
      const { error: snapErr } = await supabase.from("vision_snapshots").insert({
        vision_id: vision.id,
        snapshot: vision,
        created_by: userCtx.userId,
      });
      if (snapErr) {
        setError(`Failed to save snapshot: ${snapErr.message}`);
        setSaving(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from("visions")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", vision.id);
      if (updateErr) {
        setError(`Failed to update vision: ${updateErr.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertErr } = await supabase.from("visions").insert(payload);
      if (insertErr) {
        setError(`Failed to create vision: ${insertErr.message}`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleUnlock() {
    if (!vision) return;
    await supabase
      .from("visions")
      .update({ locked: false })
      .eq("id", vision.id);
    router.refresh();
  }

  if (!vision && !editing) {
    return (
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Vision Board</h1>
        <EmptyState
          title="No vision defined"
          description="Define your BHAG, strategic filters, and annual outcomes to anchor your operating system."
          action={
            isAdmin ? (
              <Button onClick={() => setEditing(true)}>
                Create Vision Board
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const isLocked = vision?.locked && !editing;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Vision Board</h1>
          {vision && (
            <p className="text-sm text-subtle mt-0.5">
              {vision.year}
              {vision.locked && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">
                  Locked
                </span>
              )}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setBhag(vision?.bhag ?? "");
                    setFilters(vision?.strategic_filters ?? []);
                    setOutcomes(vision?.annual_outcomes ?? []);
                    setNotDoing(vision?.not_doing_list ?? []);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Vision"}
                </Button>
              </>
            ) : isLocked ? (
              <Button variant="secondary" size="sm" onClick={handleUnlock}>
                Unlock for Editing
              </Button>
            ) : (
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => setEditing(true)}
                className="border border-accent !rounded-[7px] hover:!bg-accent hover:!text-white"
              >
                Edit Vision
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-semantic-brick/30 bg-semantic-brick/10 px-4 py-3 text-sm text-semantic-brick">
          {error}
        </div>
      )}

      <div>
        <div className="mt-9">
          <BhagSection bhag={bhag} editing={editing} onChange={setBhag} />
        </div>
        <div className="mt-8">
          <StrategicFiltersSection
            filters={filters}
            editing={editing}
            onChange={setFilters}
          />
        </div>
        <div className="mt-11">
          <AnnualOutcomesSection
            outcomes={outcomes}
            editing={editing}
            onChange={setOutcomes}
          />
        </div>
        <div className="mt-11">
          <NotDoingSection
            items={notDoing}
            editing={editing}
            onChange={setNotDoing}
          />
        </div>
        <div className="mt-[52px]">
          <VersionHistory snapshots={snapshots} />
        </div>
      </div>
    </div>
  );
}
