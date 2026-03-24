import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { getProgress } from "@/lib/onboarding";
import { redirect } from "next/navigation";
import { LaunchWizard } from "./launch-wizard";
import type { StepContext } from "@/lib/ai/launch-assistant";

export default async function LaunchPage() {
  const [supabase, ctx] = await Promise.all([
    getCachedClient(),
    getCachedUserContext(),
  ]);
  if (!ctx) redirect("/login");

  let progress = await getProgress(supabase, ctx.ventureId);

  // Create progress record if it doesn't exist
  if (!progress) {
    await supabase.from("onboarding_progress").insert({
      venture_id: ctx.ventureId,
      steps: {},
      current_step: 1,
    });
    progress = await getProgress(supabase, ctx.ventureId);
  }

  // Allow re-entry: don't redirect if completed, let the wizard handle it
  // The wizard shows a "Back to Cockpit" button when all steps are complete

  const { data: venture } = await supabase
    .from("ventures")
    .select("name, settings")
    .eq("id", ctx.ventureId)
    .single();

  // Check if this org has other ventures with completed onboarding (second-venture flow)
  let isSecondVenture = false;
  let firstVentureContext: StepContext | undefined;

  const { data: otherVentures } = await supabase
    .from("ventures")
    .select("id, name, settings")
    .eq("organization_id", ctx.orgId)
    .neq("id", ctx.ventureId)
    .limit(1);

  if (otherVentures && otherVentures.length > 0) {
    const otherVenture = otherVentures[0];
    const otherProgress = await getProgress(supabase, otherVenture.id);
    if (otherProgress?.completed) {
      isSecondVenture = true;
      const otherSettings = (otherVenture.settings ?? {}) as Record<string, unknown>;
      firstVentureContext = {
        ventureName: otherVenture.name ?? undefined,
        bhag: (otherSettings.bhag as string) ?? undefined,
        filters: (otherSettings.strategic_filters as string[]) ?? undefined,
        outcomes: (otherSettings.annual_outcomes as string[]) ?? undefined,
      };
    }
  }

  return (
    <LaunchWizard
      progress={progress!}
      ventureName={venture?.name ?? ""}
      ventureSettings={(venture?.settings ?? {}) as Record<string, unknown>}
      ventureId={ctx.ventureId}
      orgId={ctx.orgId}
      isSecondVenture={isSecondVenture}
      firstVentureContext={firstVentureContext}
    />
  );
}
