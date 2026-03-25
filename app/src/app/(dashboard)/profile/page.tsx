import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "./profile-view";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <p className="text-warm-gray">Not authenticated.</p>;

  const [
    { data: profile, error: e1 },
    { data: roleCard, error: e2 },
    { data: ownedKpis, error: e3 },
    { data: ownedBets, error: e4 },
    { data: activeCommitments, error: e5 },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
    supabase
      .from("role_cards")
      .select("*")
      .eq("entity_id", user.id)
      .eq("entity_type", "user")
      .single(),
    supabase
      .from("kpis")
      .select("id, name, health_status, current_value, target, unit")
      .eq("owner_id", user.id)
      .eq("lifecycle_status", "active"),
    supabase
      .from("bets")
      .select("id, outcome, health_status")
      .eq("owner_id", user.id)
      .eq("lifecycle_status", "active"),
    supabase
      .from("commitments")
      .select("id, description, status, due_date")
      .eq("owner_id", user.id)
      .in("status", ["pending", "on_track", "at_risk"])
      .order("due_date"),
  ]);

  const firstError = e1 || e2 || e3 || e4 || e5;
  if (firstError) console.error("Profile query error:", firstError);

  return (
    <ProfileView
      profile={profile}
      roleCard={roleCard}
      ownedKpis={ownedKpis ?? []}
      ownedBets={ownedBets ?? []}
      activeCommitments={activeCommitments ?? []}
    />
  );
}
