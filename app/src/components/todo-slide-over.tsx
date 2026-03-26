"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SlideOver } from "@/components/ui/slide-over";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { isOverdue, PRIORITY_COLOR } from "@/lib/format";
import { labelColor } from "@/components/todo-detail-panel";

interface TodoSlideOverProps {
  open: boolean;
  onClose: () => void;
}

interface Todo {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  completed: boolean;
  linked_entity_type: string | null;
  labels: string[];
}

const supabase = createClient();

export function TodoSlideOver({ open, onClose }: TodoSlideOverProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();
  const ctx = useUserContext();

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("todos")
      .select("id, title, priority, due_date, completed, linked_entity_type, labels")
      .eq("user_id", ctx.userId)
      .eq("completed", false)
      .order("due_date")
      .limit(30);
    setTodos(data ?? []);
    setLoading(false);
  }, [ctx.userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) fetchTodos();
  }, [open, fetchTodos]);

  async function toggleTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("todos").update({ completed: true }).eq("id", id);
    router.refresh();
  }

  async function addTodo() {
    if (!newTitle.trim()) return;
    await supabase.from("todos").insert({
      title: newTitle.trim(),
      user_id: ctx.userId,
      organization_id: ctx.orgId,
      venture_id: ctx.ventureId,
      priority: "medium",
      completed: false,
      visibility: "private",
    });
    setNewTitle("");
    fetchTodos();
    router.refresh();
  }

  const overdue = todos.filter((t) => isOverdue(t.due_date));
  const upcoming = todos.filter((t) => !isOverdue(t.due_date));

  return (
    <SlideOver open={open} onClose={onClose} title="Todos">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-well rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div>
              <p className="text-xs font-medium text-semantic-brick mb-2">
                Overdue ({overdue.length})
              </p>
              <div className="space-y-1">
                {overdue.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} />
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-medium text-subtle mb-2">
                Upcoming ({upcoming.length})
              </p>
              <div className="space-y-1">
                {upcoming.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} />
                ))}
              </div>
            </div>
          )}

          {todos.length === 0 && (
            <p className="text-sm text-subtle text-center py-4">
              No active todos.
            </p>
          )}

          <div className="pt-2 border-t border-line">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTodo();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Add a todo..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 bg-well text-sm rounded-lg px-3 py-2 text-ink placeholder:text-faded outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-3 py-2 bg-accent text-white text-sm rounded-lg font-medium disabled:opacity-40 transition-opacity"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      )}
    </SlideOver>
  );
}

function TodoItem({
  todo,
  onToggle,
}: {
  todo: Todo;
  onToggle: (id: string) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-hovered cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={false}
        onChange={() => onToggle(todo.id)}
        className="mt-0.5 rounded border-line accent-accent"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm">{todo.title}</span>
        {todo.labels && todo.labels.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            {todo.labels.slice(0, 2).map((label) => (
              <span
                key={label}
                className={`rounded-full px-1.5 py-px text-[10px] font-medium ${labelColor(label)}`}
              >
                {label}
              </span>
            ))}
            {todo.labels.length > 2 && (
              <span className="text-[10px] text-subtle">+{todo.labels.length - 2}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          {todo.due_date && (
            <span
              className={`text-xs ${isOverdue(todo.due_date) ? "text-semantic-brick font-medium" : "text-subtle"}`}
            >
              {new Date(todo.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          <span
            className={`text-xs ${PRIORITY_COLOR[todo.priority as keyof typeof PRIORITY_COLOR] ?? "text-subtle"}`}
          >
            {todo.priority}
          </span>
          {todo.linked_entity_type && (
            <Badge status="neutral">
              {todo.linked_entity_type}
            </Badge>
          )}
        </div>
      </div>
    </label>
  );
}
