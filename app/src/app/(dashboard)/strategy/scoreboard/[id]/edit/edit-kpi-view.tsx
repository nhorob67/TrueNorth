"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface Kpi {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  frequency: string;
  tier: string;
  directionality: string;
  target: number | null;
  threshold_logic: Record<string, number>;
  action_playbook: Record<string, string>;
  formula_description: string | null;
  lifecycle_status: string;
}

export function EditKpiView({ kpi }: { kpi: Kpi }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    const thresholdLogic: Record<string, number> = {};
    const yellowThreshold = form.get("yellow_threshold");
    const redThreshold = form.get("red_threshold");
    if (yellowThreshold) thresholdLogic.yellow = Number(yellowThreshold);
    if (redThreshold) thresholdLogic.red = Number(redThreshold);

    const actionPlaybook: Record<string, string> = {};
    const yellowAction = form.get("action_yellow");
    const redAction = form.get("action_red");
    if (yellowAction) actionPlaybook.yellow = yellowAction as string;
    if (redAction) actionPlaybook.red = redAction as string;

    const { error: updateError } = await supabase
      .from("kpis")
      .update({
        name: form.get("name") as string,
        description: (form.get("description") as string) || null,
        unit: (form.get("unit") as string) || null,
        frequency: form.get("frequency") as string,
        tier: form.get("tier") as string,
        directionality: form.get("directionality") as string,
        target: form.get("target") ? Number(form.get("target")) : null,
        formula_description: (form.get("formula_description") as string) || null,
        lifecycle_status: form.get("lifecycle_status") as string,
        threshold_logic: thresholdLogic,
        action_playbook: actionPlaybook,
      })
      .eq("id", kpi.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      router.push(`/strategy/scoreboard/${kpi.id}`);
      router.refresh();
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button
        variant="tertiary"
        size="sm"
        onClick={() => router.push(`/strategy/scoreboard/${kpi.id}`)}
        className="mb-4"
      >
        Back to KPI
      </Button>

      <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Edit KPI</h1>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <Input
              id="name"
              name="name"
              label="KPI Name"
              required
              defaultValue={kpi.name}
            />
            <Input
              id="description"
              name="description"
              label="Description"
              defaultValue={kpi.description ?? ""}
            />
            <Input
              id="formula_description"
              name="formula_description"
              label="Formula"
              defaultValue={kpi.formula_description ?? ""}
              placeholder="e.g., SUM(revenue WHERE date >= today - 365 days)"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="frequency" className="block text-sm font-medium text-ink">Frequency</label>
                <select
                  id="frequency"
                  name="frequency"
                  className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  defaultValue={kpi.frequency}
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
                  defaultValue={kpi.tier}
                >
                  <option value="tier1">Tier 1 (Lagging)</option>
                  <option value="tier2">Tier 2 (Leading)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="unit"
                name="unit"
                label="Unit"
                defaultValue={kpi.unit ?? ""}
                placeholder="e.g., $, %, users"
              />
              <div className="space-y-1">
                <label htmlFor="directionality" className="block text-sm font-medium text-ink">Direction</label>
                <select
                  id="directionality"
                  name="directionality"
                  className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  defaultValue={kpi.directionality}
                >
                  <option value="up_is_good">Up is good</option>
                  <option value="down_is_good">Down is good</option>
                  <option value="target_is_good">Target is good</option>
                </select>
              </div>
            </div>

            <Input
              id="target"
              name="target"
              label="Target"
              type="number"
              step="any"
              defaultValue={kpi.target ?? ""}
              placeholder="Target value"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="yellow_threshold"
                name="yellow_threshold"
                label="Yellow threshold"
                type="number"
                step="any"
                defaultValue={kpi.threshold_logic?.yellow ?? ""}
                placeholder="Warn below/above"
              />
              <Input
                id="red_threshold"
                name="red_threshold"
                label="Red threshold"
                type="number"
                step="any"
                defaultValue={kpi.threshold_logic?.red ?? ""}
                placeholder="Alert below/above"
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-subtle uppercase">Action Playbook</p>
              <Input
                id="action_yellow"
                name="action_yellow"
                label="Yellow action"
                defaultValue={kpi.action_playbook?.yellow ?? ""}
                placeholder="What to do when this KPI turns yellow"
              />
              <Input
                id="action_red"
                name="action_red"
                label="Red action"
                defaultValue={kpi.action_playbook?.red ?? ""}
                placeholder="What to do when this KPI turns red"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="lifecycle_status" className="block text-sm font-medium text-ink">Status</label>
              <select
                id="lifecycle_status"
                name="lifecycle_status"
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                defaultValue={kpi.lifecycle_status}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {error && <p className="text-sm text-semantic-brick">{error}</p>}
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
