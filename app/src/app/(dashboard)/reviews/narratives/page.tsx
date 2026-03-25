import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { getNarrativeHistory, getTemplates } from "@/lib/ai/narrative-generator";
import { NarrativesView } from "./narratives-view";

export const dynamic = "force-dynamic";

export default async function NarrativesPage() {
  const supabase = await getCachedClient();
  const ctx = await getCachedUserContext();
  if (!ctx) return <p className="text-subtle p-8">Unable to load user context.</p>;

  const [history, templates] = await Promise.all([
    getNarrativeHistory(supabase, ctx.orgId, ctx.ventureId),
    Promise.resolve(getTemplates()),
  ]);

  return (
    <NarrativesView
      history={history}
      templates={templates.map((t) => ({
        type: t.type,
        label: t.label,
        description: t.description,
        defaultWindowDays: t.defaultWindowDays,
      }))}
      ventureId={ctx.ventureId}
      ventures={ctx.ventures}
      isSingleVenture={ctx.isSingleVenture}
    />
  );
}
