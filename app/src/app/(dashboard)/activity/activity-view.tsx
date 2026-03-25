"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/loading";

// ============================================================
// Types
// ============================================================

interface Comment {
  id: string;
  body: string;
  author_id: string;
  entity_id: string;
  entity_type: string;
  parent_comment_id: string | null;
  mentions: Array<{ userId: string; name: string }>;
  resolved: boolean;
  created_at: string;
  user_profiles?: { full_name: string } | null;
}

type EntityTypeFilter = "all" | string;

// ============================================================
// Entity type labels
// ============================================================

const entityTypeLabels: Record<string, string> = {
  bet: "Bet",
  kpi: "KPI",
  move: "Move",
  idea: "Idea",
  blocker: "Blocker",
  decision: "Decision",
  commitment: "Commitment",
  issue: "Issue",
  content_piece: "Content",
};

const entityTypeColors: Record<string, string> = {
  bet: "bg-accent/10 text-accent",
  kpi: "bg-semantic-green/10 text-semantic-green-text",
  move: "bg-semantic-ochre/10 text-semantic-ochre-text",
  idea: "bg-brass/10 text-brass-text",
  blocker: "bg-semantic-brick/10 text-semantic-brick",
  decision: "bg-accent-dim text-accent",
  commitment: "bg-accent-dim text-accent",
  issue: "bg-faded/10 text-subtle",
};

// ============================================================
// Activity Item
// ============================================================

function ActivityItem({ comment }: { comment: Comment }) {
  const authorName =
    (comment.user_profiles as { full_name: string } | null)?.full_name ??
    "Unknown";
  const isReply = !!comment.parent_comment_id;

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0">
            {authorName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-ink">
                {authorName}
              </span>
              <span className="text-xs text-subtle">
                {isReply ? "replied on" : "commented on"}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  entityTypeColors[comment.entity_type] ??
                  "bg-faded/10 text-subtle"
                }`}
              >
                {entityTypeLabels[comment.entity_type] ??
                  comment.entity_type}
              </span>
              {comment.resolved && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-semantic-green/10 text-semantic-green-text font-medium">
                  Resolved
                </span>
              )}
            </div>
            <p className="text-sm text-ink mt-1 whitespace-pre-wrap line-clamp-3">
              {comment.body}
            </p>
            <p className="text-xs text-subtle mt-1">
              {new Date(comment.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main View
// ============================================================

export function ActivityFeedView({ comments }: { comments: Comment[] }) {
  const [entityFilter, setEntityFilter] = useState<EntityTypeFilter>("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all");

  // Get unique entity types from data
  const entityTypes = Array.from(
    new Set(comments.map((c) => c.entity_type))
  ).sort();

  // Apply filters
  let filtered = comments;

  if (entityFilter !== "all") {
    filtered = filtered.filter((c) => c.entity_type === entityFilter);
  }

  if (timeFilter !== "all") {
    const now = new Date();
    const cutoff =
      timeFilter === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(
      (c) => new Date(c.created_at) >= cutoff
    );
  }

  if (comments.length === 0) {
    return (
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Activity</h1>
        <EmptyState
          title="No activity yet"
          description="Comments and discussions across the system will appear here."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Activity</h1>
        <div className="flex items-center gap-2">
          {/* Time filter */}
          <div className="flex bg-surface border border-line rounded-lg overflow-hidden">
            {(["all", "today", "week"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeFilter === f
                    ? "bg-accent text-white"
                    : "text-subtle hover:text-ink"
                }`}
              >
                {f === "all" ? "All Time" : f === "today" ? "Today" : "This Week"}
              </button>
            ))}
          </div>
          {/* Entity type filter */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs border border-line rounded-lg px-2 py-1.5 bg-surface"
          >
            <option value="all">All types</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {entityTypeLabels[type] ?? type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            title="No matching activity"
            description="Try adjusting your filters."
          />
        ) : (
          filtered.map((comment) => (
            <ActivityItem key={comment.id} comment={comment} />
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-subtle text-center mt-4">
          Showing {filtered.length} of {comments.length} comments
        </p>
      )}
    </div>
  );
}
