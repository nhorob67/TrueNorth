"use client";

import type { Citation } from "@/types/database";

interface CitationPillProps {
  citation: Citation;
  index: number;
  onClick?: (citation: Citation) => void;
}

export function CitationPill({ citation, index, onClick }: CitationPillProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      className="inline-flex items-center gap-0.5 text-[11px] font-mono text-accent hover:text-accent-warm bg-accent/8 hover:bg-accent/15 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
      title={citation.title}
    >
      [{index}]
    </button>
  );
}
