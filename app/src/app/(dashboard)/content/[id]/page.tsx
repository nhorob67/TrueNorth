import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ContentEditorView } from "./editor-view";

export default async function ContentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: piece } = await supabase
    .from("content_pieces")
    .select("*")
    .eq("id", id)
    .single();

  if (!piece) notFound();

  // Fetch version history
  const { data: versions } = await supabase
    .from("content_versions")
    .select("id, created_at, created_by")
    .eq("content_piece_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <ContentEditorView
      piece={piece}
      versions={versions ?? []}
    />
  );
}
