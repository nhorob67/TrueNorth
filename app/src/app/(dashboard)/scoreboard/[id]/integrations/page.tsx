import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { IntegrationsView } from "./integrations-view";

export default async function KpiIntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: kpi } = await supabase
    .from("kpis")
    .select("id, name, unit, organization_id")
    .eq("id", id)
    .single();

  if (!kpi) notFound();

  const { data: integrations } = await supabase
    .from("kpi_integrations")
    .select("*")
    .eq("kpi_id", id)
    .order("created_at", { ascending: false });

  return (
    <IntegrationsView
      kpi={kpi}
      integrations={integrations ?? []}
    />
  );
}
