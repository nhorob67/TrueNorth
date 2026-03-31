"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/loading";

interface KnowledgeSourceSummary {
  id: string;
  name: string;
  source_type: string;
  connector_type: string | null;
  status: string;
  visibility: string;
  last_synced_at: string | null;
  last_sync_status: string | null;
  document_count: number;
}

interface SearchResult {
  documentId: string;
  chunkId: string;
  title: string;
  snippet: string;
  sourceType: string;
  sourceTitle: string;
  entityType: string | null;
  freshness: string | null;
  score: number;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  internal_entity: "Internal",
  upload: "Upload",
  web_page: "Web",
  connector: "Connector",
};

const STATUS_COLORS: Record<string, "green" | "yellow" | "red" | "neutral"> = {
  active: "green",
  paused: "yellow",
  error: "red",
};

export function KnowledgeView({
  sources,
  isAdmin,
}: {
  sources: KnowledgeSourceSummary[];
  isAdmin: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(
        `/api/knowledge/search?q=${encodeURIComponent(searchQuery)}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch {
      // Network error
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          Knowledge
        </h1>
        <p className="text-sm text-subtle mt-1">
          Search across your organization&apos;s internal data and connected sources.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="flex-1 bg-well text-sm text-ink rounded-[8px] border border-line px-4 py-2.5 placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleSearch}
            disabled={searchQuery.length < 2 || searching}
            className="bg-cta text-white text-sm font-medium rounded-[8px] px-5 py-2.5 hover:bg-accent-warm transition-colors disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Search results */}
      {hasSearched && (
        <div className="mb-8">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.10em] text-faded mb-3">
            Search Results
          </h2>
          {searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((result) => (
                <Card key={result.chunkId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink text-sm">
                        {result.title}
                      </h3>
                      <p className="text-sm text-subtle mt-1 line-clamp-2">
                        {result.snippet}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge status="neutral">
                        {SOURCE_TYPE_LABELS[result.sourceType] ??
                          result.sourceType}
                      </Badge>
                      {result.entityType && (
                        <Badge status="neutral">{result.entityType}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-faded">
                    <span>Source: {result.sourceTitle}</span>
                    {result.freshness && (
                      <span>
                        Updated:{" "}
                        {new Date(result.freshness).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No results found. Try a different search term." />
          )}
        </div>
      )}

      {/* Sources explorer */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.10em] text-faded">
            Knowledge Sources
          </h2>
          {isAdmin && (
            <span className="text-xs text-faded">
              Manage sources in Admin settings
            </span>
          )}
        </div>

        {sources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sources.map((source) => (
              <Card key={source.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-ink text-sm">
                    {source.name}
                  </h3>
                  <Badge
                    status={STATUS_COLORS[source.status] ?? "neutral"}
                  >
                    {source.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Badge status="neutral">
                    {SOURCE_TYPE_LABELS[source.source_type] ??
                      source.source_type}
                  </Badge>
                  <Badge status="neutral">{source.visibility}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-faded">
                  <span>
                    <span className="font-semibold text-subtle">
                      {source.document_count}
                    </span>{" "}
                    documents
                  </span>
                  {source.last_synced_at && (
                    <span>
                      Synced:{" "}
                      {new Date(source.last_synced_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No knowledge sources configured yet." />
        )}
      </div>
    </div>
  );
}
