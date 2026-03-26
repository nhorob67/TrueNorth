"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { detectOneAskConflicts } from "@/lib/one-ask-rule";

// ============================================================
// Types
// ============================================================

type MachineType = "newsletter" | "deep_content" | "short_form" | "live_event";
type ContentLifecycle =
  | "ideation"
  | "drafting"
  | "review"
  | "scheduled"
  | "published";

interface ContentPiece {
  id: string;
  venture_id: string;
  organization_id: string;
  title: string;
  machine_type: MachineType;
  lifecycle_status: ContentLifecycle;
  owner_id: string;
  scheduled_at: string | null;
  linked_funnel_id: string | null;
  created_at: string;
}

interface Funnel {
  id: string;
  name: string;
}

// ============================================================
// Constants
// ============================================================

const machineLabels: Record<MachineType, string> = {
  newsletter: "Newsletter",
  deep_content: "Deep Content",
  short_form: "Short-Form",
  live_event: "Live Event",
};

const machinePillColors: Record<MachineType, string> = {
  newsletter: "bg-accent/20 text-accent",
  deep_content: "bg-accent-dim text-accent",
  short_form: "bg-brass/20 text-brass-text",
  live_event: "bg-sage/20 text-sage-text",
};

const machineDotColors: Record<MachineType, string> = {
  newsletter: "bg-accent",
  deep_content: "bg-cta",
  short_form: "bg-brass",
  live_event: "bg-sage",
};

const allMachineTypes: MachineType[] = [
  "newsletter",
  "deep_content",
  "short_form",
  "live_event",
];

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ============================================================
// Date helpers
// ============================================================

