import type { SupabaseClient } from "@supabase/supabase-js";
import { indexInternalEntity } from "./index-internal-entity";
import { projectVision } from "./projectors/vision-projector";
import { projectKpi } from "./projectors/kpi-projector";
import { projectBet } from "./projectors/bet-projector";
import { projectProcess } from "./projectors/process-projector";

/**
 * Reindex all internal entities for an organization.
 * Ensures an "internal_entity" source exists, then projects and indexes
 * visions, KPIs, bets, and processes.
 */
export async function reindexOrganization(
  supabase: SupabaseClient,
  orgId: string,
  ventureId: string
) {
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };

  // Ensure internal entity source exists
  let { data: source } = await supabase
    .from("knowledge_sources")
    .select("id")
    .eq("organization_id", orgId)
    .eq("source_type", "internal_entity")
    .eq("name", "TrueNorth Operating System")
    .single();

  if (!source) {
    const { data: newSource } = await supabase
      .from("knowledge_sources")
      .insert({
        organization_id: orgId,
        venture_id: ventureId,
        name: "TrueNorth Operating System",
        source_type: "internal_entity",
        status: "active",
        visibility: "org",
      })
      .select("id")
      .single();
    source = newSource;
  }

  if (!source) {
    return { error: "Failed to create internal entity source", stats };
  }

  const sourceId = source.id;

  async function indexEntity(projected: ReturnType<typeof projectVision>) {
    const result = await indexInternalEntity(
      supabase,
      orgId,
      ventureId,
      sourceId,
      projected
    );
    if (result.action === "created") stats.created++;
    else if (result.action === "updated") stats.updated++;
    else if (result.action === "skipped") stats.skipped++;
    else stats.errors++;
  }

  // Index visions
  const { data: visions } = await supabase
    .from("visions")
    .select("*")
    .eq("organization_id", orgId);

  for (const vision of visions ?? []) {
    await indexEntity(projectVision(vision));
  }

  // Index KPIs
  const { data: kpis } = await supabase
    .from("kpis")
    .select("*")
    .eq("organization_id", orgId);

  for (const kpi of kpis ?? []) {
    await indexEntity(projectKpi(kpi));
  }

  // Index bets
  const { data: bets } = await supabase
    .from("bets")
    .select("*")
    .eq("organization_id", orgId);

  for (const bet of bets ?? []) {
    await indexEntity(projectBet(bet as Record<string, unknown>));
  }

  // Index processes
  const { data: processes } = await supabase
    .from("processes")
    .select("*")
    .eq("organization_id", orgId);

  for (const process of processes ?? []) {
    await indexEntity(projectProcess(process));
  }

  // Update source sync timestamp
  await supabase
    .from("knowledge_sources")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "completed",
    })
    .eq("id", sourceId);

  return { stats };
}
