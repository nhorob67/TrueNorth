"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { useCollaboration } from "@/hooks/use-collaboration";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
const TrueNorthEditor = dynamic(
  () => import("@/components/editor/truenorth-editor").then((m) => m.TrueNorthEditor),
  { ssr: false, loading: () => <div className="h-96 bg-warm-border/20 animate-pulse rounded-lg" /> }
);
import { Comments } from "@/components/comments";
import { VersionDiff } from "@/components/editor/version-diff";
import type { SeoSuggestions } from "@/lib/ai/seo-suggestions";

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
  body_json: Record<string, unknown>;
  owner_id: string;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Version {
  id: string;
  body_json?: Record<string, unknown>;
  body_html?: string;
  created_at: string;
  created_by: string;
}

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

const stageOrder: ContentLifecycle[] = [
  "ideation",
  "drafting",
  "review",
  "scheduled",
  "published",
];

// ============================================================
// Status Stepper
// ============================================================

function StatusStepper({
  currentStatus,
  onAdvance,
}: {
  currentStatus: ContentLifecycle;
  onAdvance: (status: ContentLifecycle) => void;
}) {
  const currentIdx = stageOrder.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1">
      {stageOrder.map((stage, idx) => {
        const isCurrent = idx === currentIdx;
        const isDone = idx < currentIdx;
        const isNext = idx === currentIdx + 1;

        return (
          <button
            key={stage}
            type="button"
            onClick={() => isNext && onAdvance(stage)}
            disabled={!isNext}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isCurrent
                ? "bg-moss text-white"
                : isDone
                  ? "bg-semantic-green/10 text-semantic-green-text"
                  : isNext
                    ? "bg-clay/10 text-clay-text hover:bg-clay/20 cursor-pointer"
                    : "bg-warm-border/50 text-warm-gray"
            }`}
            title={isNext ? `Advance to ${stageLabels[stage]}` : undefined}
          >
            {stageLabels[stage]}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Collaborator Avatars
// ============================================================

function CollaboratorAvatars({
  collaborators,
  isSynced,
}: {
  collaborators: Array<{ id: string; name: string; color: string }>;
  isSynced: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {/* Sync indicator */}
      <span
        className={`w-2 h-2 rounded-full ${isSynced ? "bg-semantic-green" : "bg-semantic-ochre animate-pulse"}`}
        title={isSynced ? "Connected" : "Connecting..."}
      />

      {/* Other collaborators */}
      {collaborators.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: c.color }}
          title={c.name}
        >
          {c.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </span>
      ))}

      {collaborators.length > 0 && (
        <span className="text-xs text-warm-gray">
          {collaborators.length} editing
        </span>
      )}
    </div>
  );
}

// ============================================================
// Version History Sidebar (with Compare button)
// ============================================================

function VersionHistory({
  versions,
  onCompare,
}: {
  versions: Version[];
  onCompare: (version: Version) => void;
}) {
  if (versions.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-warm-gray uppercase mb-2">
        Version History
      </h3>
      <div className="space-y-1">
        {versions.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between gap-2 py-1"
          >
            <div className="flex items-center gap-2 text-xs text-warm-gray">
              <span className="w-1.5 h-1.5 rounded-full bg-moss/30" />
              <span>
                {new Date(v.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onCompare(v)}
              className="text-xs text-clay-text hover:text-clay transition-colors"
            >
              Compare
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SEO Panel
// ============================================================

function SeoPanel({
  suggestions,
  loading,
  onGenerate,
}: {
  suggestions: SeoSuggestions | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-warm-gray uppercase">
          SEO Analysis
        </h3>
        <Button
          variant="tertiary"
          size="sm"
          onClick={onGenerate}
          disabled={loading}
        >
          {loading ? "Analyzing..." : suggestions ? "Refresh" : "Analyze"}
        </Button>
      </div>

      {suggestions && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-warm-gray">
              Suggested Title
            </label>
            <p className="text-sm text-charcoal mt-0.5">{suggestions.title}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-warm-gray">
              Meta Description
            </label>
            <p className="text-xs text-charcoal mt-0.5 leading-relaxed">
              {suggestions.metaDescription}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-warm-gray">
              Keywords
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {suggestions.keywords.map((kw, i) => (
                <Badge key={i} status="neutral">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-warm-gray">
              Readability Score
            </label>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-warm-border/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    suggestions.readabilityScore >= 70
                      ? "bg-semantic-green"
                      : suggestions.readabilityScore >= 40
                        ? "bg-semantic-ochre"
                        : "bg-semantic-brick"
                  }`}
                  style={{ width: `${suggestions.readabilityScore}%` }}
                />
              </div>
              <span className="text-xs font-medium text-charcoal">
                {suggestions.readabilityScore}/100
              </span>
            </div>
          </div>
          {suggestions.improvements.length > 0 && (
            <div>
              <label className="text-xs font-medium text-warm-gray">
                Improvements
              </label>
              <ul className="mt-1 space-y-1">
                {suggestions.improvements.map((item, i) => (
                  <li key={i} className="text-xs text-charcoal flex gap-1.5">
                    <span className="text-clay-text flex-shrink-0">-</span>
                    {item}
                  </li>
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
// Main Editor View
// ============================================================

export function ContentEditorView({
  piece,
  versions,
  linkedFunnel,
}: {
  piece: ContentPiece;
  versions: Version[];
  linkedFunnel?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();

  // Real-time collaboration
  const { ydoc, awareness, isSynced, collaborators } = useCollaboration(
    piece.id,
    { id: userCtx.userId, name: userCtx.fullName || "Anonymous" }
  );

  const [title, setTitle] = useState(piece.title);
  const [scheduledAt, setScheduledAt] = useState(piece.scheduled_at ?? "");
  const [bodyJson, setBodyJson] = useState<Record<string, unknown>>(
    piece.body_json ?? {}
  );
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [creditNotice, setCreditNotice] = useState<string | null>(null);

  // Version diff state
  const [diffVersion, setDiffVersion] = useState<Version | null>(null);

  // SEO state
  const [seoSuggestions, setSeoSuggestions] = useState<SeoSuggestions | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);

  // Convert stored JSON to HTML for initial editor content (fallback for non-collab)
  const initialContent =
    piece.body_json && Object.keys(piece.body_json).length > 0
      ? piece.body_json
      : "";

  const handleEditorChange = useCallback(
    (json: Record<string, unknown>, html: string) => {
      setBodyJson(json);
      setBodyHtml(html);
    },
    []
  );

  // Inline comment creation handler
  const handleCommentCreate = useCallback(
    async (selectedText: string, commentId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("comments").insert({
        organization_id: piece.organization_id,
        entity_id: piece.id,
        entity_type: "content_piece",
        author_id: user.id,
        body: `[Inline comment on: "${selectedText.slice(0, 100)}${selectedText.length > 100 ? "..." : ""}"]`,
        mentions: [],
        parent_comment_id: null,
        text_anchor: JSON.stringify({
          commentId,
          selectedText: selectedText.slice(0, 500),
        }),
      });

      router.refresh();
    },
    [supabase, piece.id, piece.organization_id, router]
  );

  async function handleSave() {
    setSaving(true);

    // Save version snapshot (captures current body_json for diffing)
    await supabase.from("content_versions").insert({
      content_piece_id: piece.id,
      body_json: bodyJson,
      body_html: bodyHtml,
      created_by: userCtx.userId,
    });

    // Update the content piece metadata + body_json
    // (ydoc_state is persisted automatically by the provider every 10s)
    await supabase
      .from("content_pieces")
      .update({
        title: title.trim(),
        body_json: bodyJson,
        scheduled_at: scheduledAt || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", piece.id);

    setSaving(false);
    setLastSaved(new Date().toLocaleTimeString());
    router.refresh();
  }

  async function handleStatusChange(newStatus: ContentLifecycle) {
    await supabase
      .from("content_pieces")
      .update({
        lifecycle_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", piece.id);

    // Auto-credit a recurring move instance when content is published
    if (newStatus === "published") {
      try {
        const res = await fetch("/api/content/auto-credit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentPieceId: piece.id }),
        });
        const result = await res.json();
        if (result.credited && result.moveTitle) {
          setCreditNotice(`Credited recurring move: ${result.moveTitle}`);
          setTimeout(() => setCreditNotice(null), 5000);
        }
      } catch {
        // Auto-credit is best-effort; don't block the status change
      }
    }

    router.refresh();
  }

  async function handleSeoAnalysis() {
    setSeoLoading(true);
    try {
      const { generateSeoSuggestions } = await import("@/lib/ai/seo-suggestions");
      const suggestions = await generateSeoSuggestions(bodyHtml || "", title);
      setSeoSuggestions(suggestions);
    } catch (err) {
      console.error("SEO analysis failed:", err);
    }
    setSeoLoading(false);
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => router.push("/content")}
        >
          Back to Content
        </Button>
        <div className="flex items-center gap-3">
          <CollaboratorAvatars
            collaborators={collaborators}
            isSynced={isSynced}
          />
          {lastSaved && (
            <span className="text-xs text-warm-gray">
              Saved at {lastSaved}
            </span>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Auto-credit notification */}
      {creditNotice && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-semantic-green/10 border border-semantic-green/20 text-semantic-green-text text-sm font-medium flex items-center justify-between">
          <span>{creditNotice}</span>
          <button
            type="button"
            onClick={() => setCreditNotice(null)}
            className="ml-3 text-semantic-green-text/60 hover:text-semantic-green-text"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main editor area */}
        <div>
          {/* Title + meta */}
          <Card className="mb-4">
            <CardContent className="py-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xl font-bold text-charcoal bg-transparent border-none outline-none placeholder:text-warm-gray"
                placeholder="Content title..."
              />
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${machineColors[piece.machine_type]}`}
                >
                  {machineLabels[piece.machine_type]}
                </span>
                <StatusStepper
                  currentStatus={piece.lifecycle_status}
                  onAdvance={handleStatusChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Editor — pass ydoc + awareness for real-time collaboration */}
          <TrueNorthEditor
            content={
              typeof initialContent === "string"
                ? initialContent
                : JSON.stringify(initialContent)
            }
            onChange={handleEditorChange}
            onCommentCreate={handleCommentCreate}
            placeholder="Start writing your content... Use the toolbar for formatting, or type / for quick actions."
            ydoc={ydoc}
            awareness={awareness}
          />

          {/* Version Diff (shown below editor when a version is selected) */}
          {diffVersion && (
            <div className="mt-4">
              <VersionDiff
                oldVersion={{
                  body_json: diffVersion.body_json,
                  body_html: diffVersion.body_html,
                  created_at: diffVersion.created_at,
                }}
                newVersion={{
                  body_json: bodyJson,
                  label: "Current",
                }}
                onClose={() => setDiffVersion(null)}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meta */}
          <Card>
            <CardHeader>
              <h3 className="text-xs font-semibold text-warm-gray uppercase">
                Details
              </h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-warm-gray">
                  Status
                </label>
                <p className="text-sm font-medium text-charcoal">
                  {stageLabels[piece.lifecycle_status]}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-warm-gray">
                  Schedule Date
                </label>
                <Input
                  type="date"
                  value={scheduledAt ? scheduledAt.split("T")[0] : ""}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              {linkedFunnel && (
                <div>
                  <label className="text-xs font-medium text-warm-gray">
                    Linked Funnel
                  </label>
                  <a
                    href="/funnels"
                    className="block text-sm text-clay-text hover:text-clay mt-0.5 transition-colors"
                  >
                    {linkedFunnel.name} →
                  </a>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-warm-gray">
                  Created
                </label>
                <p className="text-xs text-warm-gray">
                  {new Date(piece.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* SEO Analysis (3.5) */}
          <Card>
            <CardContent className="py-3">
              <SeoPanel
                suggestions={seoSuggestions}
                loading={seoLoading}
                onGenerate={handleSeoAnalysis}
              />
            </CardContent>
          </Card>

          {/* Versions */}
          <Card>
            <CardContent className="py-3">
              <VersionHistory
                versions={versions}
                onCompare={setDiffVersion}
              />
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <h3 className="text-xs font-semibold text-warm-gray uppercase">
                Comments
              </h3>
            </CardHeader>
            <CardContent>
              <Comments
                entityId={piece.id}
                entityType="content_piece"
                orgId={piece.organization_id}
                entityOwnerId={piece.owner_id}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
