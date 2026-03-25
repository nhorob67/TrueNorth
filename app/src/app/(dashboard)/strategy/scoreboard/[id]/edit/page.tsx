import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EditKpiView } from "./edit-kpi-view";

export default async function EditKpiPage({
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

  return <EditKpiView kpi={kpi} />;
}
