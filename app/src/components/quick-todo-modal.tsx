"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOptionalUserContext } from "@/hooks/use-user-context";

interface QuickTodoModalProps {
  open: boolean;
  onClose: () => void;
}

type Priority = "high" | "medium" | "low";

export function QuickTodoModal({ open, onClose }: QuickTodoModalProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [flash, setFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ctx = useOptionalUserContext();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle("");
      setPriority("medium");
      setFlash(false);
      // Focus after the modal renders
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !ctx || submitting) return;

    setSubmitting(true);
    const supabase = createClient();
    await supabase.from("todos").insert({
      user_id: ctx.userId,
      organization_id: ctx.orgId,
      title: title.trim(),
      priority,
    });
    setSubmitting(false);
    setFlash(true);
    setTimeout(() => {
      setFlash(false);
      onClose();
    }, 600);
  }

  const priorityOptions: { key: Priority; label: string }[] = [
    { key: "high", label: "H" },
    { key: "medium", label: "M" },
    { key: "low", label: "L" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-surface border border-line rounded-xl shadow-lg w-full max-w-md mx-4 p-5">
        {flash ? (
          <div className="flex items-center justify-center py-4">
            <span className="text-sm font-semibold text-semantic-green-text">
              Added!
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block font-mono text-[10px] font-semibold text-subtle uppercase tracking-[0.10em] mb-2">
              Quick Todo
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-glow/30 focus:border-line-focus"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-subtle mr-1">Priority:</span>
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPriority(opt.key)}
                    className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${
                      priority === opt.key
                        ? opt.key === "high"
                          ? "bg-semantic-brick text-white"
                          : opt.key === "medium"
                            ? "bg-semantic-ochre text-white"
                            : "bg-faded text-white"
                        : "bg-line/50 text-subtle hover:bg-line"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-subtle hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || submitting}
                  className="px-4 py-1.5 rounded-lg bg-cta text-white text-sm font-medium hover:bg-cta-hover disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
            <p className="text-[11px] text-subtle mt-2">
              Press <kbd className="px-1 py-0.5 rounded bg-line/60 text-xs font-mono">Enter</kbd> to save
              {" · "}
              <kbd className="px-1 py-0.5 rounded bg-line/60 text-xs font-mono">Esc</kbd> to cancel
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
