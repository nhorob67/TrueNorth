"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOptionalUserContext } from "@/hooks/use-user-context";

export function VentureSwitcher() {
  const userCtx = useOptionalUserContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  if (!userCtx || userCtx.isSingleVenture) return null;

  const activeVenture = userCtx.ventures.find((v) => v.id === userCtx.ventureId);

  async function handleSwitch(ventureId: string) {
    if (ventureId === userCtx?.ventureId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/ventures/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventureId }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div ref={ref} className="relative px-3 mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-white/90 bg-white/10 hover:bg-white/15 transition-colors"
      >
        <span className="truncate">{activeVenture?.name ?? "Select venture"}</span>
        <svg
          className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg bg-[#4a5a3f] border border-white/10 shadow-lg overflow-hidden">
          {userCtx.ventures.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSwitch(v.id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              {v.id === userCtx.ventureId ? (
                <svg className="w-4 h-4 flex-shrink-0 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <span className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="truncate">{v.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
