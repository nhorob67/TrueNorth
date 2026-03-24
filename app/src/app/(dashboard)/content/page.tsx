import { createClient } from "@/lib/supabase/server";
import { ContentMachinesView } from "./content-view";

export default async function ContentPage() {
  const supabase = await createClient();

  const { data: pieces } = await supabase
    .from("content_pieces")
    .select("*")
    .order("created_at", { ascending: false });

  return <ContentMachinesView pieces={pieces ?? []} />;
}
