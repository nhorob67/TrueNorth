// ============================================================
// One-Ask Rule Engine
//
// BUILDPLAN 3.1: "One-Ask Rule enforcement: block competing CTAs
// for same audience within 30-day window"
//
// Detects when content pieces targeting the same funnel (audience)
// are scheduled within 30 days of each other. Returns conflicts
// so the UI can warn the user.
// ============================================================

interface ScheduledContent {
  id: string;
  title: string;
  scheduled_at: string;
  linked_funnel_id: string | null;
}

export interface OneAskConflict {
  pieceId: string;
  pieceTitle: string;
  conflictingPieceId: string;
  conflictingPieceTitle: string;
  funnelId: string;
  daysBetween: number;
}

const ONE_ASK_WINDOW_DAYS = 30;

/**
 * Detect One-Ask Rule violations: content pieces targeting the same
 * funnel (audience) within a 30-day window.
 */
export function detectOneAskConflicts(
  pieces: ScheduledContent[]
): OneAskConflict[] {
  const conflicts: OneAskConflict[] = [];
  const seen = new Set<string>();

  // Only consider pieces that have both a schedule date and a funnel link
  const scheduled = pieces.filter((p) => p.scheduled_at && p.linked_funnel_id);

  // Group by funnel
  const byFunnel = new Map<string, ScheduledContent[]>();
  for (const piece of scheduled) {
    const funnelId = piece.linked_funnel_id!;
    const group = byFunnel.get(funnelId) ?? [];
    group.push(piece);
    byFunnel.set(funnelId, group);
  }

  // Within each funnel group, check pairwise date proximity
  for (const [funnelId, group] of byFunnel) {
    if (group.length < 2) continue;

    // Sort by date
    const sorted = [...group].sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const dateA = new Date(sorted[i].scheduled_at);
        const dateB = new Date(sorted[j].scheduled_at);
        const daysBetween = Math.abs(
          Math.round(
            (dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        if (daysBetween <= ONE_ASK_WINDOW_DAYS) {
          const key = [sorted[i].id, sorted[j].id].sort().join("-");
          if (seen.has(key)) continue;
          seen.add(key);

          conflicts.push({
            pieceId: sorted[i].id,
            pieceTitle: sorted[i].title,
            conflictingPieceId: sorted[j].id,
            conflictingPieceTitle: sorted[j].title,
            funnelId,
            daysBetween,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect overlapping audience segments across funnels.
 * Two funnels overlap if they share the same entry_point or
 * capture_mechanism (proxy for "same audience").
 */
export interface AudienceOverlap {
  funnelAId: string;
  funnelAName: string;
  funnelBId: string;
  funnelBName: string;
  overlapField: "entry_point" | "capture_mechanism";
  sharedValue: string;
}

interface FunnelForOverlap {
  id: string;
  name: string;
  entry_point: string | null;
  capture_mechanism: string | null;
}

export function detectAudienceOverlaps(
  funnels: FunnelForOverlap[]
): AudienceOverlap[] {
  const overlaps: AudienceOverlap[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < funnels.length; i++) {
    for (let j = i + 1; j < funnels.length; j++) {
      const a = funnels[i];
      const b = funnels[j];

      for (const field of ["entry_point", "capture_mechanism"] as const) {
        const valA = a[field]?.trim().toLowerCase();
        const valB = b[field]?.trim().toLowerCase();
        if (valA && valB && valA === valB) {
          const key = [a.id, b.id].sort().join("-") + field;
          if (seen.has(key)) continue;
          seen.add(key);

          overlaps.push({
            funnelAId: a.id,
            funnelAName: a.name,
            funnelBId: b.id,
            funnelBName: b.name,
            overlapField: field,
            sharedValue: a[field]!,
          });
        }
      }
    }
  }

  return overlaps;
}
