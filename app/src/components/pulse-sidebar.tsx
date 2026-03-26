"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================
// Pulse Sidebar
//
// Shown alongside the pulse entry form. Contains:
// 1. User's pending to-dos (for quick reference while writing)
// 2. Active Recurring Moves with cycle progress (rhythms)
//
// BUILDPLAN: "Pulse sidebar integration: to-do list visible during
// pulse entry" + "Recurring Move sidebar in pulse entry"
// ============================================================

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: "high" | "medium" | "low" | null;
  linked_entity_type: string | null;
}

interface RecurringMoveRhythm {
  id: string;
  title: string;
  cadence: string;
  target_per_cycle: number | null;
  bet_outcome: string;
  health_status: "green" | "yellow" | "red";
  instances_completed: number;
  instances_total: number;
}

const priorityColors: Record<string, string> = {
  high: "text-semantic-brick",
  medium: "text-semantic-ochre",
  low: "text-subtle",
};

export function PulseSidebar({
  todos,
  rhythms,
}: {
  todos: Todo[];
  rhythms: RecurringMoveRhythm[];
}) {
  const supabase = createClient();
  const [localTodos, setLocalTodos] = useState(todos);

  async function toggleTodo(id: string, completed: boolean) {
    await supabase.from("todos").update({ completed: !completed }).eq("id", id);
    setLocalTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
    );
  }

  const pendingTodos = localTodos.filter((t) => !t.completed);
  const overdueTodos = pendingTodos.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date()
  );

  return (
    <div className="space-y-4">
      {/* To-Do List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-subtle uppercase">
              My To-Dos
            </h3>
            {pendingTodos.length > 0 && (
              <span className="text-xs text-subtle">
                {pendingTodos.length} pending
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendingTodos.length === 0 ? (
            <p className="text-xs text-subtle">All caught up!</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {/* Show overdue first */}
              {overdueTodos.length > 0 && (
                <p className="text-[10px] font-semibold text-semantic-brick uppercase tracking-wide">
                  Overdue
                </p>
              )}
              {overdueTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={toggleTodo}
                  isOverdue
                />
              ))}
              {overdueTodos.length > 0 && pendingTodos.length > overdueTodos.length && (
                <p className="text-[10px] font-semibold text-subtle uppercase tracking-wide mt-2">
                  Upcoming
                </p>
              )}
              {pendingTodos
                .filter((t) => !overdueTodos.includes(t))
                .map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={toggleTodo}
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Rhythms */}
      {rhythms.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-xs font-semibold text-subtle uppercase">
              Active Rhythms
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {rhythms.map((rhythm) => (
                <RhythmItem key={rhythm.id} rhythm={rhythm} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TodoItem({
  todo,
  onToggle,
  isOverdue,
}: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  isOverdue?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-xs cursor-pointer group">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id, todo.completed)}
        className="mt-0.5 rounded border-line text-accent focus:ring-accent-glow/20"
      />
      <div className="flex-1 min-w-0">
        <span
          className={`block truncate ${
            isOverdue ? "text-semantic-brick" : "text-ink"
          }`}
        >
          {todo.title}
        </span>
        <div className="flex items-center gap-2">
          {todo.due_date && (
            <span
              className={`text-[10px] ${
                isOverdue ? "text-semantic-brick" : "text-subtle"
              }`}
            >
              {isOverdue ? "Overdue: " : "Due: "}
              {new Date(todo.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {todo.priority && (
            <span
              className={`text-[10px] font-medium ${priorityColors[todo.priority] ?? "text-subtle"}`}
            >
              {todo.priority}
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

function RhythmItem({ rhythm }: { rhythm: RecurringMoveRhythm }) {
  const healthColors: Record<string, string> = {
    green: "bg-semantic-green",
    yellow: "bg-semantic-ochre",
    red: "bg-semantic-brick",
  };

  const cadenceLabels: Record<string, string> = {
    daily: "/day",
    weekly: "/wk",
    biweekly: "/2wk",
    monthly: "/mo",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${healthColors[rhythm.health_status] ?? "bg-faded"}`}
          />
          <span className="text-xs text-ink truncate">
            {rhythm.title}
          </span>
        </div>
        <span className="text-[10px] text-subtle flex-shrink-0">
          {rhythm.instances_completed}
          {rhythm.target_per_cycle != null
            ? `/${rhythm.target_per_cycle}`
            : `/${rhythm.instances_total}`}
          {cadenceLabels[rhythm.cadence] ?? ""}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: rhythm.instances_total }).map((_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < rhythm.instances_completed
                ? healthColors[rhythm.health_status] ?? "bg-accent"
                : "bg-line/50"
            }`}
          />
        ))}
      </div>

      <p className="text-[10px] text-subtle truncate">
        {rhythm.bet_outcome}
      </p>
    </div>
  );
}
