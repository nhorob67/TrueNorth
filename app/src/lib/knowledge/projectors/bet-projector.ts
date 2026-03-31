import type { ProjectedDocument } from "../types";

/**
 * Project a bet into a knowledge document.
 * Uses a loose record type since Bet interface is not yet defined in database.ts.
 */
export function projectBet(bet: Record<string, unknown>): ProjectedDocument {
  const sections: string[] = [];

  const outcome = (bet.outcome as string) ?? "Untitled bet";
  sections.push(`Bet: ${outcome}`);

  if (bet.rationale) {
    sections.push(`Rationale: ${bet.rationale as string}`);
  }

  if (bet.hypothesis) {
    sections.push(`Hypothesis: ${bet.hypothesis as string}`);
  }

  if (bet.success_criteria) {
    sections.push(`Success Criteria: ${bet.success_criteria as string}`);
  }

  const health = bet.health_status as string | undefined;
  const lifecycle = bet.lifecycle_status as string | undefined;
  if (health || lifecycle) {
    sections.push(`Health: ${health ?? "unknown"} | Status: ${lifecycle ?? "unknown"}`);
  }

  const contentText = sections.join("\n\n");
  const id = bet.id as string;

  return {
    entityType: "bet",
    entityId: id,
    title: outcome,
    contentText,
    canonicalUrl: `/execution/bets/${id}`,
    snippetText: outcome.slice(0, 200),
    anchorLabel: outcome.slice(0, 60),
    metadata: {
      health_status: health,
      lifecycle_status: lifecycle,
      venture_id: bet.venture_id,
    },
  };
}
