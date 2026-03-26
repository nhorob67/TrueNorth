"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useOptionalUserContext } from "@/hooks/use-user-context";
import { getEntityHref } from "@/lib/format";
import { useRecentItems } from "@/hooks/use-recent-items";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenQuickTodo?: () => void;
  onOpenTodoSlideOver?: () => void;
}

type SearchResult = {
  id: string;
  type: string;
  label: string;
};

type NavItem = {
  label: string;
  href: string;
  keywords?: string[];
  adminOnly?: boolean;
};

type CreateItem = {
  label: string;
  keywords?: string[];
  shortcut?: string;
} & ({ href: string } | { action: () => void });

type ActionItem = {
  label: string;
  action: () => void;
  keywords?: string[];
  shortcut?: string;
};

type FlatItem = {
  label: string;
  section: "recent" | "nav" | "create" | "action" | "result";
  shortcut?: string;
} & ({ href: string } | { action: () => void });

const NAVIGATE_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Strategy — Vision", href: "/strategy/vision", keywords: ["bhag", "north star"] },
  { label: "Strategy — Scoreboard", href: "/strategy/scoreboard", keywords: ["kpi", "metrics"] },
  { label: "Strategy — Portfolio", href: "/strategy/portfolio", keywords: ["ventures"] },
  { label: "Strategy — Launch", href: "/strategy/launch", keywords: ["onboarding", "wizard"] },
  { label: "Execution — Bets", href: "/execution/bets", keywords: ["experiments", "hypotheses"] },
  { label: "Execution — Ideas", href: "/execution/ideas", keywords: ["vault", "submissions"] },
  { label: "Execution — Funnels", href: "/execution/funnels", keywords: ["acquisition", "conversion"] },
  { label: "Execution — Content", href: "/execution/content", keywords: ["writing", "publishing"] },
  { label: "Content Calendar", href: "/execution/content/calendar", keywords: ["schedule", "publishing"] },
  { label: "Bet Graveyard", href: "/execution/bets/graveyard", keywords: ["killed", "archived", "completed"] },
  { label: "Reviews — Sync", href: "/reviews/sync", keywords: ["meeting", "weekly"] },
  { label: "Reviews — Sync Monthly", href: "/reviews/sync/monthly", keywords: ["meeting"] },
  { label: "Reviews — Sync Quarterly", href: "/reviews/sync/quarterly", keywords: ["meeting"] },
  { label: "Reviews — Operations", href: "/reviews/operations", keywords: ["decisions", "blockers", "commitments", "issues"] },
  { label: "Reviews — Health", href: "/reviews/health", keywords: ["operating", "score"] },
  { label: "Reviews — Narratives", href: "/reviews/narratives", keywords: ["ai", "summary", "report"] },
  { label: "Reviews — Pulse", href: "/reviews/pulse", keywords: ["check-in", "streak", "weekly"] },
  { label: "Library — Processes", href: "/library/processes", keywords: ["workflows", "automation"] },
  { label: "Library — Artifacts", href: "/library/artifacts", keywords: ["documents", "staleness"] },
  { label: "Activity", href: "/activity", keywords: ["comments", "feed"] },
  { label: "Todos", href: "/todos", keywords: ["tasks"] },
  { label: "Profile", href: "/profile", keywords: ["role", "settings", "account"] },
  { label: "Admin — Settings", href: "/admin/settings", keywords: ["organization", "members", "invites"], adminOnly: true },
  { label: "Admin — AI Dashboard", href: "/admin/settings/ai-dashboard", keywords: ["agents", "copilot"], adminOnly: true },
  { label: "Admin — Agents", href: "/admin/settings/agents", keywords: ["team", "roster"], adminOnly: true },
  { label: "Admin — Policies", href: "/admin/settings/policies", keywords: ["rules", "enforcement"], adminOnly: true },
  { label: "Admin — Automation", href: "/admin/settings/automation", keywords: ["cron", "jobs"], adminOnly: true },
];

