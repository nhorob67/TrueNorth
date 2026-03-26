"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/loading";
import type { Todo, TodoPriority } from "@/types/database";

// ============================================================
// Constants
// ============================================================

type StatusFilter = "all" | "active" | "completed";
type PriorityFilter = "all" | "high" | "medium" | "low";

const priorityBadgeClasses: Record<TodoPriority, string> = {
  high: "bg-semantic-brick/10 text-semantic-brick",
  medium: "bg-semantic-ochre/10 text-semantic-ochre-text",
  low: "bg-faded/10 text-subtle",
};

const priorityOrder: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const entityTypeLabels: Record<string, string> = {
  bet: "Bet",
  kpi: "KPI",
  move: "Move",
  move_instance: "Move Instance",
  idea: "Idea",
  funnel: "Funnel",
  decision: "Decision",
  blocker: "Blocker",
  commitment: "Commitment",
  issue: "Issue",
  process: "Process",
  content_piece: "Content",
  todo: "Todo",
};

// ============================================================
// Entity Search Hook
// ============================================================

interface EntityResult {
  id: string;
  type: string;
  label: string;
}

function useEntitySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (q.length < 1) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/entities/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      }
      setIsSearching(false);
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsSearching(false);
  }, []);

  return { query, results, isSearching, search, clear };
}

// ============================================================
// Quick Add Form
// ============================================================

