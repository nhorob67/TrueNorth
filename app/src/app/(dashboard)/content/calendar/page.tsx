import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createClient();

  const [{ data: pieces }, { data: funnels }] = await Promise.all([
    supabase
      .from("content_pieces")
      .select("*")
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("funnels")
      .select("id, name")
      .order("name"),
  ]);

  return (
    <CalendarView
      pieces={pieces ?? []}
      funnels={funnels ?? []}
    />
  );
}
