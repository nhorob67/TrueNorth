import { SupabaseClient } from "@supabase/supabase-js";
import type { HealthStatus, MoveCadence } from "@/types/database";

// ============================================================
// Recurring Move Lifecycle Library
//
// Three core functions used by the daily cron job:
//   1. detectMissedInstances  — mark overdue pending instances as missed
//   2. generateNewCycleInstances — create pending instances for the current cycle
//   3. updateRecurringMoveHealth — recalculate health from rolling completion rate
// ============================================================

export interface MissedInstanceResult {
  instanceId: string;
  moveId: string;
  moveTitle: string;
  ownerId: string;
  organizationId: string;
  cycleEnd: string;
}

export interface GeneratedCycleResult {
  moveId: string;
  moveTitle: string;
  instancesCreated: number;
  cycleStart: string;
  cycleEnd: string;
}

// ----------------------------------------------------------
// 1. Detect Missed Instances
// ----------------------------------------------------------

export async function detectMissedInstances(
  supabase: SupabaseClient
): Promise<MissedInstanceResult[]> {
  const today = todayUTC();

  // Find pending instances whose cycle has ended, joined with their parent move
  // to ensure the move is active and recurring
  const { data: pendingInstances, error } = await supabase
    .from("move_instances")
    .select(
      `
      id,
      move_id,
      cycle_end,
      moves!inner (
        id,
        title,
        type,
        owner_id,
        organization_id,
        lifecycle_status,
        paused_at
      )
    `
    )
    .eq("status", "pending")
    .lt("cycle_end", today)
    .eq("moves.type", "recurring")
    .in("moves.lifecycle_status", ["not_started", "in_progress"])
    .is("moves.paused_at", null);

  if (error) {
    console.error("detectMissedInstances: query error", error);
    return [];
  }

  if (!pendingInstances || pendingInstances.length === 0) return [];

  const instanceIds = pendingInstances.map((i) => i.id);

  // Batch-update all to 'missed'
  const { error: updateError } = await supabase
    .from("move_instances")
    .update({ status: "missed" })
    .in("id", instanceIds);

  if (updateError) {
    console.error("detectMissedInstances: update error", updateError);
    return [];
  }

  return pendingInstances.map((inst) => {
    const move = normalizeRelation(inst.moves);
    return {
      instanceId: inst.id,
      moveId: inst.move_id,
      moveTitle: move.title,
      ownerId: move.owner_id,
      organizationId: move.organization_id,
      cycleEnd: inst.cycle_end,
    };
  });
}

// ----------------------------------------------------------
// 2. Generate New Cycle Instances
// ----------------------------------------------------------

export async function generateNewCycleInstances(
  supabase: SupabaseClient
): Promise<GeneratedCycleResult[]> {
  // Fetch all active, unpaused recurring moves
  const { data: moves, error } = await supabase
    .from("moves")
    .select("id, title, cadence, target_per_cycle, created_at")
    .eq("type", "recurring")
    .in("lifecycle_status", ["not_started", "in_progress"])
    .is("paused_at", null);

  if (error) {
    console.error("generateNewCycleInstances: query error", error);
    return [];
  }

  if (!moves || moves.length === 0) return [];

  const results: GeneratedCycleResult[] = [];

  for (const move of moves) {
    const cadence = (move.cadence ?? "weekly") as MoveCadence;
    const targetPerCycle = move.target_per_cycle ?? 1;
    const { cycleStart, cycleEnd } = getCurrentCycleBounds(
      cadence,
      move.created_at
    );

    // Check if instances already exist for this cycle window
    const { count, error: countError } = await supabase
      .from("move_instances")
      .select("id", { count: "exact", head: true })
      .eq("move_id", move.id)
      .eq("cycle_start", cycleStart)
      .eq("cycle_end", cycleEnd);

    if (countError) {
      console.error(
        `generateNewCycleInstances: count error for move ${move.id}`,
        countError
      );
      continue;
    }

    if ((count ?? 0) >= targetPerCycle) continue; // Already generated

    const existingCount = count ?? 0;
    const toCreate = targetPerCycle - existingCount;

    const newInstances = Array.from({ length: toCreate }, () => ({
      move_id: move.id,
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
      status: "pending" as const,
    }));

    const { error: insertError } = await supabase
      .from("move_instances")
      .insert(newInstances);

    if (insertError) {
      console.error(
        `generateNewCycleInstances: insert error for move ${move.id}`,
        insertError
      );
      continue;
    }

    results.push({
      moveId: move.id,
      moveTitle: move.title,
      instancesCreated: toCreate,
      cycleStart,
      cycleEnd,
    });
  }

  return results;
}

