"use client";

// ============================================================
// Version Diff View
//
// PRD Section 3.3: Side-by-side or inline diff between versions.
// Simple line-based diff with added/removed highlighting.
// ============================================================

interface DiffLine {
  type: "same" | "added" | "removed";
  text: string;
}

/**
 * Simple line diff: compares two text strings line by line.
 * Uses a basic LCS-like approach for small documents.
 */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Build a simple LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: "same", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", text: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", text: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

/**
 * Extract plain text from Tiptap JSON or HTML for diffing.
 */
function extractTextFromJson(json: Record<string, unknown>): string {
  if (!json || typeof json !== "object") return "";

  function walk(node: Record<string, unknown>): string {
    if (node.type === "text") return (node.text as string) ?? "";
    const children = node.content as Record<string, unknown>[] | undefined;
    if (!children || !Array.isArray(children)) {
      // For block nodes without content, return a newline
      if (node.type && node.type !== "doc") return "\n";
      return "";
    }
    const texts = children.map(walk);
    // Add newline after block elements
    const blockTypes = ["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "horizontalRule", "table"];
    if (blockTypes.includes(node.type as string)) {
      return texts.join("") + "\n";
    }
    return texts.join("");
  }

  return walk(json).trim();
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function VersionDiff({
  oldVersion,
  newVersion,
  onClose,
}: {
  oldVersion: { body_json?: Record<string, unknown>; body_html?: string; created_at: string };
  newVersion: { body_json?: Record<string, unknown>; body_html?: string; label: string };
  onClose: () => void;
}) {
  const oldText =
    oldVersion.body_json && Object.keys(oldVersion.body_json).length > 0
      ? extractTextFromJson(oldVersion.body_json)
      : oldVersion.body_html
        ? stripHtmlTags(oldVersion.body_html)
        : "(empty)";

  const newText =
    newVersion.body_json && Object.keys(newVersion.body_json).length > 0
      ? extractTextFromJson(newVersion.body_json)
      : newVersion.body_html
        ? stripHtmlTags(newVersion.body_html)
        : "(empty)";

  const diffLines = computeLineDiff(oldText, newText);

  const addedCount = diffLines.filter((d) => d.type === "added").length;
  const removedCount = diffLines.filter((d) => d.type === "removed").length;

  return (
    <div className="border border-warm-border rounded-lg bg-ivory overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-parchment border-b border-warm-border">
        <div className="flex items-center gap-3">
          <h4 className="text-xs font-semibold text-charcoal">Version Diff</h4>
          <span className="text-xs text-warm-gray">
            {new Date(oldVersion.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {" vs "}
            {newVersion.label}
          </span>
          <span className="text-xs text-semantic-green-text">+{addedCount}</span>
          <span className="text-xs text-semantic-brick">-{removedCount}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-warm-gray hover:text-charcoal transition-colors"
        >
          Close
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto font-mono text-xs leading-relaxed">
        {diffLines.map((line, idx) => (
          <div
            key={idx}
            className={`px-3 py-0.5 ${
              line.type === "added"
                ? "bg-semantic-green/10 text-semantic-green-text"
                : line.type === "removed"
                  ? "bg-semantic-brick/10 text-semantic-brick"
                  : "text-charcoal"
            }`}
          >
            <span className="inline-block w-4 text-warm-gray select-none">
              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            </span>
            {line.text || "\u00A0"}
          </div>
        ))}
        {diffLines.length === 0 && (
          <p className="px-3 py-4 text-warm-gray text-center">No differences found.</p>
        )}
      </div>
    </div>
  );
}
