"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ENTITY_ROUTE_MAP } from "@/lib/format";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type SearchResult = {
  id: string;
  type: string;
  label: string;
};

const NAVIGATE_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Strategy — Vision", href: "/strategy/vision" },
  { label: "Strategy — Scoreboard", href: "/strategy/scoreboard" },
  { label: "Strategy — Portfolio", href: "/strategy/portfolio" },
  { label: "Execution — Bets", href: "/execution/bets" },
  { label: "Execution — Ideas", href: "/execution/ideas" },
  { label: "Execution — Funnels", href: "/execution/funnels" },
  { label: "Execution — Content", href: "/execution/content" },
  { label: "Reviews — Sync", href: "/reviews/sync" },
  { label: "Reviews — Operations", href: "/reviews/operations" },
  { label: "Reviews — Health", href: "/reviews/health" },
  { label: "Reviews — Narratives", href: "/reviews/narratives" },
  { label: "Library — Processes", href: "/library/processes" },
  { label: "Library — Artifacts", href: "/library/artifacts" },
  { label: "Activity", href: "/activity" },
  { label: "Todos", href: "/todos" },
];

const CREATE_ITEMS = [
  { label: "New Bet", href: "/execution/bets/new" },
  { label: "New KPI", href: "/strategy/scoreboard/new" },
  { label: "New Process", href: "/library/processes/new" },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const filteredNav = useMemo(
    () =>
      query
        ? NAVIGATE_ITEMS.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase())
          )
        : NAVIGATE_ITEMS.slice(0, 6),
    [query]
  );

  const filteredCreate = useMemo(
    () =>
      query
        ? CREATE_ITEMS.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase())
          )
        : CREATE_ITEMS,
    [query]
  );

  const allItems = useMemo(
    () => [
      ...filteredNav.map((i) => ({ ...i, section: "nav" as const })),
      ...filteredCreate.map((i) => ({ ...i, section: "create" as const })),
      ...results.map((r) => ({
        label: `${r.type}: ${r.label}`,
        href: `${ENTITY_ROUTE_MAP[r.type] ?? "/"}/${r.id}`,
        section: "result" as const,
      })),
    ],
    [filteredNav, filteredCreate, results]
  );

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/entities/search?q=${encodeURIComponent(query)}&fuzzy=1`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // aborted or network error
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timeout);
      abortRef.current?.abort();
    };
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault();
      navigate(allItems[selectedIndex].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  const clampedIndex = Math.min(selectedIndex, Math.max(0, allItems.length - 1));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 bg-ink/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-50 w-full max-w-lg mx-4 bg-surface border border-line rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <svg className="w-5 h-5 text-subtle flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or jump to..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-faded outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          )}
          <kbd className="hidden sm:inline-block text-[10px] font-mono text-faded border border-line rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {filteredNav.length > 0 && (
            <div>
              <p className="px-4 py-1 text-[10px] font-mono uppercase tracking-wider text-faded">
                Navigate
              </p>
              {filteredNav.map((item, i) => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    clampedIndex === i
                      ? "bg-accent/10 text-accent"
                      : "text-ink hover:bg-hovered"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {filteredCreate.length > 0 && (
            <div>
              <p className="px-4 py-1 mt-1 text-[10px] font-mono uppercase tracking-wider text-faded">
                Create
              </p>
              {filteredCreate.map((item, i) => {
                const idx = filteredNav.length + i;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      clampedIndex === idx
                        ? "bg-accent/10 text-accent"
                        : "text-ink hover:bg-hovered"
                    }`}
                  >
                    + {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {results.length > 0 && (
            <div>
              <p className="px-4 py-1 mt-1 text-[10px] font-mono uppercase tracking-wider text-faded">
                Results
              </p>
              {results.map((r, i) => {
                const idx = filteredNav.length + filteredCreate.length + i;
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() =>
                      navigate(
                        `${ENTITY_ROUTE_MAP[r.type] ?? "/"}/${r.id}`
                      )
                    }
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      clampedIndex === idx
                        ? "bg-accent/10 text-accent"
                        : "text-ink hover:bg-hovered"
                    }`}
                  >
                    <span className="font-mono text-[10px] uppercase text-faded mr-2">
                      {r.type}
                    </span>
                    {r.label}
                  </button>
                );
              })}
            </div>
          )}

          {query.length >= 2 && results.length === 0 && !loading && (
            <p className="px-4 py-3 text-sm text-subtle text-center">
              No results found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
