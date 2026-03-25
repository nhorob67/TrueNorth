"use client";

import { useRouter, usePathname } from "next/navigation";

type MeetingType = "weekly" | "monthly" | "quarterly";

const MEETING_TYPES: Array<{ key: MeetingType; label: string; path: string; description: string }> = [
  {
    key: "weekly",
    label: "Weekly Sync",
    path: "/sync",
    description: "30 min — Scoreboard, focus, blockers, commitments",
  },
  {
    key: "monthly",
    label: "Monthly Review",
    path: "/sync/monthly",
    description: "60 min — Wins, root causes, pipeline, action items",
  },
  {
    key: "quarterly",
    label: "Quarterly Summit",
    path: "/sync/quarterly",
    description: "120 min — BHAG, bets, scoreboard, commitments",
  },
];

export function MeetingModeHub({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function getActiveMeeting(): MeetingType {
    if (pathname.endsWith("/sync/quarterly")) return "quarterly";
    if (pathname.endsWith("/sync/monthly")) return "monthly";
    return "weekly";
  }

  const active = getActiveMeeting();

  return (
    <div>
      {/* Meeting type tabs */}
      <div className="max-w-3xl mx-auto mb-6">
        <div className="flex gap-2 p-1 bg-canvas border border-line rounded-xl">
          {MEETING_TYPES.map((mt) => {
            const isActive = active === mt.key;
            return (
              <button
                key={mt.key}
                onClick={() => router.push(mt.path)}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-subtle hover:text-ink hover:bg-surface"
                }`}
              >
                <div>{mt.label}</div>
                <div className={`text-xs mt-0.5 ${isActive ? "text-white/70" : "text-subtle"}`}>
                  {mt.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Meeting content */}
      {children}
    </div>
  );
}
