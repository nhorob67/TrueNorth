"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="bg-moss/5">
        <h2 className="text-lg font-semibold text-moss">
          Big Hairy Audacious Goal
        </h2>
      </CardHeader>
      <CardContent>
        {editing ? (
          <textarea
            value={bhag}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-h-[80px] rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20"
            placeholder="What is the bold, long-term vision for this venture?"
          />
        ) : (
          <p className="text-lg font-medium text-charcoal leading-relaxed">
            {bhag || "No BHAG defined yet."}
          </p>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="bg-moss/5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-moss">Strategic Filters</h2>
          {editing && (
            <Button variant="tertiary" size="sm" onClick={addFilter}>
              + Add Filter
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filters.length === 0 && !editing && (
          <p className="text-sm text-warm-gray">
            No strategic filters defined. These are used to evaluate new ideas.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className="p-4 rounded-lg border border-warm-border bg-parchment"
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
                    className="w-full min-h-[60px] rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20"
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
                  <h3 className="text-sm font-semibold text-charcoal">
                    {filter.name}
                  </h3>
                  <p className="text-sm text-warm-gray mt-1">
                    {filter.description}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="bg-moss/5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-moss">
            Annual Outcomes ({outcomes.length}/3)
          </h2>
          {editing && outcomes.length < 3 && (
            <Button variant="tertiary" size="sm" onClick={addOutcome}>
              + Add Outcome
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {outcomes.length === 0 && !editing && (
          <p className="text-sm text-warm-gray">
            No annual outcomes defined yet.
          </p>
        )}
        <div className="space-y-4">
          {outcomes.map((outcome, idx) => (
            <div
              key={outcome.id}
              className="p-4 rounded-lg border border-warm-border bg-parchment"
            >
              {editing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-warm-gray uppercase">
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
                    className="w-full min-h-[60px] rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20"
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
                  <p className="text-xs font-semibold text-warm-gray uppercase mb-1">
                    Outcome {idx + 1}
                  </p>
                  <p className="text-sm font-medium text-charcoal">
                    {outcome.description}
                  </p>
                  {Object.entries(outcome.constraints).some(([, v]) => v) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {outcome.constraints.team_size && (
                        <span className="text-xs px-2 py-0.5 rounded bg-moss/10 text-moss">
                          Team: {outcome.constraints.team_size}
                        </span>
                      )}
                      {outcome.constraints.budget_cap && (
                        <span className="text-xs px-2 py-0.5 rounded bg-moss/10 text-moss">
                          Budget: {outcome.constraints.budget_cap}
                        </span>
                      )}
                      {outcome.constraints.timeline && (
                        <span className="text-xs px-2 py-0.5 rounded bg-moss/10 text-moss">
                          Timeline: {outcome.constraints.timeline}
                        </span>
                      )}
                      {outcome.constraints.complexity && (
                        <span className="text-xs px-2 py-0.5 rounded bg-moss/10 text-moss">
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
    <Card>
      <CardHeader className="bg-brass/10 border-b border-brass/20">
        <h2 className="text-lg font-semibold text-brass-text">
          Not Doing List
        </h2>
        <p className="text-xs text-warm-gray mt-0.5">
          Sacred commitments to what this venture will NOT pursue.
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 && !editing && (
          <p className="text-sm text-warm-gray">
            No items on the Not Doing list yet.
          </p>
        )}
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-center gap-3 py-2 border-b border-warm-border last:border-0"
            >
              <span className="text-semantic-brick font-bold text-lg leading-none">
                &times;
              </span>
              <span className="text-sm text-charcoal flex-1">{item}</span>
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
  );
}

// ============================================================
// Version History
// ============================================================

function VersionHistory({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-warm-gray uppercase">
          Version History
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="flex items-center gap-3 py-1.5 text-xs text-warm-gray"
            >
              <span className="w-2 h-2 rounded-full bg-moss/30" />
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
      </CardContent>
    </Card>
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
      await supabase.from("vision_snapshots").insert({
        vision_id: vision.id,
        snapshot: vision,
        created_by: userCtx.userId,
      });

      await supabase
        .from("visions")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", vision.id);
    } else {
      await supabase.from("visions").insert(payload);
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
        <h1 className="text-2xl font-bold mb-6">Vision Board</h1>
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
          <h1 className="text-2xl font-bold">Vision Board</h1>
          {vision && (
            <p className="text-sm text-warm-gray mt-0.5">
              {vision.year}
              {vision.locked && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-moss/10 text-moss font-medium">
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
              <Button size="sm" onClick={() => setEditing(true)}>
                Edit Vision
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <BhagSection bhag={bhag} editing={editing} onChange={setBhag} />
        <StrategicFiltersSection
          filters={filters}
          editing={editing}
          onChange={setFilters}
        />
        <AnnualOutcomesSection
          outcomes={outcomes}
          editing={editing}
          onChange={setOutcomes}
        />
        <NotDoingSection
          items={notDoing}
          editing={editing}
          onChange={setNotDoing}
        />
        <VersionHistory snapshots={snapshots} />
      </div>
    </div>
  );
}
