import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { VisionBoardView } from "./vision-view";

export default async function VisionPage() {
  const [supabase, ctx] = await Promise.all([
    createClient(),
    getCachedUserContext(),
  ]);

  if (!ctx) return <p className="text-warm-gray p-8">Please sign in to view the Vision Board.</p>;

  const { data: vision } = await supabase
    .from("visions")
    .select("*")
    .order("year", { ascending: false })
    .limit(1)
    .single();

  const { data: snapshots } = vision
    ? await supabase
        .from("vision_snapshots")
        .select("id, created_at, created_by")
        .eq("vision_id", vision.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  return <VisionBoardView vision={vision} snapshots={snapshots ?? []} />;
}
