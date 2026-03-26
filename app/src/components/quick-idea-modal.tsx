"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOptionalUserContext } from "@/hooks/use-user-context";

interface QuickIdeaModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickIdeaModal({ open, onClose }: QuickIdeaModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [flash, setFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const ctx = useOptionalUserContext();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("");
      setDescription("");
      setFlash(false);
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
    if (!name.trim() || !ctx || submitting) return;

    setSubmitting(true);
    const supabase = createClient();
    const now = new Date();
    const coolingExpires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    await supabase.from("ideas").insert({
      organization_id: ctx.orgId,
      venture_id: ctx.ventureId,
      name: name.trim(),
      description: description.trim(),
      submitter_id: ctx.userId,
      submitted_at: now.toISOString(),
      cooling_expires_at: coolingExpires.toISOString(),
      lifecycle_status: "quarantine",
      filter_results: [],
    });

    setSubmitting(false);
    setFlash(true);
    router.refresh();
    setTimeout(() => {
      setFlash(false);
      onClose();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-surface border border-line rounded-xl shadow-lg w-full max-w-md mx-4 p-5">
        {flash ? (
          <div className="flex items-center justify-center py-4">
            <span className="text-sm font-semibold text-semantic-green-text">
              Idea submitted to quarantine!
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block font-mono text-[10px] font-semibold text-subtle uppercase tracking-[0.10em] mb-2">
              Quick Idea
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Idea name (one sentence)"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-glow/30 focus:border-line-focus"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description (optional)"
              rows={2}
              className="w-full mt-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-glow/30 focus:border-line-focus resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-subtle hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || submitting}
                className="px-4 py-1.5 rounded-lg bg-cta text-white text-sm font-medium hover:bg-cta-hover disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
            <p className="text-[11px] text-subtle mt-2">
              Enters 14-day quarantine{" · "}
              <kbd className="px-1 py-0.5 rounded bg-line/60 text-xs font-mono">Enter</kbd> to save
              {" · "}
              <kbd className="px-1 py-0.5 rounded bg-line/60 text-xs font-mono">Esc</kbd> to cancel
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
