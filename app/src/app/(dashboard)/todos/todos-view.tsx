"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/loading";
import { TodoDetailPanel, labelColor } from "@/components/todo-detail-panel";
import type { Todo, TodoPriority } from "@/types/database";

// ============================================================
// Constants
// ============================================================

type StatusFilter = "all" | "active" | "completed";
type PriorityFilter = "all" | "high" | "medium" | "low";

interface TodoWithCounts extends Todo {
  checklist_total: number;
  checklist_done: number;
  comment_count: number;
}

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
  onSelect,
}: {
  todo: TodoWithCounts;
  onUpdate: () => void;
  onSelect: () => void;
}) {
  const supabase = createClient();
  const [toggling, setToggling] = useState(false);

  async function toggleCompleted(e: React.MouseEvent) {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    await supabase
      .from("todos")
      .update({ completed: !todo.completed, updated_at: new Date().toISOString() })
      .eq("id", todo.id);
    setToggling(false);
    onUpdate();
  }

  const isOverdue =
    !todo.completed &&
    todo.due_date &&
    new Date(todo.due_date) < new Date(new Date().toDateString());

  const MAX_LABELS = 3;

  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-2.5 group cursor-pointer hover:bg-hovered/50 transition-colors"
    >
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

      {/* Title + labels */}
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm ${
            todo.completed ? "line-through text-subtle" : "text-ink"
          }`}
        >
          {todo.title}
        </span>
        {/* Inline label pills */}
        {todo.labels.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            {todo.labels.slice(0, MAX_LABELS).map((label) => (
              <span
                key={label}
                className={`rounded-full px-1.5 py-px text-[10px] font-medium ${labelColor(label)}`}
              >
                {label}
              </span>
            ))}
            {todo.labels.length > MAX_LABELS && (
              <span className="text-[10px] text-subtle">+{todo.labels.length - MAX_LABELS}</span>
            )}
          </div>
        )}
      </div>

      {/* Badges / indicators */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Checklist progress */}
        {todo.checklist_total > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-subtle">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {todo.checklist_done}/{todo.checklist_total}
          </span>
        )}

        {/* Comment count */}
        {todo.comment_count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-subtle">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
            {todo.comment_count}
          </span>
        )}

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

        {/* Description indicator */}
        {todo.description && (
          <svg className="w-3.5 h-3.5 text-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main View
// ============================================================

export function TodosView({ todos: initialTodos, orgId }: { todos: TodoWithCounts[]; orgId: string }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

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
      // overdue items first
      const now = new Date();
      const aOverdue = a.due_date && new Date(a.due_date) < now && !a.completed ? 1 : 0;
      const bOverdue = b.due_date && new Date(b.due_date) < now && !b.completed ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
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

  const selectedTodo = selectedTodoId
    ? [...activeTodos, ...completedTodos].find((t) => t.id === selectedTodoId) ?? null
    : null;

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
              <TodoItem
                key={todo.id}
                todo={todo}
                onUpdate={refresh}
                onSelect={() => setSelectedTodoId(todo.id)}
              />
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
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    onUpdate={refresh}
                    onSelect={() => setSelectedTodoId(todo.id)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Detail panel */}
      <TodoDetailPanel
        todo={selectedTodo}
        onClose={() => setSelectedTodoId(null)}
        onUpdate={refresh}
        orgId={orgId}
      />
    </div>
  );
}
