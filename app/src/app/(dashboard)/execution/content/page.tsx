import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { ContentMachinesView } from "./content-view";

export default async function ContentPage() {
  const [supabase, ctx] = await Promise.all([
    createClient(),
    getCachedUserContext(),
  ]);

  if (!ctx) {
    return <p className="text-subtle p-8">Please sign in to view content.</p>;
  }

  const [{ data: pieces }, { count: pendingInboxCount }] = await Promise.all([
    supabase
      .from("content_pieces")
      .select("*")
      .eq("venture_id", ctx.ventureId)
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
