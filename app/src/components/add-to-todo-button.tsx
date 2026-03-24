"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";

interface AddToTodoButtonProps {
  entityId: string;
  entityType: string;
  entityLabel: string;
}

export function AddToTodoButton({
  entityId,
  entityType,
  entityLabel,
}: AddToTodoButtonProps) {
  const [status, setStatus] = useState<"idle" | "adding" | "added">("idle");
  const ctx = useUserContext();

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (status !== "idle") return;

    setStatus("adding");
    const supabase = createClient();
    await supabase.from("todos").insert({
      user_id: ctx.userId,
      organization_id: ctx.orgId,
      title: entityLabel,
      linked_entity_id: entityId,
      linked_entity_type: entityType,
      priority: "medium",
    });
    setStatus("added");
    setTimeout(() => setStatus("idle"), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "adding"}
      title={status === "added" ? "Added!" : "Add to todos"}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-warm-gray hover:text-moss hover:bg-moss/10 transition-colors disabled:opacity-50"
    >
      {status === "added" ? (
        <svg
          className="w-4 h-4 text-semantic-green-text"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
    </button>
  );
}
