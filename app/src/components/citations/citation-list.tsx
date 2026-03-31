"use client";

import type { Citation } from "@/types/database";

interface CitationListProps {
  citations: Citation[];
  onSelect?: (citation: Citation) => void;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  internal_entity: "Internal",
  upload: "Upload",
  web_page: "Web",
  connector: "Connector",
};

export function CitationList({ citations, onSelect }: CitationListProps) {
  if (citations.length === 0) return null;

  return (
    <div className="border-t border-line pt-3 mt-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.10em] text-faded mb-2">
        Sources
      </p>
      <ol className="space-y-1.5">
        {citations.map((citation, i) => (
          <li key={citation.id} className="flex items-start gap-2 text-xs">
            <span className="font-mono text-accent shrink-0 mt-0.5">
              [{i + 1}]
            </span>
            <div className="min-w-0 flex-1">
              {citation.href ? (
                <a
                  href={citation.href}
                  onClick={(e) => {
                    if (onSelect) {
                      e.preventDefault();
                      onSelect(citation);
                    }
                  }}
                  className="text-ink hover:text-accent transition-colors font-medium"
                >
                  {citation.title}
                </a>
              ) : (
                <span className="text-ink font-medium">{citation.title}</span>
              )}
              <span className="text-faded ml-1.5">
                {SOURCE_TYPE_LABELS[citation.sourceType] ?? citation.sourceType}
              </span>
              {citation.snippet && (
                <p className="text-subtle mt-0.5 line-clamp-1">
                  {citation.snippet}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
