"use client";

import { useEffect, useRef } from "react";
import type { Citation } from "@/types/database";

interface CitationDrawerProps {
  citation: Citation | null;
  onClose: () => void;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  internal_entity: "Internal Data",
  upload: "Uploaded File",
  web_page: "Web Page",
  connector: "Connected Service",
};

export function CitationDrawer({ citation, onClose }: CitationDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (citation) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [citation, onClose]);

  if (!citation) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/20 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface border-l border-line shadow-xl overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                {citation.title}
              </h2>
              <p className="text-xs text-faded mt-1">
                {SOURCE_TYPE_LABELS[citation.sourceType] ?? citation.sourceType}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-faded hover:text-ink transition-colors p-1"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Snippet */}
          {citation.snippet && (
            <div className="mb-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.10em] text-faded mb-2">
                Excerpt
              </p>
              <div className="bg-well rounded-[8px] p-3 text-sm text-ink leading-relaxed">
                {citation.snippet}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-3 text-sm">
            {citation.anchorLabel && (
              <div>
                <span className="text-faded">Anchor:</span>{" "}
                <span className="text-ink">{citation.anchorLabel}</span>
              </div>
            )}
            <div>
              <span className="text-faded">Retrieved:</span>{" "}
              <span className="text-ink">
                {new Date(citation.retrievedAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Open source action */}
          {citation.href && (
            <a
              href={citation.href}
              className="mt-6 inline-flex items-center gap-2 bg-cta text-white text-sm font-medium rounded-[8px] px-4 py-2 hover:bg-accent-warm transition-colors"
            >
              Open source
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </>
  );
}