function QuickAddForm({ onAdded }: { onAdded: () => void }) {
  const supabase = createClient();
  const { userId, orgId } = useUserContext();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [linkedEntity, setLinkedEntity] = useState<EntityResult | null>(null);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const entitySearch = useEntitySearch();
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close entity picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEntityPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);

    await supabase.from("todos").insert({
      organization_id: orgId,
      user_id: userId,
      title: title.trim(),
      due_date: dueDate || null,
      priority,
      linked_entity_id: linkedEntity?.id ?? null,
      linked_entity_type: linkedEntity?.type ?? null,
    });

    setTitle("");
    setDueDate("");
    setPriority("medium");
    setLinkedEntity(null);
    entitySearch.clear();
    setSubmitting(false);
    titleRef.current?.focus();
    onAdded();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Card>
      <CardContent className="py-3">
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="flex items-center gap-2">
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a new todo..."
              className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
            />
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>

          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {/* Due date */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-subtle">Due:</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded border border-line bg-canvas px-2 py-1 text-xs text-ink focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-accent-glow/20"
              />
            </div>

            {/* Priority */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-subtle">Priority:</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TodoPriority)}
                className="rounded border border-line bg-canvas px-2 py-1 text-xs text-ink focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-accent-glow/20"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Entity link */}
            <div className="relative flex items-center gap-1.5" ref={pickerRef}>
              {linkedEntity ? (
                <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                  {entityTypeLabels[linkedEntity.type] ?? linkedEntity.type}: {linkedEntity.label}
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedEntity(null);
                      entitySearch.clear();
                    }}
                    className="ml-0.5 text-accent/60 hover:text-accent"
                  >
                    x
                  </button>
                </span>
              ) : (
                <>
                  <label className="text-xs text-subtle">Link:</label>
                  <input
                    type="text"
                    value={entitySearch.query}
                    onChange={(e) => {
                      entitySearch.search(e.target.value);
                      setShowEntityPicker(true);
                    }}
                    onFocus={() => entitySearch.query && setShowEntityPicker(true)}
                    placeholder="Search entities..."
                    className="w-40 rounded border border-line bg-canvas px-2 py-1 text-xs text-ink focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-accent-glow/20"
                  />
                  {showEntityPicker && entitySearch.results.length > 0 && (
                    <div className="absolute top-full left-0 z-10 mt-1 w-64 rounded-lg border border-line bg-surface shadow-lg">
                      {entitySearch.results.map((r) => (
                        <button
                          key={`${r.type}-${r.id}`}
                          type="button"
                          onClick={() => {
                            setLinkedEntity(r);
                            setShowEntityPicker(false);
                            entitySearch.clear();
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-canvas transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                          <span className="rounded bg-faded/10 px-1.5 py-0.5 text-[10px] font-medium text-subtle uppercase">
                            {r.type}
                          </span>
                          <span className="truncate text-ink">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <span className="text-[10px] text-subtle ml-auto hidden sm:inline">
              Cmd+Enter to submit
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Todo Item
// ============================================================

function TodoItem({
  todo,
  onUpdate,
}: {
  todo: Todo;
  onUpdate: () => void;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [toggling, setToggling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function toggleCompleted() {
    if (toggling) return;
    setToggling(true);
    await supabase
      .from("todos")
      .update({ completed: !todo.completed, updated_at: new Date().toISOString() })
      .eq("id", todo.id);
    setToggling(false);
    onUpdate();
  }

  async function saveTitle() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === todo.title) {
      setEditTitle(todo.title);
      setEditing(false);
      return;
    }
    await supabase
      .from("todos")
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq("id", todo.id);
    setEditing(false);
    onUpdate();
  }

  async function handleDelete() {
    await supabase.from("todos").delete().eq("id", todo.id);
    onUpdate();
  }

  const isOverdue =
    !todo.completed &&
    todo.due_date &&
    new Date(todo.due_date) < new Date(new Date().toDateString());

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group">
      {/* Checkbox */}
      <button
        onClick={toggleCompleted}
        disabled={toggling}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
          todo.completed
            ? "bg-accent border-accent text-white"
            : "border-line hover:border-accent"
        }`}
      >
        {todo.completed && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setEditTitle(todo.title);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-accent bg-canvas px-2 py-0.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent-glow/20"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={`text-left text-sm truncate max-w-full ${
              todo.completed ? "line-through text-subtle" : "text-ink"
            }`}
          >
            {todo.title}
          </button>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Priority badge */}
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${priorityBadgeClasses[todo.priority]}`}
        >
          {todo.priority}
        </span>

        {/* Due date */}
        {todo.due_date && (
          <span
            className={`text-xs ${
              isOverdue ? "text-semantic-brick font-medium" : "text-subtle"
            }`}
          >
            {new Date(todo.due_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}

        {/* Linked entity */}
        {todo.linked_entity_type && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {entityTypeLabels[todo.linked_entity_type] ?? todo.linked_entity_type}
          </span>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-subtle hover:text-semantic-brick transition-all p-0.5"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function TodosView({ todos: initialTodos }: { todos: Todo[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  function refresh() {
    router.refresh();
  }

  // Apply filters
  let filtered = initialTodos;

  if (statusFilter === "active") {
    filtered = filtered.filter((t) => !t.completed);
  } else if (statusFilter === "completed") {
    filtered = filtered.filter((t) => t.completed);
  }

  if (priorityFilter !== "all") {
    filtered = filtered.filter((t) => t.priority === priorityFilter);
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((t) => t.title.toLowerCase().includes(q));
  }

  // Split into active & completed
  const activeTodos = filtered
    .filter((t) => !t.completed)
    .sort((a, b) => {
      // high priority first
      const pDiff = (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
      if (pDiff !== 0) return pDiff;
      // earlier due date first, nulls last
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      // newer first
      return b.created_at.localeCompare(a.created_at);
    });

  const completedTodos = filtered
    .filter((t) => t.completed)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">Todos</h1>
        <span className="text-sm text-subtle">
          {activeTodos.length} active{completedTodos.length > 0 ? `, ${completedTodos.length} completed` : ""}
        </span>
      </div>

      {/* Quick Add */}
      <div className="mb-4">
        <QuickAddForm onAdded={refresh} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Status filter */}
        <div className="flex bg-surface border border-line rounded-lg overflow-hidden">
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f
                  ? "bg-accent text-white"
                  : "text-subtle hover:text-ink"
              }`}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Completed"}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          className="text-xs border border-line rounded-lg px-2 py-1.5 bg-surface text-ink"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search todos..."
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-accent-glow/20 w-48"
        />
      </div>

      {/* Empty state */}
      {initialTodos.length === 0 && (
        <EmptyState
          title="Inbox zero, todo zero"
          description="You either just finished everything or haven't started. Either way, your future self is about to add something here."
        />
      )}

      {/* Active todos */}
      {activeTodos.length > 0 && (
        <Card className="mb-4">
          <div className="divide-y divide-line">
            {activeTodos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} onUpdate={refresh} />
            ))}
          </div>
        </Card>
      )}

      {/* No results after filtering */}
      {initialTodos.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="No matching todos"
          description="Try adjusting your filters."
        />
      )}

      {/* Completed section */}
      {completedTodos.length > 0 && statusFilter !== "active" && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm font-medium text-subtle hover:text-ink transition-colors mb-2"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showCompleted ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            {completedTodos.length} completed
          </button>

          {showCompleted && (
            <Card>
              <div className="divide-y divide-line">
                {completedTodos.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onUpdate={refresh} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
