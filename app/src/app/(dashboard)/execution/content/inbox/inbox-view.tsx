"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/slide-over";
import { EmptyState } from "@/components/ui/loading";
import type { NewsletterSubmission, NewsletterSubmissionStatus } from "@/types/database";

// ============================================================
// Types & constants
// ============================================================

const TAB_OPTIONS: { label: string; value: NewsletterSubmissionStatus }[] = [
  { label: "Pending", value: "pending" },
  { label: "Parked", value: "parked" },
  { label: "Accepted", value: "accepted" },
  { label: "Dismissed", value: "dismissed" },
];

// ============================================================
// Helpers
// ============================================================

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ============================================================
// Submission Card
// ============================================================

function SubmissionCard({
  submission,
  onClick,
}: {
  submission: NewsletterSubmission;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full text-left">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="py-3">
          <h3 className="text-sm font-medium text-ink leading-tight line-clamp-2">
            {submission.title}
          </h3>
          {submission.body !== submission.title && (
            <p className="text-xs text-subtle mt-1.5 line-clamp-2 leading-relaxed">
              {submission.body}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-faded">
            <span className="font-medium">{submission.submitter_discord_name}</span>
            <span>&middot;</span>
            <span>{relativeTime(submission.created_at)}</span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

// ============================================================
// Submission Detail Panel
// ============================================================

function SubmissionDetailPanel({
  submission,
  onClose,
  onTriage,
}: {
  submission: NewsletterSubmission;
  onClose: () => void;
  onTriage: (action: "accept" | "park" | "dismiss") => Promise<void>;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: "accept" | "park" | "dismiss") {
    setLoading(action);
    try {
      await onTriage(action);
    } finally {
      setLoading(null);
    }
  }

  const isPending = submission.status === "pending" || submission.status === "parked";

  return (
    <SlideOver open onClose={onClose} title="Newsletter Idea" width="md">
      <div className="space-y-5">
        {/* Title */}
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">
            {submission.title}
          </h3>
        </div>

        {/* Body */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-faded mb-1">
            Idea
          </p>
          <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
            {submission.body}
          </p>
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-faded">
            Details
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-faded">Submitted by</span>
              <p className="text-ink font-medium">{submission.submitter_discord_name}</p>
            </div>
            <div>
              <span className="text-faded">Date</span>
              <p className="text-ink">
                {new Date(submission.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <span className="text-faded">Status</span>
              <p className="text-ink capitalize">{submission.status}</p>
            </div>
            {submission.content_piece_id && (
              <div>
                <span className="text-faded">Content piece</span>
                <p>
                  <Link
                    href={`/execution/content/${submission.content_piece_id}`}
                    className="text-accent hover:text-accent-warm text-sm font-medium"
                  >
                    Open in Editor
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex items-center gap-2 pt-3 border-t border-line">
            <Button
              size="sm"
              onClick={() => handleAction("accept")}
              disabled={loading !== null}
            >
              {loading === "accept" ? "Creating..." : "Accept"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction("park")}
              disabled={loading !== null}
            >
              {loading === "park" ? "Parking..." : "Park"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleAction("dismiss")}
              disabled={loading !== null}
            >
              {loading === "dismiss" ? "Dismissing..." : "Dismiss"}
            </Button>
          </div>
        )}
      </div>
    </SlideOver>
  );
}

// ============================================================
// Inbox View (main export)
// ============================================================

export function InboxView({ submissions: initialSubmissions }: { submissions: NewsletterSubmission[] }) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [activeTab, setActiveTab] = useState<NewsletterSubmissionStatus>("pending");
  const [selected, setSelected] = useState<NewsletterSubmission | null>(null);

  const filtered = submissions.filter((s) => s.status === activeTab);
  const counts = submissions.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  async function handleTriage(submissionId: string, action: "accept" | "park" | "dismiss") {
    const res = await fetch("/api/newsletter-submissions/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, action }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Triage failed");
    }

    const result = await res.json();

    // Update local state
    const statusMap: Record<string, NewsletterSubmissionStatus> = {
      accept: "accepted",
      park: "parked",
      dismiss: "dismissed",
    };

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              status: statusMap[action],
              content_piece_id: result.contentPieceId ?? s.content_piece_id,
            }
          : s
      )
    );

    setSelected(null);

    // If accepted, navigate to the new content piece
    if (action === "accept" && result.contentPieceId) {
      router.push(`/execution/content/${result.contentPieceId}`);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">
            Newsletter Inbox
          </h1>
          <p className="text-sm text-subtle mt-0.5">
            Ideas submitted from Discord. Triage them into your content pipeline.
          </p>
        </div>
        <Link href="/execution/content">
          <Button variant="secondary" size="sm">
            Back to Pipeline
          </Button>
        </Link>
      </div>

      {/* Tab filters */}
      <div className="flex items-center gap-1 mb-4">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-accent/10 text-accent"
                : "text-faded hover:text-subtle hover:bg-hovered"
            }`}
          >
            {tab.label}
            {(counts[tab.value] ?? 0) > 0 && (
              <span className="ml-1.5 font-mono text-[11px]">
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title={
            activeTab === "pending"
              ? "No pending ideas"
              : `No ${activeTab} ideas`
          }
          description={
            activeTab === "pending"
              ? "Newsletter ideas submitted in Discord will appear here."
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((sub) => (
            <SubmissionCard
              key={sub.id}
              submission={sub}
              onClick={() => setSelected(sub)}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <SubmissionDetailPanel
          submission={selected}
          onClose={() => setSelected(null)}
          onTriage={(action) => handleTriage(selected.id, action)}
        />
      )}
    </div>
  );
}
