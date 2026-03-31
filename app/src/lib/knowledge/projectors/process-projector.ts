import type { Process } from "@/types/database";
import type { ProjectedDocument } from "../types";

export function projectProcess(process: Process): ProjectedDocument {
  const sections: string[] = [];

  sections.push(`Process: ${process.name}`);

  if (process.description) {
    sections.push(`Description: ${process.description}`);
  }

  sections.push(`Automation Level: L${process.automation_level}`);
  sections.push(`Status: ${process.lifecycle_status} | Version: ${process.version}`);

  if (process.trigger_conditions) {
    sections.push(`Trigger Conditions: ${process.trigger_conditions}`);
  }

  // Flatten rich text content if present
  if (process.content && typeof process.content === "object") {
    const textContent = extractTextFromContent(process.content);
    if (textContent) {
      sections.push(`Content:\n${textContent}`);
    }
  }

  if (process.linked_kpi_ids.length > 0) {
    sections.push(`Linked KPIs: ${process.linked_kpi_ids.length}`);
  }

  if (process.linked_bet_ids.length > 0) {
    sections.push(`Linked Bets: ${process.linked_bet_ids.length}`);
  }

  const contentText = sections.join("\n\n");

  return {
    entityType: "process",
    entityId: process.id,
    title: process.name,
    contentText,
    canonicalUrl: `/library/processes/${process.id}`,
    snippetText: `${process.name}${process.description ? ` — ${process.description.slice(0, 150)}` : ""}`,
    anchorLabel: process.name,
    metadata: {
      automation_level: process.automation_level,
      lifecycle_status: process.lifecycle_status,
      version: process.version,
      venture_id: process.venture_id,
    },
  };
}

/** Best-effort extraction of plain text from Tiptap JSON content */
function extractTextFromContent(content: Record<string, unknown>): string {
  if (typeof content !== "object" || !content) return "";

  const parts: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.text && typeof n.text === "string") {
      parts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }

  walk(content);
  return parts.join(" ").slice(0, 5000);
}
