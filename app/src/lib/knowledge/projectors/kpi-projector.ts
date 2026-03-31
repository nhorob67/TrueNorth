import type { Kpi } from "@/types/database";
import type { ProjectedDocument } from "../types";

export function projectKpi(kpi: Kpi): ProjectedDocument {
  const sections: string[] = [];

  sections.push(`KPI: ${kpi.name}`);

  if (kpi.description) {
    sections.push(`Description: ${kpi.description}`);
  }

  if (kpi.formula_description) {
    sections.push(`Formula: ${kpi.formula_description}`);
  }

  sections.push(`Tier: ${kpi.tier} | Frequency: ${kpi.frequency} | Direction: ${kpi.directionality}`);

  if (kpi.target != null) {
    sections.push(`Target: ${kpi.target}${kpi.unit ? ` ${kpi.unit}` : ""}`);
  }

  if (kpi.current_value != null) {
    sections.push(`Current Value: ${kpi.current_value}${kpi.unit ? ` ${kpi.unit}` : ""}`);
  }

  sections.push(`Health: ${kpi.health_status} | Status: ${kpi.lifecycle_status}`);

  if (kpi.action_playbook && Object.keys(kpi.action_playbook).length > 0) {
    sections.push(
      "Action Playbook:\n" +
        Object.entries(kpi.action_playbook)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")
    );
  }

  const contentText = sections.join("\n\n");

  return {
    entityType: "kpi",
    entityId: kpi.id,
    title: kpi.name,
    contentText,
    canonicalUrl: `/strategy/scoreboard/${kpi.id}`,
    snippetText: `${kpi.name}${kpi.description ? ` — ${kpi.description.slice(0, 150)}` : ""}`,
    anchorLabel: kpi.name,
    metadata: {
      tier: kpi.tier,
      frequency: kpi.frequency,
      health_status: kpi.health_status,
      lifecycle_status: kpi.lifecycle_status,
      target: kpi.target,
      current_value: kpi.current_value,
      venture_id: kpi.venture_id,
    },
  };
}
