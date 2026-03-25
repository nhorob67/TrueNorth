"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading";

// ============================================================
// Types
// ============================================================

type MachineType = "newsletter" | "deep_content" | "short_form" | "live_event";
type ContentLifecycle = "ideation" | "drafting" | "review" | "scheduled" | "published";

interface ContentPiece {
  id: string;
  venture_id: string;
  organization_id: string;
  title: string;
  machine_type: MachineType;
  lifecycle_status: ContentLifecycle;
  owner_id: string;
  scheduled_at: string | null;
  created_at: string;
  campaign_name: string | null;
}

// ============================================================
// Machine type labels and styles
// ============================================================

const machineLabels: Record<MachineType, string> = {
  newsletter: "Flagship Newsletter",
  deep_content: "Deep Content",
  short_form: "Short-Form Daily",
  live_event: "Monthly Live Event",
};

const machineColors: Record<MachineType, string> = {
  newsletter: "bg-moss/10 text-moss",
  deep_content: "bg-clay/10 text-clay-text",
  short_form: "bg-brass/10 text-brass-text",
  live_event: "bg-sage/10 text-sage-text",
};

const stageLabels: Record<ContentLifecycle, string> = {
  ideation: "Ideation",
  drafting: "Drafting",
  review: "Review",
  scheduled: "Scheduled",
  published: "Published",
};

// ============================================================
// Content Piece Card
// ============================================================

