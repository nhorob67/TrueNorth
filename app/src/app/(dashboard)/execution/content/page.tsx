import { createClient } from "@/lib/supabase/server";
import { ContentMachinesView } from "./content-view";

export default async function ContentPage() {
  const supabase = await createClient();

  const [{ data: pieces }, { count: pendingInboxCount }] = await Promise.all([
    supabase
      .from("content_pieces")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("newsletter_submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    <ContentMachinesView
      pieces={pieces ?? []}
      pendingInboxCount={pendingInboxCount ?? 0}
    />
  );
}
