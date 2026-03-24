import { createClient } from "@/lib/supabase/server";
import { ProcessesView } from "./processes-view";

export default async function ProcessesPage() {
  const supabase = await createClient();

  const { data: processes } = await supabase
    .from("processes")
    .select("*, user_profiles(full_name)")
    .order("lifecycle_status", { ascending: true })
    .order("name", { ascending: true });

  // Normalize the joined profile
  const normalized = (processes ?? []).map((p) => {
    const profile = Array.isArray(p.user_profiles)
      ? p.user_profiles[0]
      : p.user_profiles;
    return {
      ...p,
      owner_name: profile?.full_name ?? "Unknown",
    };
  });

  return <ProcessesView processes={normalized} />;
}
