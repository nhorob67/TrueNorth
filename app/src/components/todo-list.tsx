"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList({
  entityId,
  entityType,
  orgId,
}: {
  entityId: string;
  entityType: string;
  orgId: string;
}) {
  const supabase = createClient();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");

  async function loadTodos() {
    const { data } = await supabase
      .from("todos")
      .select("id, title, completed")
      .eq("linked_entity_id", entityId)
      .eq("linked_entity_type", entityType)
      .order("created_at");
    if (data) setTodos(data);
  }

  useEffect(() => {
    loadTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("todos").insert({
      organization_id: orgId,
      user_id: user!.id,
      title: title.trim(),
      linked_entity_id: entityId,
      linked_entity_type: entityType,
    });

    setTitle("");
    loadTodos();
  }

  async function toggleTodo(id: string, completed: boolean) {
    await supabase.from("todos").update({ completed: !completed }).eq("id", id);
    loadTodos();
  }

  return (
    <div className="space-y-1.5">
      {todos.map((todo) => (
        <label
          key={todo.id}
          className="flex items-center gap-2 text-sm cursor-pointer"
        >
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id, todo.completed)}
            className="rounded border-warm-border text-moss focus:ring-moss/20"
          />
          <span className={todo.completed ? "line-through text-warm-gray" : ""}>
            {todo.title}
          </span>
        </label>
      ))}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a sub-task..."
          className="flex-1 rounded-lg border border-warm-border bg-ivory px-2 py-1 text-xs focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20"
        />
      </form>
    </div>
  );
}
