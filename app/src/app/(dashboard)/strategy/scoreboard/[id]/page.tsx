import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { KpiDetailView } from "./kpi-detail-view";

export default async function KpiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: kpi } = await supabase
    .from("kpis")
    .select("*")
    .eq("id", id)
    .single();

  if (!kpi) notFound();

  const { data: entries } = await supabase
    .from("kpi_entries")
    .select("*")
    .eq("kpi_id", id)
    .order("recorded_at", { ascending: false })
    .limit(50);

  return <KpiDetailView kpi={kpi} entries={entries ?? []} />;
}
