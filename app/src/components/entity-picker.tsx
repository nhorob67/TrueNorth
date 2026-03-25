"use client";

import { useState, useEffect, useRef } from "react";

interface EntityResult {
  id: string;
  type: string;
  label: string;
}

interface EntityPickerProps {
  entityTypes?: string[];
  onSelect: (entityType: string, entityId: string, label: string) => void;
  placeholder?: string;
  className?: string;
}

const typeColors: Record<string, string> = {
  bet: "bg-accent/10 text-accent",
  kpi: "bg-semantic-green/10 text-semantic-green-text",
  move: "bg-semantic-ochre/10 text-semantic-ochre-text",
  blocker: "bg-semantic-brick/10 text-semantic-brick",
  decision: "bg-brass/10 text-brass-text",
  commitment: "bg-accent-dim text-accent",
  issue: "bg-faded/10 text-subtle",
};

export function EntityPicker({
  entityTypes,
  onSelect,
  placeholder = "Search entities...",
  className = "",
}: EntityPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q: query });
      if (entityTypes?.length) params.set("types", entityTypes.join(","));

      const res = await fetch(`/api/entities/search?${params}`);
      const data = await res.json();
      setResults(data);
      setOpen(true);
      setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, entityTypes]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
      />
      {loading && (
        <div className="absolute right-2 top-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-moss" />
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-line bg-surface shadow-lg max-h-60 overflow-auto">
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              type="button"
              onClick={() => {
                onSelect(result.type, result.id, result.label);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-canvas flex items-center gap-2"
            >
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeColors[result.type] ?? "bg-faded/10 text-subtle"}`}
              >
                {result.type}
              </span>
              <span className="truncate">{result.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
