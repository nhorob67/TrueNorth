import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProcessDetailView } from "./process-detail-view";

export default async function ProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch the process with owner profile
  const { data: process } = await supabase
    .from("processes")
    .select("*, user_profiles(full_name)")
    .eq("id", id)
    .single();

  if (!process) notFound();

  // Normalize owner
  const ownerProfile = Array.isArray(process.user_profiles)
    ? process.user_profiles[0]
    : process.user_profiles;

  // Fetch version history
  const { data: versions } = await supabase
    .from("process_versions")
    .select("*, user_profiles:changed_by(full_name)")
    .eq("process_id", id)
    .order("version", { ascending: false });

  const normalizedVersions = (versions ?? []).map((v) => {
    const profile = Array.isArray(v.user_profiles)
      ? v.user_profiles[0]
      : v.user_profiles;
    return {
      ...v,
      changed_by_name: profile?.full_name ?? "Unknown",
    };
  });

  // Fetch linked KPIs
  const kpiIds: string[] = process.linked_kpi_ids ?? [];
  let kpis: Array<{ id: string; name: string; health_status: string }> = [];
  if (kpiIds.length > 0) {
    const { data } = await supabase
      .from("kpis")
      .select("id, name, health_status")
      .in("id", kpiIds);
    kpis = data ?? [];
  }

  // Fetch linked Bets
  const betIds: string[] = process.linked_bet_ids ?? [];
  let bets: Array<{ id: string; outcome: string; health_status: string }> = [];
  if (betIds.length > 0) {
    const { data } = await supabase
      .from("bets")
      .select("id, outcome, health_status")
      .in("id", betIds);
    bets = data ?? [];
  }

  return (
    <ProcessDetailView
      process={{
        ...process,
        owner_name: ownerProfile?.full_name ?? "Unknown",
      }}
      versions={normalizedVersions}
      linkedKpis={kpis}
      linkedBets={bets}
    />
  );
}
