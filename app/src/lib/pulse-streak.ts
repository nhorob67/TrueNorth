import { SupabaseClient } from "@supabase/supabase-js";

export async function computeStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: pulses } = await supabase
    .from("pulses")
    .select("date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(60);

  if (!pulses || pulses.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < pulses.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    const expectedStr = expectedDate.toISOString().split("T")[0];

    if (pulses[i].date === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  // Update the profile
  await supabase
    .from("user_profiles")
    .update({ pulse_streak: streak })
    .eq("id", userId);

  return streak;
}