function ContentCard({ piece }: { piece: ContentPiece }) {
  return (
    <a href={`/content/${piece.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="py-3">
          <h3 className="text-sm font-medium text-charcoal leading-tight">
            {piece.title}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${machineColors[piece.machine_type]}`}
            >
              {machineLabels[piece.machine_type]}
            </span>
          </div>
          {piece.scheduled_at && (
            <p className="text-xs text-warm-gray mt-1">
              Scheduled:{" "}
              {new Date(piece.scheduled_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
          <p className="text-xs text-warm-gray mt-1">
            {new Date(piece.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </CardContent>
      </Card>
    </a>
  );
}

// ============================================================
// Add Content Piece Form
// ============================================================

function AddContentForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();
  const [title, setTitle] = useState("");
  const [machineType, setMachineType] = useState<MachineType>("newsletter");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    const { data } = await supabase
      .from("content_pieces")
      .insert({
        organization_id: userCtx.orgId,
        venture_id: userCtx.ventureId,
        title: title.trim(),
        machine_type: machineType,
        lifecycle_status: "ideation",
        owner_id: userCtx.userId,
        body_json: {},
      })
      .select("id")
      .single();

    setLoading(false);
    if (data) {
      router.push(`/content/${data.id}`);
    } else {
      onClose();
      router.refresh();
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-sm font-semibold">New Content Piece</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Content title..."
            required
          />
          <div className="flex gap-2">
            <select
              value={machineType}
              onChange={(e) => setMachineType(e.target.value as MachineType)}
              className="text-sm border border-warm-border rounded-lg px-3 py-2 bg-ivory"
            >
              {Object.entries(machineLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={loading || !title.trim()}>
              {loading ? "Creating..." : "Create & Open Editor"}
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
// Kanban Column
// ============================================================

// ============================================================
// Suggested Next Card (AI-powered, for Ideation column)
// ============================================================

function SuggestedNextCard({
  onAccept,
}: {
  onAccept: (title: string, machineType: MachineType) => void;
}) {
  const supabase = createClient();
  const userCtx = useUserContext();
  const [suggestion, setSuggestion] = useState<{
    title: string;
    machineType: MachineType;
    reason: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSuggestion() {
      // Find pending recurring move instances linked to content machines
      const { data: moves } = await supabase
        .from("moves")
        .select("id, title, content_machine_id, cadence, target_per_cycle")
        .eq("organization_id", userCtx.orgId)
        .eq("venture_id", userCtx.ventureId)
        .eq("type", "recurring")
        .not("content_machine_id", "is", null)
        .eq("lifecycle_status", "in_progress");

      if (!moves || moves.length === 0) {
        setLoading(false);
        return;
      }

      // Check which have pending instances
      for (const move of moves) {
        const { data: pending } = await supabase
          .from("move_instances")
          .select("id")
          .eq("move_id", move.id)
          .eq("status", "pending")
          .limit(1);

        if (pending && pending.length > 0) {
          const machine = move.content_machine_id as MachineType;
          const machineLabel = machineLabels[machine] ?? machine;
          setSuggestion({
            title: `New ${machineLabel}: ${move.title}`,
            machineType: machine,
            reason: `Pending rhythm for "${move.title}" — keep the ${machineLabel} cadence on track`,
          });
          break;
        }
      }
      setLoading(false);
    }
    loadSuggestion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !suggestion) return null;

  return (
    <Card className="border-sage border mb-2">
      <CardContent className="py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-sage/10 text-sage-text">
            AI Suggested
          </span>
        </div>
        <h3 className="text-sm font-medium text-charcoal leading-tight">
          {suggestion.title}
        </h3>
        <p className="text-xs text-warm-gray mt-1">{suggestion.reason}</p>
        <button
          onClick={() =>
            onAccept(suggestion.title, suggestion.machineType)
          }
          className="mt-2 text-xs text-moss font-medium hover:underline"
        >
          Create content piece
        </button>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  stage,
  pieces,
  showSuggested,
  onAcceptSuggestion,
}: {
  stage: ContentLifecycle;
  pieces: ContentPiece[];
  showSuggested?: boolean;
  onAcceptSuggestion?: (title: string, machineType: MachineType) => void;
}) {
  return (
    <div className="flex-1 min-w-[200px]">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-charcoal">
            {stageLabels[stage]}
          </h3>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-warm-gray/10 text-warm-gray">
            {pieces.length}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {showSuggested && onAcceptSuggestion && (
          <SuggestedNextCard onAccept={onAcceptSuggestion} />
        )}
        {pieces.map((piece) => (
          <ContentCard key={piece.id} piece={piece} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Machine Filter Tabs
// ============================================================

function MachineFilter({
  active,
  onSelect,
  counts,
}: {
  active: MachineType | "all";
  onSelect: (m: MachineType | "all") => void;
  counts: Record<string, number>;
}) {
  const options: Array<{ key: MachineType | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "newsletter", label: "Newsletter" },
    { key: "deep_content", label: "Deep Content" },
    { key: "short_form", label: "Short-Form" },
    { key: "live_event", label: "Live Event" },
  ];

  return (
    <div className="flex gap-1 bg-ivory border border-warm-border rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onSelect(opt.key)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            active === opt.key
              ? "bg-moss text-white"
              : "text-warm-gray hover:text-charcoal"
          }`}
        >
          {opt.label}
          {(counts[opt.key] ?? 0) > 0 && (
            <span className="ml-1 opacity-75">({counts[opt.key]})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function ContentMachinesView({
  pieces,
}: {
  pieces: ContentPiece[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [machineFilter, setMachineFilter] = useState<MachineType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContentPiece[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (!query.trim()) {
        setSearchResults(null);
        setSearching(false);
        return;
      }
      if (query.trim().length < 2) return;

      setSearching(true);
      searchTimerRef.current = setTimeout(async () => {
        const { data } = await supabase
          .from("content_pieces")
          .select(
            "id, venture_id, organization_id, title, machine_type, lifecycle_status, owner_id, scheduled_at, created_at"
          )
          .ilike("title", `%${query.trim()}%`)
          .order("created_at", { ascending: false })
          .limit(20);

        setSearchResults((data ?? []) as ContentPiece[]);
        setSearching(false);
      }, 300);
    },
    [supabase]
  );

  const stages: ContentLifecycle[] = [
    "ideation",
    "drafting",
    "review",
    "scheduled",
    "published",
  ];

  const [campaignFilter, setCampaignFilter] = useState<string | "all">("all");

  const filtered = pieces.filter((p) => {
    if (machineFilter !== "all" && p.machine_type !== machineFilter) return false;
    if (campaignFilter !== "all" && (p.campaign_name ?? "") !== campaignFilter) return false;
    return true;
  });

  // Counts per machine
  const counts: Record<string, number> = { all: pieces.length };
  for (const p of pieces) {
    counts[p.machine_type] = (counts[p.machine_type] ?? 0) + 1;
  }

  // Campaign aggregates
  const campaigns = new Map<string, { total: number; byStage: Record<string, number> }>();
  for (const p of pieces) {
    if (!p.campaign_name) continue;
    const c = campaigns.get(p.campaign_name) ?? { total: 0, byStage: {} };
    c.total++;
    c.byStage[p.lifecycle_status] = (c.byStage[p.lifecycle_status] ?? 0) + 1;
    campaigns.set(p.campaign_name, c);
  }
  const campaignNames = Array.from(campaigns.keys()).sort();

  if (pieces.length === 0 && !showAdd) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Content Machines</h1>
        <EmptyState
          title="No content yet"
          description="Create your first content piece. It will flow through the pipeline: Ideation → Drafting → Review → Scheduled → Published."
          action={
            <Button onClick={() => setShowAdd(true)}>
              Create Content
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Content Machines</h1>
          <p className="text-sm text-warm-gray mt-0.5">
            4 machines, 5-stage pipeline. Click any piece to open the editor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/content/calendar">
            <Button variant="secondary" size="sm">
              Calendar
            </Button>
          </Link>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            New Content
          </Button>
        </div>
      </div>

      {showAdd && <AddContentForm onClose={() => setShowAdd(false)} />}

      {/* Search */}
      <div className="mb-4">
        <Input
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search content by title..."
        />
      </div>

      {/* Search results */}
      {searchResults !== null && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-charcoal">
              Search Results {searching && <span className="text-warm-gray font-normal">(searching...)</span>}
            </h3>
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setSearchResults(null); }}
              className="text-xs text-warm-gray hover:text-charcoal transition-colors"
            >
              Clear search
            </button>
          </div>
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {searchResults.map((p) => (
                <ContentCard key={p.id} piece={p} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-warm-gray">No content pieces match your search.</p>
          )}
        </div>
      )}

      {/* Machine filter */}
      <div className="mb-4">
        <MachineFilter
          active={machineFilter}
          onSelect={setMachineFilter}
          counts={counts}
        />
      </div>

      {/* Campaign summary */}
      {campaignNames.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-warm-gray uppercase">
              Campaigns
            </h3>
            {campaignFilter !== "all" && (
              <button
                onClick={() => setCampaignFilter("all")}
                className="text-xs text-clay-text hover:text-clay"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {campaignNames.map((name) => {
              const c = campaigns.get(name)!;
              const isActive = campaignFilter === name;
              const published = c.byStage["published"] ?? 0;
              const scheduled = c.byStage["scheduled"] ?? 0;
              return (
                <button
                  key={name}
                  onClick={() => setCampaignFilter(isActive ? "all" : name)}
                  className={`flex-shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-moss bg-moss/10"
                      : "border-warm-border bg-ivory hover:bg-parchment"
                  }`}
                >
                  <p className={`text-xs font-semibold ${isActive ? "text-moss" : "text-charcoal"}`}>
                    {name}
                  </p>
                  <p className="text-[10px] text-warm-gray mt-0.5">
                    {c.total} pieces · {published} published · {scheduled} scheduled
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            pieces={filtered.filter((p) => p.lifecycle_status === stage)}
            showSuggested={stage === "ideation"}
            onAcceptSuggestion={
              stage === "ideation"
                ? async (title, machineType) => {
                    const supabase = createClient();
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) return;

                    const { data } = await supabase
                      .from("content_pieces")
                      .insert({
                        organization_id: pieces[0]?.organization_id,
                        venture_id: pieces[0]?.venture_id,
                        title,
                        machine_type: machineType,
                        lifecycle_status: "ideation",
                        owner_id: user.id,
                        body_json: {},
                      })
                      .select("id")
                      .single();

                    if (data) {
                      window.location.href = `/content/${data.id}`;
                    }
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