function getMonthDays(year: number, month: number) {
  // Returns array of Date objects for the calendar grid (6 weeks max)
  const firstOfMonth = new Date(year, month, 1);
  // Monday = 0, Sunday = 6 in our grid
  let startDow = firstOfMonth.getDay() - 1;
  if (startDow < 0) startDow = 6; // Sunday wraps to 6

  const gridStart = new Date(year, month, 1 - startDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getISOWeek(d: Date): number {
  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((tmp.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

function isWeekday(d: Date): boolean {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6;
}

// ============================================================
// Quick Schedule Form
// ============================================================

function QuickScheduleForm({
  date,
  onClose,
  onCreated,
}: {
  date: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const userCtx = useUserContext();
  const [title, setTitle] = useState("");
  const [machineType, setMachineType] = useState<MachineType>("newsletter");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    await supabase.from("content_pieces").insert({
      organization_id: userCtx.orgId,
      venture_id: userCtx.ventureId,
      title: title.trim(),
      machine_type: machineType,
      lifecycle_status: "ideation" as const,
      owner_id: userCtx.userId,
      body_json: {},
      scheduled_at: date.toISOString(),
    });

    setLoading(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30">
      <div className="bg-surface rounded-xl border border-line shadow-lg p-5 w-full max-w-sm">
        <h3 className="text-sm font-semibold text-ink mb-1">
          Quick Schedule
        </h3>
        <p className="text-xs text-subtle mb-3">
          {date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Content title..."
            autoFocus
            required
          />
          <select
            value={machineType}
            onChange={(e) => setMachineType(e.target.value as MachineType)}
            className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-surface"
          >
            {Object.entries(machineLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading || !title.trim()}>
              {loading ? "Creating..." : "Create & Schedule"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Content Pill (draggable)
// ============================================================

function ContentPill({
  piece,
  funnelName,
}: {
  piece: ContentPiece;
  funnelName: string | null;
}) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", piece.id);
    e.dataTransfer.effectAllowed = "move";
  }

  const truncated =
    piece.title.length > 20
      ? piece.title.slice(0, 20) + "\u2026"
      : piece.title;

  return (
    <a
      href={`/execution/content/${piece.id}`}
      draggable
      onDragStart={handleDragStart}
      className={`group flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs cursor-grab active:cursor-grabbing ${machinePillColors[piece.machine_type]} hover:opacity-80 transition-opacity`}
      title={`${piece.title}${funnelName ? ` | Funnel: ${funnelName}` : ""}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${machineDotColors[piece.machine_type]}`}
      />
      <span className="truncate">{truncated}</span>
      {funnelName && (
        <svg
          className="w-3 h-3 shrink-0 opacity-60"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
          />
        </svg>
      )}
    </a>
  );
}

// ============================================================
// Day Cell
// ============================================================

function DayCell({
  date,
  isCurrentMonth,
  isToday,
  isGap,
  pieces,
  funnelMap,
  onEmptyClick,
  onDrop,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isGap: boolean;
  pieces: ContentPiece[];
  funnelMap: Map<string, string>;
  onEmptyClick: (d: Date) => void;
  onDrop: (pieceId: string, newDate: Date) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const pieceId = e.dataTransfer.getData("text/plain");
    if (pieceId) {
      onDrop(pieceId, date);
    }
  }

  function handleCellClick(e: React.MouseEvent) {
    // Only fire if clicking the cell bg, not a pill
    if ((e.target as HTMLElement).closest("a")) return;
    if (pieces.length === 0) {
      onEmptyClick(date);
    }
  }

  return (
    <div
      onClick={handleCellClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-h-[100px] border border-line p-1.5 transition-colors cursor-pointer ${
        isCurrentMonth ? "bg-surface" : "bg-canvas/60 opacity-40"
      } ${isToday ? "border-2 border-accent" : ""} ${
        isGap
          ? "border-dashed border-semantic-brick/30 bg-semantic-brick/5"
          : ""
      } ${dragOver ? "bg-accent/10" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-xs font-medium ${
            isToday
              ? "text-accent font-semibold"
              : isCurrentMonth
                ? "text-ink"
                : "text-subtle"
          }`}
        >
          {date.getDate()}
        </span>
        {isGap && (
          <span className="text-[10px] text-subtle font-medium">Gap</span>
        )}
      </div>
      <div className="space-y-1">
        {pieces.map((piece) => (
          <ContentPill
            key={piece.id}
            piece={piece}
            funnelName={
              piece.linked_funnel_id
                ? (funnelMap.get(piece.linked_funnel_id) ?? null)
                : null
            }
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Mobile Week List View
// ============================================================

function MobileWeekList({
  days,
  currentMonth,
  today,
  piecesByDate,
  gapDays,
  funnelMap,
  onEmptyClick,
}: {
  days: Date[];
  currentMonth: number;
  today: Date;
  piecesByDate: Map<string, ContentPiece[]>;
  gapDays: Set<string>;
  funnelMap: Map<string, string>;
  onEmptyClick: (d: Date) => void;
}) {
  // Only show days in current month
  const monthDays = days.filter((d) => d.getMonth() === currentMonth);

  return (
    <div className="space-y-1 md:hidden">
      {monthDays.map((day) => {
        const key = dateKey(day);
        const pieces = piecesByDate.get(key) ?? [];
        const todayMatch = isSameDay(day, today);
        const gap = gapDays.has(key);

        return (
          <div
            key={key}
            onClick={() => pieces.length === 0 && onEmptyClick(day)}
            className={`flex items-start gap-3 p-2 rounded-lg border ${
              todayMatch ? "border-accent border-2" : "border-line"
            } ${gap ? "border-dashed border-semantic-brick/30 bg-semantic-brick/5" : "bg-surface"}`}
          >
            <div className="text-center w-10 shrink-0">
              <div className="text-xs text-subtle">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div
                className={`text-sm font-semibold ${todayMatch ? "text-accent" : "text-ink"}`}
              >
                {day.getDate()}
              </div>
              {gap && (
                <span className="text-[9px] text-subtle">Gap</span>
              )}
            </div>
            <div className="flex-1 flex flex-wrap gap-1 min-h-[24px]">
              {pieces.map((piece) => (
                <ContentPill
                  key={piece.id}
                  piece={piece}
                  funnelName={
                    piece.linked_funnel_id
                      ? (funnelMap.get(piece.linked_funnel_id) ?? null)
                      : null
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Calendar View
// ============================================================

interface ContentMove {
  id: string;
  title: string;
  cadence: string;
  target_per_cycle: number;
  content_machine_id: string;
  bet_outcome: string;
}

export function CalendarView({
  pieces,
  funnels,
  contentMoves = [],
}: {
  pieces: ContentPiece[];
  funnels: Funnel[];
  contentMoves?: ContentMove[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [quickScheduleDate, setQuickScheduleDate] = useState<Date | null>(null);

  // Filters
  const [enabledMachines, setEnabledMachines] = useState<Set<MachineType>>(
    () => new Set(allMachineTypes)
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled">("all");

  // Funnel lookup
  const funnelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of funnels) map.set(f.id, f.name);
    return map;
  }, [funnels]);

  // Filter pieces
  const filtered = useMemo(() => {
    return pieces.filter((p) => {
      if (!enabledMachines.has(p.machine_type)) return false;
      if (statusFilter === "scheduled" && p.lifecycle_status !== "scheduled")
        return false;
      return true;
    });
  }, [pieces, enabledMachines, statusFilter]);

  // Group pieces by date key
  const piecesByDate = useMemo(() => {
    const map = new Map<string, ContentPiece[]>();
    for (const p of filtered) {
      if (!p.scheduled_at) continue;
      const d = new Date(p.scheduled_at);
      const key = dateKey(d);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [filtered]);

  // Calendar grid days
  const gridDays = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // Gap detection: weekdays in current month with no content, but same week has content
  const gapDays = useMemo(() => {
    const gaps = new Set<string>();

    // Group days by ISO week
    const weekMap = new Map<number, Date[]>();
    for (const d of gridDays) {
      if (d.getMonth() !== viewMonth) continue;
      if (!isWeekday(d)) continue;
      const wk = getISOWeek(d);
      const arr = weekMap.get(wk) ?? [];
      arr.push(d);
      weekMap.set(wk, arr);
    }

    for (const [, weekDays] of weekMap) {
      const weekHasContent = weekDays.some(
        (d) => (piecesByDate.get(dateKey(d)) ?? []).length > 0
      );
      if (!weekHasContent) continue;
      for (const d of weekDays) {
        const key = dateKey(d);
        if ((piecesByDate.get(key) ?? []).length === 0) {
          gaps.add(key);
        }
      }
    }

    return gaps;
  }, [gridDays, viewMonth, piecesByDate]);

  // One-Ask Rule conflict detection
  const oneAskConflicts = useMemo(() => {
    return detectOneAskConflicts(
      pieces.map((p) => ({
        id: p.id,
        title: p.title,
        scheduled_at: p.scheduled_at ?? "",
        linked_funnel_id: p.linked_funnel_id,
      }))
    );
  }, [pieces]);

  // Recurring Move gap detection: compare scheduled content vs move targets
  const moveGaps = useMemo(() => {
    if (contentMoves.length === 0) return [];

    const gaps: Array<{
      moveTitle: string;
      betOutcome: string;
      machineId: string;
      target: number;
      scheduled: number;
      cadence: string;
    }> = [];

    // Count scheduled/published content per machine_type in the viewed month
    const monthStart = new Date(viewYear, viewMonth, 1);
    const monthEnd = new Date(viewYear, viewMonth + 1, 0);

    for (const move of contentMoves) {
      // Count content pieces matching this machine in the viewed month
      const count = pieces.filter((p) => {
        if (p.machine_type !== move.content_machine_id) return false;
        if (!p.scheduled_at) return false;
        const d = new Date(p.scheduled_at);
        return d >= monthStart && d <= monthEnd;
      }).length;

      // Compute expected per month based on cadence
      let expectedPerMonth = move.target_per_cycle;
      if (move.cadence === "weekly") expectedPerMonth = move.target_per_cycle * 4;
      else if (move.cadence === "biweekly") expectedPerMonth = move.target_per_cycle * 2;
      else if (move.cadence === "daily") expectedPerMonth = move.target_per_cycle * 22; // ~weekdays

      if (count < expectedPerMonth) {
        gaps.push({
          moveTitle: move.title,
          betOutcome: move.bet_outcome,
          machineId: move.content_machine_id,
          target: expectedPerMonth,
          scheduled: count,
          cadence: move.cadence,
        });
      }
    }

    return gaps;
  }, [contentMoves, pieces, viewYear, viewMonth]);

  // Navigation
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  function goPrev() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function goNext() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  // Machine type toggle
  function toggleMachine(mt: MachineType) {
    setEnabledMachines((prev) => {
      const next = new Set(prev);
      if (next.has(mt)) {
        next.delete(mt);
      } else {
        next.add(mt);
      }
      return next;
    });
  }

  // Drag-and-drop reschedule
  const handleDrop = useCallback(
    async (pieceId: string, newDate: Date) => {
      await supabase
        .from("content_pieces")
        .update({ scheduled_at: newDate.toISOString() })
        .eq("id", pieceId);
      router.refresh();
    },
    [supabase, router]
  );

  // Quick schedule
  function handleEmptyClick(d: Date) {
    setQuickScheduleDate(d);
  }

  function handleCreated() {
    setQuickScheduleDate(null);
    router.refresh();
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">Media Calendar</h1>
          <p className="text-sm text-subtle mt-0.5">
            {gapDays.size} content gap{gapDays.size !== 1 ? "s" : ""} this month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/execution/content">
            <Button variant="secondary" size="sm">
              Pipeline
            </Button>
          </Link>
        </div>
      </div>

      {/* Month nav + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goPrev}>
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
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
          </Button>
          <Button variant="secondary" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="secondary" size="sm" onClick={goNext}>
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
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </Button>
          <span className="text-base font-semibold text-ink ml-2">
            {monthLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Machine type toggles */}
          {allMachineTypes.map((mt) => {
            const on = enabledMachines.has(mt);
            return (
              <button
                key={mt}
                onClick={() => toggleMachine(mt)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  on
                    ? `${machinePillColors[mt]} border-transparent`
                    : "bg-canvas text-subtle border-line opacity-50"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${on ? machineDotColors[mt] : "bg-faded/40"}`}
                />
                {machineLabels[mt]}
              </button>
            );
          })}

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "scheduled")
            }
            className="text-xs border border-line rounded-lg px-2 py-1 bg-surface text-ink"
          >
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled only</option>
          </select>
        </div>
      </div>

      {/* One-Ask Rule Warnings */}
      {oneAskConflicts.length > 0 && (
        <div className="mb-4 border-l-2 border-semantic-ochre bg-semantic-ochre/5 rounded-r-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-semantic-ochre uppercase">
            One-Ask Rule — Audience Collision Detected
          </p>
          {oneAskConflicts.slice(0, 5).map((c) => (
            <p key={`${c.pieceId}-${c.conflictingPieceId}`} className="text-xs text-ink">
              <span className="font-medium">{c.pieceTitle}</span>
              {" and "}
              <span className="font-medium">{c.conflictingPieceTitle}</span>
              {" target the same funnel "}
              <span className="text-subtle">
                ({funnelMap.get(c.funnelId) ?? "Unknown"})
              </span>
              {" — only "}
              <span className="font-medium text-semantic-ochre">{c.daysBetween}d apart</span>
              {" (30-day window)."}
            </p>
          ))}
          {oneAskConflicts.length > 5 && (
            <p className="text-xs text-subtle">
              ...and {oneAskConflicts.length - 5} more conflicts
            </p>
          )}
        </div>
      )}

      {/* Recurring Move Gap Warnings */}
      {moveGaps.length > 0 && (
        <div className="mb-4 border-l-2 border-semantic-brick bg-semantic-brick/5 rounded-r-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-semantic-brick uppercase">
            Content Gap — Recurring Moves at Risk
          </p>
          {moveGaps.map((g) => (
            <p key={g.moveTitle} className="text-xs text-ink">
              <span className="font-medium">{g.moveTitle}</span>
              {" expects "}
              <span className="font-medium text-semantic-brick">
                {g.target} pieces/month
              </span>
              {" but only "}
              <span className="font-medium">{g.scheduled} scheduled</span>
              {" this month"}
              <span className="text-subtle"> — {g.betOutcome}</span>
            </p>
          ))}
        </div>
      )}

      {/* Desktop: Calendar Grid */}
      <div className="hidden md:block">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-xs font-semibold text-subtle text-center py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {gridDays.map((day) => {
            const key = dateKey(day);
            return (
              <DayCell
                key={key}
                date={day}
                isCurrentMonth={day.getMonth() === viewMonth}
                isToday={isSameDay(day, today)}
                isGap={gapDays.has(key)}
                pieces={piecesByDate.get(key) ?? []}
                funnelMap={funnelMap}
                onEmptyClick={handleEmptyClick}
                onDrop={handleDrop}
              />
            );
          })}
        </div>
      </div>

      {/* Mobile: Week list */}
      <MobileWeekList
        days={gridDays}
        currentMonth={viewMonth}
        today={today}
        piecesByDate={piecesByDate}
        gapDays={gapDays}
        funnelMap={funnelMap}
        onEmptyClick={handleEmptyClick}
      />

      {/* Quick Schedule Modal */}
      {quickScheduleDate && (
        <QuickScheduleForm
          date={quickScheduleDate}
          onClose={() => setQuickScheduleDate(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
