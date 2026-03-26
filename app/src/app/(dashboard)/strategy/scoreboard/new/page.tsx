"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export default function NewKpiPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    // Get user's current venture context
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      setError("No organization found.");
      setLoading(false);
      return;
    }

    const { data: venture } = await supabase
      .from("ventures")
      .select("id")
      .eq("organization_id", membership.organization_id)
      .limit(1)
      .single();

    if (!venture) {
      setError("No venture found.");
      setLoading(false);
      return;
    }

    const thresholdLogic: Record<string, number> = {};
    const yellowThreshold = form.get("yellow_threshold");
    const redThreshold = form.get("red_threshold");
    if (yellowThreshold) thresholdLogic.yellow = Number(yellowThreshold);
    if (redThreshold) thresholdLogic.red = Number(redThreshold);

    const { error: insertError } = await supabase.from("kpis").insert({
      organization_id: membership.organization_id,
      venture_id: venture.id,
      name: form.get("name") as string,
      description: form.get("description") as string,
      unit: form.get("unit") as string,
      frequency: form.get("frequency") as string,
      tier: form.get("tier") as string,
      directionality: form.get("directionality") as string,
      target: form.get("target") ? Number(form.get("target")) : null,
      owner_id: user.id,
      threshold_logic: thresholdLogic,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      router.push("/strategy/scoreboard");
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Add KPI</h1>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <Input id="name" name="name" label="KPI Name" required placeholder="e.g., Monthly Recurring Revenue" />
            <Input id="description" name="description" label="Description" placeholder="What does this KPI measure?" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="frequency" className="block text-sm font-medium text-ink">Frequency</label>
                <select
                  id="frequency"
                  name="frequency"
                  className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  defaultValue="weekly"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="tier" className="block text-sm font-medium text-ink">Tier</label>
                <select
                  id="tier"
                  name="tier"
                  className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  defaultValue="tier2"
                >
                  <option value="tier1">Tier 1 (Lagging)</option>
                  <option value="tier2">Tier 2 (Leading)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input id="unit" name="unit" label="Unit" placeholder="e.g., $, %, users" />
              <div className="space-y-1">
                <label htmlFor="directionality" className="block text-sm font-medium text-ink">Direction</label>
                <select
                  id="directionality"
                  name="directionality"
                  className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  defaultValue="up_is_good"
                >
                  <option value="up_is_good">Up is good</option>
                  <option value="down_is_good">Down is good</option>
                  <option value="target_is_good">Target is good</option>
                </select>
              </div>
            </div>

            <Input id="target" name="target" label="Target" type="number" step="any" placeholder="Target value" />

            <div className="grid grid-cols-2 gap-4">
              <Input id="yellow_threshold" name="yellow_threshold" label="Yellow threshold" type="number" step="any" placeholder="Warn below/above" />
              <Input id="red_threshold" name="red_threshold" label="Red threshold" type="number" step="any" placeholder="Alert below/above" />
            </div>

            {error && <p className="text-sm text-semantic-brick">{error}</p>}
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Create KPI"}</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
