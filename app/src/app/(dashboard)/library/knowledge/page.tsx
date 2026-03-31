import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { redirect } from "next/navigation";
import { KnowledgeView } from "./knowledge-view";

export default async function KnowledgePage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx) redirect("/login");

  // Fetch knowledge sources for this org
  const { data: sources } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .order("name");

  // Fetch document counts per source
  const sourceIds = (sources ?? []).map((s) => s.id);
  const { data: docCounts } = sourceIds.length > 0
    ? await supabase
        .from("knowledge_documents")
        .select("source_id")
        .eq("organization_id", ctx.orgId)
        .in("source_id", sourceIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  for (const row of docCounts ?? []) {
    countMap.set(
      row.source_id,
      (countMap.get(row.source_id) ?? 0) + 1
    );
  }

  const sourcesWithCounts = (sources ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    source_type: s.source_type as string,
    connector_type: s.connector_type as string | null,
    status: s.status as string,
    visibility: s.visibility as string,
    last_synced_at: s.last_synced_at as string | null,
    last_sync_status: s.last_sync_status as string | null,
    document_count: countMap.get(s.id as string) ?? 0,
  }));

  return (
    <KnowledgeView
      sources={sourcesWithCounts}
      isAdmin={ctx.orgRole === "admin" || ctx.orgRole === "manager"}
    />
  );
}
