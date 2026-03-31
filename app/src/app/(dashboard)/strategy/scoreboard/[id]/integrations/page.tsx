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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single();

  if (!membership || !["admin", "manager"].includes(membership.role)) {
    return (
      <div className="p-8">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
          Access Denied
        </h2>
        <p className="mt-2 text-subtle">
          Only administrators and managers can manage KPI integrations.
        </p>
      </div>
    );
  }

  const { data: kpi } = await supabase
    .from("kpis")
    .select("id, name, unit, organization_id")
    .eq("id", id)
    .single();

  if (!kpi || kpi.organization_id !== membership.organization_id) notFound();

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
