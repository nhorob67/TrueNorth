import type { Vision } from "@/types/database";
import type { ProjectedDocument } from "../types";

export function projectVision(vision: Vision): ProjectedDocument {
  const sections: string[] = [];

  sections.push(`BHAG: ${vision.bhag}`);

  if (vision.strategic_filters.length > 0) {
    sections.push(
      "Strategic Filters:\n" +
        vision.strategic_filters
          .map((f) => `- ${f.name}: ${f.description}`)
          .join("\n")
    );
  }

  if (vision.annual_outcomes.length > 0) {
    sections.push(
      "Annual Outcomes:\n" +
        vision.annual_outcomes
          .map((o) => `- ${o.description}`)
          .join("\n")
    );
  }

  if (vision.not_doing_list.length > 0) {
    sections.push(
      "Not Doing:\n" + vision.not_doing_list.map((n) => `- ${n}`).join("\n")
    );
  }

  const contentText = sections.join("\n\n");

  return {
    entityType: "vision",
    entityId: vision.id,
    title: `${vision.year} Vision — ${vision.bhag.slice(0, 80)}`,
    contentText,
    canonicalUrl: `/strategy/vision`,
    snippetText: `${vision.year} BHAG: ${vision.bhag.slice(0, 180)}`,
    anchorLabel: `Vision ${vision.year}`,
    metadata: {
      year: vision.year,
      locked: vision.locked,
      venture_id: vision.venture_id,
    },
  };
}
