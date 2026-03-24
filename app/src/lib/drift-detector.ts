import { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "./notifications";

export async function checkDrift(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data: recentPulses } = await supabase
    .from("pulses")
    .select("items")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(5);

  if (!recentPulses || recentPulses.length < 5) return false;

  // Check if any of the last 5 pulses have entity links
  const hasEntityLinks = recentPulses.some((pulse) => {
    const items = pulse.items as Array<{
      linked_entity_ids?: string[];
    }>;
    return items.some(
      (item) => item.linked_entity_ids && item.linked_entity_ids.length > 0
    );
  });

  if (!hasEntityLinks) {
    await sendNotification(supabase, {
      userId,
      orgId,
      type: "pulse_drift",
      tier: "urgent",
      title: "Pulse Drift Detected",
      body: "Your last 5 pulses haven't been connected to any bets or KPIs. Consider linking your work to strategic priorities.",
    });
    return true;
  }

  return false;
}
