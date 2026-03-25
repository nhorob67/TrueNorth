"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";

// ============================================================
// Types
// ============================================================

type FunnelHealth = "healthy" | "underperforming" | "stalled" | "orphaned";

interface Funnel {
  id: string;
  venture_id: string;
  organization_id: string;
  name: string;
  entry_point: string;
  capture_mechanism: string;
  nurture_sequence: string;
  conversion_event: string;
  scoreboard_tie: string[];
  owner_id: string;
  lifecycle_status: string;
  health_status: FunnelHealth;
  last_result_at: string | null;
  linked_idea_id: string | null;
  created_at: string;
}

interface ApprovedIdea {
  id: string;
  name: string;
}

const healthBadge: Record<FunnelHealth, { status: "green" | "yellow" | "red" | "neutral"; label: string }> = {
  healthy: { status: "green", label: "Healthy" },
  underperforming: { status: "yellow", label: "Underperforming" },
  stalled: { status: "red", label: "Stalled" },
  orphaned: { status: "red", label: "Orphaned" },
};

// ============================================================
// Funnel Card
// ============================================================

function FunnelCard({
  funnel,
  onSelect,
}: {
  funnel: Funnel;
  onSelect: (f: Funnel) => void;
}) {
  const badge = healthBadge[funnel.health_status] ?? healthBadge.healthy;

  return (
    <button type="button" onClick={() => onSelect(funnel)} className="w-full text-left">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-charcoal">
                {funnel.name}
              </h3>
              <p className="text-xs text-warm-gray mt-1">
                {funnel.entry_point}
              </p>
            </div>
            <Badge status={badge.status}>{badge.label}</Badge>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-warm-gray">
            <div>
              <span className="font-medium">Capture:</span>{" "}
              {funnel.capture_mechanism}
            </div>
            <div>
              <span className="font-medium">Conversion:</span>{" "}
              {funnel.conversion_event}
            </div>
          </div>
          {funnel.last_result_at && (
            <p className="text-xs text-warm-gray mt-2">
              Last result:{" "}
              {new Date(funnel.last_result_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

// ============================================================
// Create / Edit Funnel Form
// ============================================================

function FunnelForm({
  funnel,
  approvedIdeas,
  onSaved,
  onCancel,
}: {
  funnel?: Funnel;
  approvedIdeas: ApprovedIdea[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();

  const [name, setName] = useState(funnel?.name ?? "");
  const [entryPoint, setEntryPoint] = useState(funnel?.entry_point ?? "");
  const [capture, setCapture] = useState(funnel?.capture_mechanism ?? "");
  const [nurture, setNurture] = useState(funnel?.nurture_sequence ?? "");
  const [conversion, setConversion] = useState(funnel?.conversion_event ?? "");
  const [scoreboardTie, setScoreboardTie] = useState(
    funnel?.scoreboard_tie?.join(", ") ?? ""
  );
  const [linkedIdeaId, setLinkedIdeaId] = useState(
    funnel?.linked_idea_id ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isComplete =
    name.trim() &&
    entryPoint.trim() &&
    capture.trim() &&
    nurture.trim() &&
    conversion.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) {
      setError("All 5 funnel elements are required.");
      return;
    }
    if (!linkedIdeaId && approvedIdeas.length > 0) {
      const override = confirm(
        "No approved idea is linked. TrueNorth requires funnels to be linked to an approved idea. Continue without linkage?"
      );
      if (!override) return;
    }

    setLoading(true);
    setError("");

    const payload = {
      organization_id: userCtx.orgId,
      venture_id: userCtx.ventureId,
      name: name.trim(),
      entry_point: entryPoint.trim(),
      capture_mechanism: capture.trim(),
      nurture_sequence: nurture.trim(),
      conversion_event: conversion.trim(),
      scoreboard_tie: scoreboardTie
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      linked_idea_id: linkedIdeaId || null,
      owner_id: userCtx.userId,
    };

    if (funnel) {
      const { error: updateError } = await supabase
        .from("funnels")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", funnel.id);
      if (updateError) setError(updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from("funnels")
        .insert(payload);
      if (insertError) setError(insertError.message);
    }

    setLoading(false);
    if (!error) {
      onSaved();
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">
          {funnel ? "Edit Funnel" : "Register New Funnel"}
        </h2>
        <p className="text-xs text-warm-gray">
          All 5 elements are required per TrueNorth rules.
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            label="Funnel Name"
            placeholder="e.g., Newsletter → Paid Course"
            required
          />
          <Input
            value={entryPoint}
            onChange={(e) => setEntryPoint(e.target.value)}
            label="1. Entry Point"
            placeholder="Where does the audience first encounter this funnel?"
            required
          />
          <Input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            label="2. Capture Mechanism"
            placeholder="How do you capture their attention/info?"
            required
          />
          <Input
            value={nurture}
            onChange={(e) => setNurture(e.target.value)}
            label="3. Nurture Sequence"
            placeholder="How do you build trust over time?"
            required
          />
          <Input
            value={conversion}
            onChange={(e) => setConversion(e.target.value)}
            label="4. Conversion Event"
            placeholder="What action defines conversion?"
            required
          />
          <Input
            value={scoreboardTie}
            onChange={(e) => setScoreboardTie(e.target.value)}
            label="5. Scoreboard Tie"
            placeholder="KPI names this funnel drives (comma separated)"
          />
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Linked Idea (from Vault)
            </label>
            <select
              value={linkedIdeaId}
              onChange={(e) => setLinkedIdeaId(e.target.value)}
              className="block w-full rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20"
            >
              <option value="">No linked idea</option>
              {approvedIdeas.map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-warm-gray mt-0.5">
              Funnels should link to an approved idea from the Vault.
            </p>
          </div>
          {error && <p className="text-sm text-semantic-brick">{error}</p>}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !isComplete}>
            {loading ? "Saving..." : funnel ? "Update" : "Register Funnel"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// ============================================================
// Funnel Detail Panel
// ============================================================

function FunnelDetailPanel({
  funnel,
  onClose,
  onEdit,
}: {
  funnel: Funnel;
  onClose: () => void;
  onEdit: () => void;
}) {
  const supabase = createClient();
  const [linkedContent, setLinkedContent] = useState<
    Array<{ id: string; title: string; lifecycle_status: string; scheduled_at: string | null }>
  >([]);

  useEffect(() => {
    async function fetchLinkedContent() {
      const { data } = await supabase
        .from("content_pieces")
        .select("id, title, lifecycle_status, scheduled_at")
        .eq("linked_funnel_id", funnel.id)
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (data) setLinkedContent(data);
    }
    fetchLinkedContent();
  }, [funnel.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const badge = healthBadge[funnel.health_status] ?? healthBadge.healthy;

  const elements = [
    { label: "Entry Point", value: funnel.entry_point },
    { label: "Capture Mechanism", value: funnel.capture_mechanism },
    { label: "Nurture Sequence", value: funnel.nurture_sequence },
    { label: "Conversion Event", value: funnel.conversion_event },
    {
      label: "Scoreboard Tie",
      value: funnel.scoreboard_tie?.join(", ") || "None",
    },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-ivory border-l border-warm-border shadow-xl z-50 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-charcoal">{funnel.name}</h2>
            <Badge status={badge.status} className="mt-1">
              {badge.label}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="text-warm-gray hover:text-charcoal text-xl"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {elements.map((el, idx) => (
            <div key={el.label}>
              <p className="text-xs font-semibold text-warm-gray uppercase mb-0.5">
                {idx + 1}. {el.label}
              </p>
              <p className="text-sm text-charcoal">{el.value}</p>
            </div>
          ))}
        </div>

        {funnel.last_result_at && (
          <p className="text-xs text-warm-gray mt-4">
            Last result:{" "}
            {new Date(funnel.last_result_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}

        {/* Linked Content from Media Calendar */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-warm-gray uppercase mb-2">
            Linked Content ({linkedContent.length})
          </p>
          {linkedContent.length === 0 ? (
            <p className="text-xs text-warm-gray">
              No content pieces linked to this funnel yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {linkedContent.map((piece) => (
                <a
                  key={piece.id}
                  href={`/content/${piece.id}`}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-parchment hover:bg-warm-border/30 transition-colors"
                >
                  <span className="text-charcoal truncate">{piece.title}</span>
                  <span className="text-warm-gray flex-shrink-0 ml-2">
                    {piece.scheduled_at
                      ? new Date(piece.scheduled_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : piece.lifecycle_status}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <Button size="sm" onClick={onEdit}>
            Edit Funnel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function FunnelRegistryView({
  funnels,
  approvedIdeas,
}: {
  funnels: Funnel[];
  approvedIdeas: ApprovedIdea[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [selectedFunnel, setSelectedFunnel] = useState<Funnel | null>(null);

  const activeFunnels = funnels.filter((f) => f.lifecycle_status === "active");
  const archivedFunnels = funnels.filter(
    (f) => f.lifecycle_status !== "active"
  );

  if (funnels.length === 0 && !showForm) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Funnel Registry</h1>
        <EmptyState
          title="No funnels registered"
          description="Register your first funnel with all 5 required elements: entry point, capture, nurture, conversion, and scoreboard tie."
          action={
            <Button onClick={() => setShowForm(true)}>
              Register Funnel
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Funnel Registry</h1>
          <p className="text-sm text-warm-gray mt-0.5">
            Every active funnel with all 5 required elements.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          Register Funnel
        </Button>
      </div>

      {(showForm || editingFunnel) && (
        <div className="mb-6">
          <FunnelForm
            funnel={editingFunnel ?? undefined}
            approvedIdeas={approvedIdeas}
            onSaved={() => {
              setShowForm(false);
              setEditingFunnel(null);
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingFunnel(null);
            }}
          />
        </div>
      )}

      {/* Active Funnels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeFunnels.map((funnel) => (
          <FunnelCard
            key={funnel.id}
            funnel={funnel}
            onSelect={setSelectedFunnel}
          />
        ))}
      </div>

      {/* Archived */}
      {archivedFunnels.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wider mb-3">
            Archived ({archivedFunnels.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
            {archivedFunnels.map((funnel) => (
              <FunnelCard
                key={funnel.id}
                funnel={funnel}
                onSelect={setSelectedFunnel}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedFunnel && (
        <>
          <div
            className="fixed inset-0 bg-charcoal/20 z-40"
            onClick={() => setSelectedFunnel(null)}
          />
          <FunnelDetailPanel
            funnel={selectedFunnel}
            onClose={() => setSelectedFunnel(null)}
            onEdit={() => {
              setEditingFunnel(selectedFunnel);
              setSelectedFunnel(null);
            }}
          />
        </>
      )}
    </div>
  );
}
