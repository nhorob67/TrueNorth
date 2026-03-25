import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createClient();

  const [{ data: pieces }, { data: funnels }, { data: recurringMoves }] =
    await Promise.all([
      supabase
        .from("content_pieces")
        .select("*")
        .order("scheduled_at", { ascending: true }),
      supabase.from("funnels").select("id, name").order("name"),
      // Fetch active recurring moves that are linked to content machines
      supabase
        .from("moves")
        .select("id, title, cadence, target_per_cycle, content_machine_id, bets(outcome)")
        .eq("type", "recurring")
        .eq("lifecycle_status", "in_progress")
        .not("content_machine_id", "is", null),
    ]);

  const contentMoves = (recurringMoves ?? []).map(
    (m: Record<string, unknown>) => ({
      id: m.id as string,
      title: m.title as string,
      cadence: (m.cadence as string) ?? "weekly",
      target_per_cycle: (m.target_per_cycle as number) ?? 1,
      content_machine_id: m.content_machine_id as string,
      bet_outcome: Array.isArray(m.bets)
        ? (m.bets as Array<{ outcome: string }>)[0]?.outcome ?? ""
        : (m.bets as { outcome: string } | null)?.outcome ?? "",
    })
  );

  return (
    <CalendarView
      pieces={pieces ?? []}
      funnels={funnels ?? []}
      contentMoves={contentMoves}
    />
  );
}
