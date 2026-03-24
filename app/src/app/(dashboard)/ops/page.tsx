import { createClient } from "@/lib/supabase/server";
import { OpsView } from "./ops-view";

export default async function OpsPage() {
  const supabase = await createClient();

  const [
    { data: decisions },
    { data: blockers },
    { data: commitments },
    { data: issues },
  ] = await Promise.all([
    supabase
      .from("decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("blockers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("commitments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("issues")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <OpsView
      decisions={decisions ?? []}
      blockers={blockers ?? []}
      commitments={commitments ?? []}
      issues={issues ?? []}
    />
  );
}
