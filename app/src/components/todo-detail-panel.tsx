"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SlideOver } from "@/components/ui/slide-over";
import { Comments } from "@/components/comments";
import { createClient } from "@/lib/supabase/client";
import type { Todo, TodoPriority, TodoVisibility, TodoChecklistItem } from "@/types/database";

// ============================================================
// Label color palette — deterministic hash to fixed palette
// ============================================================

const LABEL_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
];

export function labelColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

// ============================================================
// Priority helpers
// ============================================================

const priorityOptions: { value: TodoPriority; label: string; className: string }[] = [
  { value: "high", label: "High", className: "bg-semantic-brick/10 text-semantic-brick" },
  { value: "medium", label: "Med", className: "bg-semantic-ochre/10 text-semantic-ochre-text" },
  { value: "low", label: "Low", className: "bg-faded/10 text-subtle" },
];

const entityTypeLabels: Record<string, string> = {
  bet: "Bet", kpi: "KPI", move: "Move", move_instance: "Move Instance",
  idea: "Idea", funnel: "Funnel", decision: "Decision", blocker: "Blocker",
  commitment: "Commitment", issue: "Issue", process: "Process",
  content_piece: "Content", todo: "Todo",
};

// ============================================================
// Main Component
// ============================================================

interface TodoDetailPanelProps {
  todo: Todo | null;
  onClose: () => void;
  onUpdate: () => void;
  orgId: string;
}

export function TodoDetailPanel({ todo, onClose, onUpdate, orgId }: TodoDetailPanelProps) {
  if (!todo) return null;
  return (
    <SlideOver open={!!todo} onClose={onClose} width="lg">
      <TodoDetailContent
        key={todo.id}
        todo={todo}
        onClose={onClose}
        onUpdate={onUpdate}
        orgId={orgId}
      />
    </SlideOver>
  );
}