// ----------------------------------------------------------
// 3. Update Recurring Move Health
// ----------------------------------------------------------

export async function updateRecurringMoveHealth(
  supabase: SupabaseClient
): Promise<void> {
  // Fetch all active recurring moves
  const { data: moves, error } = await supabase
    .from("moves")
    .select("id, cadence, target_per_cycle, created_at")
    .eq("type", "recurring")
    .in("lifecycle_status", ["not_started", "in_progress"]);

  if (error) {
    console.error("updateRecurringMoveHealth: query error", error);
    return;
  }

  if (!moves || moves.length === 0) return;

  for (const move of moves) {
    const cadence = (move.cadence ?? "weekly") as MoveCadence;
    const targetPerCycle = move.target_per_cycle ?? 1;

    // Get the last 3 complete cycles plus the current cycle
    const cycles = getLastNCycleBounds(cadence, 3, move.created_at);
    const currentCycle = getCurrentCycleBounds(cadence, move.created_at);

    // Fetch all instances across these cycles
    const allCycleStarts = [...cycles.map((c) => c.cycleStart), currentCycle.cycleStart];
    const allCycleEnds = [...cycles.map((c) => c.cycleEnd), currentCycle.cycleEnd];

    const earliest = allCycleStarts.sort()[0];
    const latest = allCycleEnds.sort().reverse()[0];

    const { data: instances, error: instError } = await supabase
      .from("move_instances")
      .select("cycle_start, cycle_end, status")
      .eq("move_id", move.id)
      .gte("cycle_start", earliest)
      .lte("cycle_end", latest);

    if (instError) {
      console.error(
        `updateRecurringMoveHealth: instances query error for move ${move.id}`,
        instError
      );
      continue;
    }

    const allInstances = instances ?? [];

    // Calculate rolling 3-cycle completion rate (past cycles only)
    let totalTarget = 0;
    let totalCompleted = 0;

    for (const cycle of cycles) {
      const cycleInstances = allInstances.filter(
        (i) => i.cycle_start === cycle.cycleStart && i.cycle_end === cycle.cycleEnd
      );
      totalTarget += targetPerCycle;
      totalCompleted += cycleInstances.filter(
        (i) => i.status === "completed"
      ).length;
    }

    // Current cycle pace check
    const currentInstances = allInstances.filter(
      (i) =>
        i.cycle_start === currentCycle.cycleStart &&
        i.cycle_end === currentCycle.cycleEnd
    );
    const currentCompleted = currentInstances.filter(
      (i) => i.status === "completed"
    ).length;
    const currentPending = currentInstances.filter(
      (i) => i.status === "pending"
    ).length;

    const cycleProgress = getCycleProgress(currentCycle);
    const behindPace =
      targetPerCycle > 0 &&
      currentCompleted / targetPerCycle < cycleProgress * 0.5;
    const willMathematicallyMiss =
      currentCompleted + currentPending < targetPerCycle;

    // Determine health
    let health: HealthStatus;
    const rate = totalTarget > 0 ? totalCompleted / totalTarget : 1;

    if (rate < 0.5 || willMathematicallyMiss) {
      health = "red";
    } else if (rate < 0.8 || behindPace) {
      health = "yellow";
    } else {
      health = "green";
    }

    await supabase
      .from("moves")
      .update({ health_status: health })
      .eq("id", move.id);
  }
}

// ============================================================
// Cycle Boundary Helpers
// ============================================================

