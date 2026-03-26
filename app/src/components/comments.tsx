"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/components/mention-input";

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

// ============================================================
// Single Comment
// ============================================================

function CommentItem({
  comment,
  replies,
  currentUserId,
  entityOwnerId,
  onReply,
  onResolve,
}: {
  comment: Comment;
  replies: Comment[];
  currentUserId: string;
  entityOwnerId?: string;
  onReply: (parentId: string) => void;
  onResolve: (commentId: string, resolved: boolean) => void;
}) {
  const authorName =
    (comment.user_profiles as { full_name: string } | null)?.full_name ??
    "Unknown";
  const canResolve =
    comment.author_id === currentUserId ||
    entityOwnerId === currentUserId;
  const isResolved = comment.resolved;

  return (
    <div
      className={`${isResolved ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        {/* Avatar placeholder */}
        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0 mt-0.5">
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">
              {authorName}
            </span>
            <span className="text-xs text-subtle" suppressHydrationWarning>
              {new Date(comment.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {isResolved && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-semantic-green/10 text-semantic-green-text font-medium">
                Resolved
              </span>
            )}
          </div>
          <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">
            {renderBodyWithMentions(comment.body)}
          </p>
          {/* Actions */}
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="text-xs text-subtle hover:text-accent transition-colors"
            >
              Reply
            </button>
            {canResolve && (
              <button
                type="button"
                onClick={() => onResolve(comment.id, !isResolved)}
                className="text-xs text-subtle hover:text-accent transition-colors"
              >
                {isResolved ? "Unresolve" : "Resolve"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies (single-level threading) */}
      {replies.length > 0 && (
        <div className="ml-8 mt-2 space-y-2 border-l-2 border-line pl-3">
          {replies.map((reply) => (
            <ReplyItem key={reply.id} reply={reply} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyItem({ reply }: { reply: Comment }) {
  const authorName =
    (reply.user_profiles as { full_name: string } | null)?.full_name ??
    "Unknown";

  return (
    <div className="flex items-start gap-2">
      <div className="w-5 h-5 rounded-full bg-faded/20 flex items-center justify-center text-[10px] font-semibold text-subtle flex-shrink-0 mt-0.5">
        {authorName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink">
            {authorName}
          </span>
          <span className="text-xs text-subtle" suppressHydrationWarning>
            {new Date(reply.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-xs text-ink mt-0.5 whitespace-pre-wrap">
          {renderBodyWithMentions(reply.body)}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Mention rendering helper
// ============================================================

function renderBodyWithMentions(body: string): React.ReactNode {
  // Highlight @Name mentions in the text
  const parts = body.split(/(@\w[\w\s]*?)(?=\s|$)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-accent font-medium">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// ============================================================
// Comment Compose Form
// ============================================================

function CommentCompose({
  onSubmit,
  onCancel,
  placeholder,
  autoFocus,
}: {
  onSubmit: (body: string, mentions: Array<{ userId: string; name: string }>) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<
    Array<{ userId: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    await onSubmit(body.trim(), mentions);
    setBody("");
    setMentions([]);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <MentionInput
        value={body}
        onChange={setBody}
        onMentionsChange={setMentions}
        placeholder={placeholder ?? "Add a comment... Use @ to mention someone"}
        className={autoFocus ? "" : ""}
      />
      <div className="flex gap-2 mt-2">
        <Button type="submit" size="sm" disabled={loading || !body.trim()}>
          {loading ? "Posting..." : "Post"}
        </Button>
        {onCancel && (
          <Button type="button" variant="tertiary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

// ============================================================
// Main Comments Component
// ============================================================

export function Comments({
  entityId,
  entityType,
  orgId,
  entityOwnerId,
  showResolved = false,
}: {
  entityId: string;
  entityType: string;
  orgId: string;
  entityOwnerId?: string;
  showResolved?: boolean;
}) {
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [showResolvedToggle, setShowResolvedToggle] = useState(showResolved);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("comments")
      .select("*, user_profiles(full_name)")
      .eq("entity_id", entityId)
      .eq("entity_type", entityType)
      .order("created_at", { ascending: true });

    if (data) {
      setComments(
        data.map((c: Record<string, unknown>) => ({
          ...c,
          mentions: (c.mentions ?? []) as Array<{ userId: string; name: string }>,
          user_profiles: Array.isArray(c.user_profiles)
            ? (c.user_profiles as Array<{ full_name: string }>)[0] ?? null
            : c.user_profiles,
        })) as Comment[]
      );
    }
  }, [supabase, entityId, entityType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadComments();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, [entityId, loadComments, supabase.auth]);

  async function handlePost(
    body: string,
    mentions: Array<{ userId: string; name: string }>,
    parentCommentId?: string
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("comments").insert({
      organization_id: orgId,
      entity_id: entityId,
      entity_type: entityType,
      author_id: user.id,
      body,
      mentions,
      parent_comment_id: parentCommentId ?? null,
    });

    // Send notifications for @mentions
    for (const mention of mentions) {
      if (mention.userId !== user.id) {
        await supabase.from("notifications").insert({
          organization_id: orgId,
          user_id: mention.userId,
          type: "mention",
          tier: "immediate",
          title: `${user.user_metadata?.full_name ?? "Someone"} mentioned you in a comment`,
          body: body.length > 100 ? body.slice(0, 100) + "..." : body,
          entity_id: entityId,
          entity_type: entityType,
        });
      }
    }

    setReplyingTo(null);
    loadComments();
  }

  async function handleResolve(commentId: string, resolved: boolean) {
    await supabase
      .from("comments")
      .update({ resolved })
      .eq("id", commentId);
    loadComments();
  }

  // Separate top-level comments from replies
  const topLevelComments = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = comments.reduce(
    (acc, c) => {
      if (c.parent_comment_id) {
        if (!acc[c.parent_comment_id]) acc[c.parent_comment_id] = [];
        acc[c.parent_comment_id].push(c);
      }
      return acc;
    },
    {} as Record<string, Comment[]>
  );

  const resolvedCount = topLevelComments.filter((c) => c.resolved).length;
  const visibleComments = showResolvedToggle
    ? topLevelComments
    : topLevelComments.filter((c) => !c.resolved);

  return (
    <div className="space-y-3">
      {/* Resolved toggle */}
      {resolvedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowResolvedToggle(!showResolvedToggle)}
          className="text-xs text-subtle hover:text-ink transition-colors"
        >
          {showResolvedToggle ? "Hide" : "Show"} {resolvedCount} resolved
        </button>
      )}

      {/* Comments list */}
      {visibleComments.length > 0 && (
        <div className="space-y-3">
          {visibleComments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                replies={repliesByParent[comment.id] ?? []}
                currentUserId={currentUserId}
                entityOwnerId={entityOwnerId}
                onReply={setReplyingTo}
                onResolve={handleResolve}
              />
              {/* Inline reply form */}
              {replyingTo === comment.id && (
                <div className="ml-8 mt-2">
                  <CommentCompose
                    onSubmit={(body, mentions) =>
                      handlePost(body, mentions, comment.id)
                    }
                    onCancel={() => setReplyingTo(null)}
                    placeholder="Write a reply..."
                    autoFocus
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      {replyingTo === null && (
        <CommentCompose
          onSubmit={(body, mentions) => handlePost(body, mentions)}
          placeholder="Add a comment... Use @ to mention someone"
        />
      )}
    </div>
  );
}
