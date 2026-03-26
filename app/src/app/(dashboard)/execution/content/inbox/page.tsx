import { createClient } from "@/lib/supabase/server";
import { InboxView } from "./inbox-view";

export const dynamic = "force-dynamic";

export default async function NewsletterInboxPage() {
  const supabase = await createClient();

  const { data: submissions } = await supabase
    .from("newsletter_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  return <InboxView submissions={submissions ?? []} />;
}
