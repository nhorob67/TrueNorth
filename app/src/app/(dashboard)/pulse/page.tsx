import { createClient } from "@/lib/supabase/server";
import { PulseView } from "./pulse-view";

export default async function PulsePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? "";

  const [
    { data: myPulse, error: e1 },
    { data: teamPulses, error: e2 },
    { data: bets, error: e3 },
    { data: profile, error: e4 },
  ] = await Promise.all([
    supabase
      .from("pulses")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single(),
    supabase
      .from("pulses")
      .select("*, user_profiles(full_name, avatar_url)")
      .eq("date", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("bets")
      .select("id, outcome")
      .eq("lifecycle_status", "active"),
    supabase
      .from("user_profiles")
      .select("pulse_streak")
      .eq("id", userId)
      .single(),
  ]);

  const firstError = e2 || e3;
  if (firstError) throw firstError;

  return (
    <PulseView
      myPulse={myPulse}
      teamPulses={teamPulses ?? []}
      bets={bets ?? []}
      userId={userId}
      pulseStreak={profile?.pulse_streak ?? 0}
    />
  );
}