const DEFAULT_NAV_COUNT = 8;

function matchesQuery(q: string, label: string, keywords?: string[]): boolean {
  const lower = q.toLowerCase();
  if (label.toLowerCase().includes(lower)) return true;
  if (keywords?.some((kw) => kw.toLowerCase().includes(lower))) return true;
  return false;
}

export function CommandPalette({ open, onClose, onOpenQuickTodo, onOpenTodoSlideOver }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const { theme, setTheme } = useTheme();
  const ctx = useOptionalUserContext();
  const { recentItems, addRecentItem, clearRecentItems } = useRecentItems();

  const isAdmin = ctx?.orgRole === "admin";

  const createItems: CreateItem[] = useMemo(
    () => [
      { label: "New Bet", href: "/execution/bets/new" },
      { label: "New KPI", href: "/strategy/scoreboard/new", keywords: ["metric"] },
      { label: "New Process", href: "/library/processes/new", keywords: ["workflow"] },
      ...(onOpenQuickTodo
        ? [{ label: "New Todo", action: onOpenQuickTodo, keywords: ["task"], shortcut: "⌘T" } as CreateItem]
        : []),
      { label: "New Idea", href: "/execution/ideas", keywords: ["submission"] },
      { label: "New Content Piece", href: "/execution/content", keywords: ["writing", "draft"] },
      { label: "New Funnel", href: "/execution/funnels", keywords: ["acquisition"] },
    ],
    [onOpenQuickTodo]
  );

  const actionItems: ActionItem[] = useMemo(
    () => [
      {
        label: "Toggle theme",
        action: () => setTheme(theme === "dark" ? "light" : "dark"),
        keywords: ["dark", "light", "night", "mode"],
      },
      ...(onOpenTodoSlideOver
        ? [{
            label: "Open todos",
            action: onOpenTodoSlideOver,
            keywords: ["tasks", "slide"],
            shortcut: "⌘⇧T",
          }]
        : []),
      {
        label: "Copy page URL",
        action: () => { navigator.clipboard.writeText(window.location.href); },
        keywords: ["link", "share", "clipboard"],
      },
      {
        label: "Sign out",
        action: () => { createClient().auth.signOut().then(() => router.push("/login")); },
        keywords: ["logout", "log out"],
      },
    ],
    [theme, setTheme, onOpenTodoSlideOver, router]
  );

  const filteredNav = useMemo(() => {
    const items = NAVIGATE_ITEMS.filter((item) => !item.adminOnly || isAdmin);
    return query
      ? items.filter((item) => matchesQuery(query, item.label, item.keywords))
      : items.slice(0, DEFAULT_NAV_COUNT);
  }, [query, isAdmin]);

  const filteredCreate = useMemo(
    () =>
      query
        ? createItems.filter((item) => matchesQuery(query, item.label, item.keywords))
        : createItems,
    [query, createItems]
  );

  const filteredActions = useMemo(
    () =>
      query
        ? actionItems.filter((item) => matchesQuery(query, item.label, item.keywords))
        : actionItems,
    [query, actionItems]
  );

  const showRecent = !query && recentItems.length > 0;

  // Easter egg items that appear for specific search queries
  const easterEggs = useMemo((): FlatItem[] => {
    const q = query.toLowerCase().trim();
    if (q === "shiny object" || q === "shiny objects")
      return [{ label: "Nice try. Back to work.", section: "action", action: () => onClose() }];
    if (q === "bet #4" || q === "bet 4" || q === "fourth bet")
      return [{ label: "You already have 3. Kill one first, champ.", section: "action", action: () => { onClose(); router.push("/execution/bets/graveyard"); } }];
    if (q === "help" || q === "advice" || q === "wisdom")
      return [{ label: "Remember: the goal isn't to do everything. It's to do the right 3 things.", section: "action", action: () => onClose() }];
    return [];
  }, [query, onClose, router]);

  const allItems = useMemo((): FlatItem[] => {
    const resultItems: FlatItem[] = results.flatMap((r) => {
      const href = getEntityHref(r.type, r.id);
      return href
        ? [{
            label: `${r.type}: ${r.label}`,
            href,
            section: "result",
          }]
        : [];
    });

    return [
      ...easterEggs,
      ...(showRecent
        ? recentItems.map((i): FlatItem => ({ label: i.label, href: i.href, section: "recent" }))
        : []),
      ...filteredNav.map((i): FlatItem => ({ label: i.label, href: i.href, section: "nav" })),
      ...filteredCreate.map((i): FlatItem => ({
        label: i.label,
        section: "create",
        ...("href" in i ? { href: i.href } : { action: i.action }),
        shortcut: i.shortcut,
      })),
      ...filteredActions.map((i): FlatItem => ({
        label: i.label,
        section: "action",
        action: i.action,
        shortcut: i.shortcut,
      })),
      ...resultItems,
    ];
  }, [easterEggs, showRecent, recentItems, filteredNav, filteredCreate, filteredActions, results]);

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

  const execute = useCallback(
    (item: FlatItem) => {
      onClose();
      if ("action" in item && typeof item.action === "function") {
        item.action();
      } else if ("href" in item) {
        addRecentItem({ label: item.label, href: item.href });
        router.push(item.href);
      }
    },
    [onClose, router, addRecentItem]
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
      execute(allItems[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  const clampedIndex = Math.min(selectedIndex, Math.max(0, allItems.length - 1));

  if (!open) return null;

  // Build sections with global index tracking
  const sections: { key: string; title: string; startIdx: number; count: number; prefix?: string }[] = [];
  let offset = 0;

  if (showRecent) {
    sections.push({ key: "recent", title: "Recent", startIdx: offset, count: recentItems.length });
    offset += recentItems.length;
  }
  if (filteredNav.length > 0) {
    sections.push({ key: "nav", title: "Navigate", startIdx: offset, count: filteredNav.length });
    offset += filteredNav.length;
  }
  if (filteredCreate.length > 0) {
    sections.push({ key: "create", title: "Create", startIdx: offset, count: filteredCreate.length, prefix: "+ " });
    offset += filteredCreate.length;
  }
  if (filteredActions.length > 0) {
    sections.push({ key: "action", title: "Actions", startIdx: offset, count: filteredActions.length });
    offset += filteredActions.length;
  }
  if (results.length > 0) {
    sections.push({ key: "result", title: "Results", startIdx: offset, count: results.length });
  }

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

        <div className="max-h-80 overflow-y-auto py-2" aria-live="polite">
          {sections.map((section, sIdx) => (
            <div key={section.key}>
              <div className={`flex items-center justify-between px-4 py-1${sIdx > 0 ? " mt-1" : ""}`}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-faded">
                  {section.title}
                </p>
                {section.key === "recent" && (
                  <button
                    onClick={clearRecentItems}
                    className="text-[10px] font-mono text-faded hover:text-subtle transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {Array.from({ length: section.count }, (_, i) => {
                const globalIdx = section.startIdx + i;
                const item = allItems[globalIdx];
                return (
                  <button
                    key={`${item.section}-${globalIdx}`}
                    onClick={() => execute(item)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${
                      clampedIndex === globalIdx
                        ? "bg-accent/10 text-accent"
                        : "text-ink hover:bg-hovered"
                    }`}
                  >
                    <span>
                      {section.prefix}
                      {item.section === "result" ? (
                        <>
                          <span className="font-mono text-[10px] uppercase text-faded mr-2">
                            {item.label.split(": ")[0]}
                          </span>
                          {item.label.split(": ").slice(1).join(": ")}
                        </>
                      ) : (
                        item.label
                      )}
                    </span>
                    {item.shortcut && (
                      <kbd className="text-[10px] font-mono text-faded border border-line rounded px-1.5 py-0.5 ml-2">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {query.length >= 2 && !loading && sections.length === 0 && (
            <p className="px-4 py-3 text-sm text-subtle text-center">
              No results found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
