import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { checkStaleness } from "@/lib/staleness";
import { ArtifactsView } from "./artifacts-view";

export default async function ArtifactsPage() {
  const [supabase, ctx] = await Promise.all([
    getCachedClient(),
    getCachedUserContext(),
  ]);

  if (!ctx) return <p className="text-subtle">Not authenticated.</p>;

  const stalenessResults = await checkStaleness(
    supabase,
    ctx.ventureId,
    ctx.orgId
  );

  return <ArtifactsView artifacts={stalenessResults} />;
}
