"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface KpiEntry {
  id: string;
  value: number;
  recorded_at: string;
  source: string;
}

interface Kpi {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  frequency: string;
  tier: string;
  directionality: string;
  current_value: number | null;
  target: number | null;
  health_status: "green" | "yellow" | "red";
  threshold_logic: Record<string, number>;
  action_playbook: Record<string, string>;
}

function DataEntryForm({ kpiId, onAdded }: { kpiId: string; onAdded: () => void }) {
  const supabase = createClient();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setLoading(true);

    await supabase.from("kpi_entries").insert({
      kpi_id: kpiId,
      value: Number(value),
      recorded_at: new Date(date).toISOString(),
      source: "manual",
    });

    // Update current_value on the KPI
    await supabase
      .from("kpis")
      .update({ current_value: Number(value) })
      .eq("id", kpiId);

    setValue("");
    setLoading(false);
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <Input
        label="Value"
        type="number"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
      />
      <Input
        label="Date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "..." : "Log"}
      </Button>
    </form>
  );
}

export function KpiDetailView({
  kpi,
  entries,
}: {
  kpi: Kpi;
  entries: KpiEntry[];
}) {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto">
      <Button
        variant="tertiary"
        size="sm"
        onClick={() => router.push("/scoreboard")}
        className="mb-4"
      >
        Back to Scoreboard
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-[22px] font-bold tracking-[-0.02em]">{kpi.name}</h1>
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => router.push(`/scoreboard/${kpi.id}/integrations`)}
                >
                  Integrations
                </Button>
              </div>
              {kpi.description && (
                <p className="text-sm text-subtle mt-1">
                  {kpi.description}
                </p>
              )}
            </div>
            <Badge status={kpi.health_status}>
              {kpi.health_status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs text-subtle uppercase font-semibold">
                Current
              </p>
              <p className="text-2xl font-mono font-bold">
                {kpi.current_value ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-subtle uppercase font-semibold">
                Target
              </p>
              <p className="text-2xl font-mono">{kpi.target ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-subtle uppercase font-semibold">
                Frequency
              </p>
              <p className="text-sm capitalize">{kpi.frequency}</p>
            </div>
          </div>

          {/* Action Playbook */}
          {(kpi.action_playbook.yellow || kpi.action_playbook.red) && (
            <div className="mb-6 p-3 rounded-lg bg-canvas border border-line">
              <p className="text-xs font-semibold text-subtle uppercase mb-2">
                Action Playbook
              </p>
              {kpi.action_playbook.yellow && (
                <p className="text-sm">
                  <span className="text-semantic-ochre-text font-medium">
                    Yellow:
                  </span>{" "}
                  {kpi.action_playbook.yellow}
                </p>
              )}
              {kpi.action_playbook.red && (
                <p className="text-sm mt-1">
                  <span className="text-semantic-brick font-medium">Red:</span>{" "}
                  {kpi.action_playbook.red}
                </p>
              )}
            </div>
          )}

          {/* Data Entry */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-2">Log Data Point</h2>
            <DataEntryForm kpiId={kpi.id} onAdded={() => router.refresh()} />
          </div>

          {/* Entry History */}
          <div>
            <h2 className="text-sm font-semibold mb-2">
              History ({entries.length})
            </h2>
            {entries.length === 0 ? (
              <p className="text-sm text-subtle">No data points yet.</p>
            ) : (
              <div className="space-y-1">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-1.5 border-b border-line last:border-0"
                  >
                    <span className="text-sm font-mono">
                      {entry.value}
                      {kpi.unit ? ` ${kpi.unit}` : ""}
                    </span>
                    <span className="text-xs text-subtle">
                      {new Date(entry.recorded_at).toLocaleDateString()}{" "}
                      <span className="text-subtle/60">({entry.source})</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