function todayUTC(): string {
  const now = new Date();
  return formatDate(now);
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function startOfDay(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * Get the current cycle boundaries for a given cadence.
 * For biweekly, uses the move's created_at as the epoch reference.
 */
export function getCurrentCycleBounds(
  cadence: MoveCadence,
  createdAt: string
): { cycleStart: string; cycleEnd: string } {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  switch (cadence) {
    case "daily":
      return {
        cycleStart: formatDate(today),
        cycleEnd: formatDate(today),
      };

    case "weekly": {
      // Monday-based weeks
      const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon, ...
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setUTCDate(monday.getUTCDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      return {
        cycleStart: formatDate(monday),
        cycleEnd: formatDate(sunday),
      };
    }

    case "biweekly": {
      // 14-day windows from move created_at as epoch
      const epoch = startOfDay(createdAt.split("T")[0]);
      const daysSinceEpoch = Math.floor(
        (today.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24)
      );
      const cycleIndex = Math.floor(daysSinceEpoch / 14);
      const cycleStartDate = new Date(epoch);
      cycleStartDate.setUTCDate(
        cycleStartDate.getUTCDate() + cycleIndex * 14
      );
      const cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setUTCDate(cycleEndDate.getUTCDate() + 13);
      return {
        cycleStart: formatDate(cycleStartDate),
        cycleEnd: formatDate(cycleEndDate),
      };
    }

    case "monthly": {
      const firstOfMonth = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
      );
      const lastOfMonth = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
      );
      return {
        cycleStart: formatDate(firstOfMonth),
        cycleEnd: formatDate(lastOfMonth),
      };
    }

    default:
      // Fallback to weekly
      return getCurrentCycleBounds("weekly", createdAt);
  }
}

/**
 * Get boundaries for the last N completed cycles (not including current).
 */
function getLastNCycleBounds(
  cadence: MoveCadence,
  n: number,
  createdAt: string
): { cycleStart: string; cycleEnd: string }[] {
  const results: { cycleStart: string; cycleEnd: string }[] = [];
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  for (let i = 1; i <= n; i++) {
    const pastDate = getPastCycleDate(cadence, today, i, createdAt);
    // Get the cycle that pastDate falls into
    const bounds = getCycleBoundsForDate(cadence, pastDate, createdAt);
    // Avoid duplicates
    if (!results.some((r) => r.cycleStart === bounds.cycleStart)) {
      results.push(bounds);
    }
  }

  return results;
}

function getPastCycleDate(
  cadence: MoveCadence,
  today: Date,
  cyclesBack: number,
  _createdAt: string
): Date {
  const d = new Date(today);
  switch (cadence) {
    case "daily":
      d.setUTCDate(d.getUTCDate() - cyclesBack);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() - 7 * cyclesBack);
      break;
    case "biweekly":
      d.setUTCDate(d.getUTCDate() - 14 * cyclesBack);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() - cyclesBack);
      break;
  }
  return d;
}

function getCycleBoundsForDate(
  cadence: MoveCadence,
  date: Date,
  createdAt: string
): { cycleStart: string; cycleEnd: string } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  switch (cadence) {
    case "daily":
      return { cycleStart: formatDate(d), cycleEnd: formatDate(d) };

    case "weekly": {
      const dayOfWeek = d.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setUTCDate(monday.getUTCDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      return { cycleStart: formatDate(monday), cycleEnd: formatDate(sunday) };
    }

    case "biweekly": {
      const epoch = startOfDay(createdAt.split("T")[0]);
      const daysSinceEpoch = Math.floor(
        (d.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24)
      );
      const cycleIndex = Math.floor(daysSinceEpoch / 14);
      const cycleStartDate = new Date(epoch);
      cycleStartDate.setUTCDate(
        cycleStartDate.getUTCDate() + cycleIndex * 14
      );
      const cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setUTCDate(cycleEndDate.getUTCDate() + 13);
      return {
        cycleStart: formatDate(cycleStartDate),
        cycleEnd: formatDate(cycleEndDate),
      };
    }

    case "monthly": {
      const first = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
      );
      const last = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
      );
      return { cycleStart: formatDate(first), cycleEnd: formatDate(last) };
    }

    default:
      return getCycleBoundsForDate("weekly", date, createdAt);
  }
}

/**
 * Returns a 0–1 value representing how far through the current cycle we are.
 */
function getCycleProgress(cycle: {
  cycleStart: string;
  cycleEnd: string;
}): number {
  const now = new Date();
  const start = startOfDay(cycle.cycleStart);
  const end = startOfDay(cycle.cycleEnd);
  // Add 1 day to end because cycle_end is inclusive
  const endInclusive = new Date(end);
  endInclusive.setUTCDate(endInclusive.getUTCDate() + 1);

  const totalMs = endInclusive.getTime() - start.getTime();
  if (totalMs <= 0) return 1;

  const elapsedMs = now.getTime() - start.getTime();
  return Math.min(1, Math.max(0, elapsedMs / totalMs));
}

/**
 * Normalize Supabase join results — single relations may come back as an array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRelation(rel: any): any {
  return Array.isArray(rel) ? rel[0] : rel;
}
