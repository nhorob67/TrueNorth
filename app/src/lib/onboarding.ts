import { SupabaseClient } from "@supabase/supabase-js";

export const ONBOARDING_STEPS = [
  { number: 1, name: "Name Your Venture", description: "Give your venture a name" },
  { number: 2, name: "Define Your BHAG", description: "Set your Big Hairy Audacious Goal" },
  { number: 3, name: "Strategic Filters", description: "Define what you say yes and no to" },
  { number: 4, name: "Annual Outcomes", description: "Set up to 3 annual outcomes" },
  { number: 5, name: "Build Scoreboard", description: "Create your first KPIs" },
  { number: 6, name: "Choose Your Bets", description: "Pick up to 3 quarterly bets" },
  { number: 7, name: "Invite Team", description: "Bring your team on board" },
  { number: 8, name: "First Pulse", description: "Submit your first daily pulse" },
  { number: 9, name: "Weekly Sync", description: "Schedule your weekly sync" },
  { number: 10, name: "Monthly Review", description: "Set up your monthly review cadence" },
] as const;

export interface OnboardingProgress {
  id: string;
  venture_id: string;
  steps: Record<string, { completed: boolean; data?: Record<string, unknown> }>;
  current_step: number;
  completed: boolean;
}

export async function getProgress(
  supabase: SupabaseClient,
  ventureId: string
): Promise<OnboardingProgress | null> {
  const { data } = await supabase
    .from("onboarding_progress")
    .select("*")
    .eq("venture_id", ventureId)
    .single();
  return data as OnboardingProgress | null;
}

export async function saveStepData(
  supabase: SupabaseClient,
  ventureId: string,
  step: number,
  data: Record<string, unknown>
) {
  const progress = await getProgress(supabase, ventureId);
  if (!progress) return;

  const steps = { ...progress.steps };
  steps[String(step)] = { completed: false, data };

  await supabase
    .from("onboarding_progress")
    .update({ steps, current_step: Math.max(progress.current_step, step) })
    .eq("venture_id", ventureId);
}

export async function markStepComplete(
  supabase: SupabaseClient,
  ventureId: string,
  step: number
) {
  const progress = await getProgress(supabase, ventureId);
  if (!progress) return;

  const steps = { ...progress.steps };
  const existing = steps[String(step)] ?? {};
  steps[String(step)] = { ...existing, completed: true };

  const nextStep = Math.min(step + 1, ONBOARDING_STEPS.length);
  const allComplete = ONBOARDING_STEPS.every(
    (s) => steps[String(s.number)]?.completed
  );

  await supabase
    .from("onboarding_progress")
    .update({
      steps,
      current_step: nextStep,
      completed: allComplete,
    })
    .eq("venture_id", ventureId);
}

export function completedCount(
  steps: Record<string, { completed: boolean }>
): number {
  return ONBOARDING_STEPS.filter(
    (s) => steps[String(s.number)]?.completed
  ).length;
}