function TodoDetailContent({
  todo,
  onClose,
  onUpdate,
  orgId,
}: {
  todo: Todo;
  onClose: () => void;
  onUpdate: () => void;
  orgId: string;
}) {
  const supabase = createClient();

  // ---- Title editing ----
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(todo.title);
  const [descValue, setDescValue] = useState(todo.description ?? "");
  const [descDirty, setDescDirty] = useState(false);
  const [labelsLocal, setLabelsLocal] = useState<string[]>(todo.labels);
  const [labelInput, setLabelInput] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  async function saveTitle() {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === todo.title) {
      setTitleValue(todo.title);
      setEditingTitle(false);
      return;
    }
    await supabase.from("todos").update({ title: trimmed, updated_at: new Date().toISOString() }).eq("id", todo.id);
    setEditingTitle(false);
    onUpdate();
  }

  async function saveDescription() {
    if (!descDirty) return;
    const val = descValue.trim() || null;
    await supabase.from("todos").update({ description: val, updated_at: new Date().toISOString() }).eq("id", todo.id);
    setDescDirty(false);
    onUpdate();
  }

  // ---- Priority ----
  async function setPriority(p: TodoPriority) {
    await supabase.from("todos").update({ priority: p, updated_at: new Date().toISOString() }).eq("id", todo.id);
    onUpdate();
  }

  // ---- Due date ----
  async function setDueDate(d: string) {
    await supabase.from("todos").update({ due_date: d || null, updated_at: new Date().toISOString() }).eq("id", todo.id);
    onUpdate();
  }

  // ---- Visibility ----
  async function toggleVisibility() {
    const next: TodoVisibility = todo.visibility === "private" ? "team" : "private";
    await supabase.from("todos").update({ visibility: next, updated_at: new Date().toISOString() }).eq("id", todo.id);
    onUpdate();
  }

  async function addLabel() {
    const label = labelInput.trim().toLowerCase();
    if (!label || labelsLocal.includes(label)) { setLabelInput(""); return; }
    const next = [...labelsLocal, label];
    setLabelsLocal(next);
    setLabelInput("");
    await supabase.from("todos").update({ labels: next, updated_at: new Date().toISOString() }).eq("id", todo.id);
    onUpdate();
  }

  async function removeLabel(label: string) {
    const next = labelsLocal.filter((l) => l !== label);
    setLabelsLocal(next);
    await supabase.from("todos").update({ labels: next, updated_at: new Date().toISOString() }).eq("id", todo.id);
    onUpdate();
  }

  // ---- Completed toggle ----
  async function toggleCompleted() {
    await supabase.from("todos").update({ completed: !todo.completed, updated_at: new Date().toISOString() }).eq("id", todo.id);
    onUpdate();
  }

  // ---- Delete ----
  async function handleDelete() {
    await supabase.from("todos").delete().eq("id", todo.id);
    onClose();
    onUpdate();
  }

  return (
    <div className="space-y-6">
      {/* ---- Header: Title + completed checkbox ---- */}
      <div className="flex items-start gap-3">
        <button
          onClick={toggleCompleted}
          className={`flex-shrink-0 mt-1 w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
            todo.completed ? "bg-accent border-accent text-white" : "border-line hover:border-accent"
          }`}
        >
          {todo.completed && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={titleRef}
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") { setTitleValue(todo.title); setEditingTitle(false); }
              }}
              className="w-full rounded border border-accent bg-canvas px-2 py-1 font-display text-lg font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-accent-glow/20"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className={`text-left font-display text-lg font-semibold w-full ${
                todo.completed ? "line-through text-subtle" : "text-ink"
              }`}
            >
              {todo.title}
            </button>
          )}
        </div>
      </div>

      {/* ---- Metadata row ---- */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Priority pills */}
        <div className="flex items-center gap-1">
          {priorityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriority(opt.value)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                todo.priority === opt.value ? opt.className : "bg-canvas text-subtle hover:bg-hovered"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Due date */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-subtle">Due:</label>
          <input
            type="date"
            value={todo.due_date ?? ""}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-line bg-canvas px-2 py-1 text-xs text-ink focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-accent-glow/20"
          />
        </div>

        {/* Visibility */}
        <button
          onClick={toggleVisibility}
          className="rounded border border-line px-2 py-1 text-xs text-subtle hover:text-ink hover:bg-hovered transition-colors"
          title={todo.visibility === "private" ? "Only you can see this" : "Visible to team"}
        >
          {todo.visibility === "private" ? "Private" : "Team"}
        </button>

        {/* Linked entity (read-only) */}
        {todo.linked_entity_type && (
          <span className="rounded bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
            {entityTypeLabels[todo.linked_entity_type] ?? todo.linked_entity_type}
          </span>
        )}
      </div>

      {/* ---- Labels ---- */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-subtle mb-2">Labels</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {labelsLocal.map((label) => (
            <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${labelColor(label)}`}>
              {label}
              <button
                onClick={() => removeLabel(label)}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); addLabel(); }}
            className="inline-flex"
          >
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Add label..."
              className="w-24 rounded border border-dashed border-line bg-transparent px-2 py-0.5 text-xs text-ink placeholder:text-placeholder focus:border-accent focus:outline-none"
            />
          </form>
        </div>
      </div>

      {/* ---- Description ---- */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-subtle mb-2">Description</p>
        <textarea
          value={descValue}
          onChange={(e) => { setDescValue(e.target.value); setDescDirty(true); }}
          onBlur={saveDescription}
          placeholder="Add a description..."
          rows={3}
          className="w-full rounded-lg border border-line bg-well px-3 py-2 text-sm text-ink placeholder:text-placeholder resize-y focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-accent-glow/20"
        />
      </div>

      {/* ---- Checklist ---- */}
      <ChecklistSection todoId={todo.id} />

      {/* ---- Comments ---- */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-subtle mb-2">Comments</p>
        <Comments
          entityId={todo.id}
          entityType="todo"
          orgId={orgId}
          entityOwnerId={todo.user_id}
        />
      </div>

      {/* ---- Danger zone ---- */}
      <div className="pt-4 border-t border-line">
        <button
          onClick={handleDelete}
          className="text-xs text-semantic-brick hover:underline"
        >
          Delete this todo
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Checklist Section
// ============================================================

function ChecklistSection({ todoId }: { todoId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<TodoChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("todo_checklist_items")
      .select("*")
      .eq("todo_id", todoId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setItems((data ?? []) as TodoChecklistItem[]);
    setLoading(false);
  }, [supabase, todoId]);

  useEffect(() => {
    void (async () => {
      await fetchItems();
    })();
  }, [fetchItems]);

  async function addItem() {
    const title = newTitle.trim();
    if (!title) return;
    const maxPos = items.length > 0 ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    setNewTitle("");
    await supabase.from("todo_checklist_items").insert({
      todo_id: todoId,
      title,
      position: maxPos,
    });
    fetchItems();
  }

  async function toggleItem(item: TodoChecklistItem) {
    // Optimistic update
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: !i.completed } : i)));
    await supabase.from("todo_checklist_items").update({ completed: !item.completed }).eq("id", item.id);
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("todo_checklist_items").delete().eq("id", id);
  }

  const doneCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-subtle">Checklist</p>
        {totalCount > 0 && (
          <span className="text-xs text-subtle">{doneCount}/{totalCount}</span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 rounded-full bg-line mb-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 bg-well rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group py-1 px-1 -mx-1 rounded hover:bg-hovered transition-colors">
              <button
                onClick={() => toggleItem(item)}
                className={`flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                  item.completed ? "bg-accent border-accent text-white" : "border-line hover:border-accent"
                }`}
              >
                {item.completed && (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
              <span className={`flex-1 text-sm ${item.completed ? "line-through text-subtle" : "text-ink"}`}>
                {item.title}
              </span>
              <button
                onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-subtle hover:text-semantic-brick transition-all p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add item */}
      <form
        onSubmit={(e) => { e.preventDefault(); addItem(); }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add an item..."
          className="flex-1 rounded border border-dashed border-line bg-transparent px-2 py-1 text-sm text-ink placeholder:text-placeholder focus:border-accent focus:outline-none"
        />
        {newTitle.trim() && (
          <button
            type="submit"
            className="rounded bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
          >
            Add
          </button>
        )}
      </form>
    </div>
  );
}
