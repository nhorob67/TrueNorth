import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { computeOperatingHealth } from "@/lib/operating-health";
import { HealthView } from "./health-view";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const supabase = await getCachedClient();
  const ctx = await getCachedUserContext();
  if (!ctx) return <p className="text-subtle p-8">Unable to load user context.</p>;

  const report = await computeOperatingHealth(
    supabase,
    ctx.orgId,
    ctx.ventureId,
    ctx.isSingleVenture
  );

  // Fetch recent snapshots for trend chart
  const { data: snapshots } = await supabase
    .from("operating_health_snapshots")
    .select("composite_score, composite_status, ai_interpretation, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("venture_id", ctx.ventureId)
    .order("created_at", { ascending: false })
    .limit(12);

  // Fetch latest AI interpretation
  const latestInterpretation = (snapshots ?? []).find((s) => s.ai_interpretation)?.ai_interpretation ?? null;

  // Fetch ventures list for multi-venture orgs
  const { data: ventures } = await supabase
    .from("ventures")
    .select("id, name")
    .eq("organization_id", ctx.orgId)
    .order("name");

  return (
    <HealthView
      report={report}
      snapshots={(snapshots ?? []).reverse()}
      latestInterpretation={latestInterpretation}
      isSingleVenture={ctx.isSingleVenture}
      ventures={ventures ?? []}
      currentVentureId={ctx.ventureId}
    />
  );
}
