"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { PolicyEnforcement } from "@/lib/policies/engine";

// ============================================================
// Types
// ============================================================

interface PolicyDef {
  name: string;
  description: string;
  scope: "venture" | "organization";
  enforcement: PolicyEnforcement;
  overrideAllowed: boolean;
  userExplanation: string;
}

interface Override {
  id: string;
  policy_name: string;
  overridden_by: string;
  justification: string;
  entity_id: string | null;
  entity_type: string | null;
  created_at: string;
}

interface VentureInfo {
  id: string;
  name: string;
  settings: Record<string, unknown>;
}

// ============================================================
// Enforcement badge config
// ============================================================

function enforcementBadge(e: PolicyEnforcement) {
  switch (e) {
    case "hard_block":
      return { label: "Hard Block", status: "red" as const };
    case "soft_warning":
      return { label: "Soft Warning", status: "yellow" as const };
    case "override_allowed":
      return { label: "Override Allowed", status: "neutral" as const };
  }
}

// ============================================================
// Policy Card
// ============================================================

function PolicyCard({
  policy,
  overrideCount,
}: {
  policy: PolicyDef;
  overrideCount: number;
}) {
  const badge = enforcementBadge(policy.enforcement);

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-charcoal">
            {policy.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </h3>
        </div>
        <p className="text-xs text-warm-gray">{policy.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge status={badge.status} dot={false}>
            {badge.label}
          </Badge>
          <Badge status="neutral" dot={false}>
            {policy.scope}
          </Badge>
          {overrideCount > 0 && (
            <Badge status="yellow" dot={false}>
              {overrideCount} override{overrideCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <p className="text-xs text-warm-gray italic">{policy.userExplanation}</p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Override Log Table
// ============================================================

function OverrideLogTable({
  overrides,
  userNameMap,
  policies,
}: {
  overrides: Override[];
  userNameMap: Record<string, string>;
  policies: PolicyDef[];
}) {
  const [filterPolicy, setFilterPolicy] = useState("all");
  const [sortField, setSortField] = useState<"created_at" | "policy_name">("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let list = overrides;
    if (filterPolicy !== "all") {
      list = list.filter((o) => o.policy_name === filterPolicy);
    }
    return [...list].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
  }, [overrides, filterPolicy, sortField, sortAsc]);

  const policyNames = [...new Set(overrides.map((o) => o.policy_name))];

  function toggleSort(field: "created_at" | "policy_name") {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-charcoal">Override Log (Last 90 Days)</h2>
          <select
            value={filterPolicy}
            onChange={(e) => setFilterPolicy(e.target.value)}
            className="text-xs border border-warm-border rounded-lg px-2 py-1 bg-ivory text-charcoal"
          >
            <option value="all">All Policies</option>
            {policyNames.map((name) => (
              <option key={name} value={name}>
                {name.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="px-6 py-4 text-sm text-warm-gray">No overrides found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-warm-border text-left text-warm-gray">
                  <th
                    className="px-4 py-2 cursor-pointer hover:text-charcoal"
                    onClick={() => toggleSort("created_at")}
                  >
                    Date {sortField === "created_at" ? (sortAsc ? "^" : "v") : ""}
                  </th>
                  <th
                    className="px-4 py-2 cursor-pointer hover:text-charcoal"
                    onClick={() => toggleSort("policy_name")}
                  >
                    Policy {sortField === "policy_name" ? (sortAsc ? "^" : "v") : ""}
                  </th>
                  <th className="px-4 py-2">Overridden By</th>
                  <th className="px-4 py-2">Justification</th>
                  <th className="px-4 py-2">Entity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-warm-border/50 hover:bg-parchment/50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">{o.policy_name.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2">{userNameMap[o.overridden_by] ?? "Unknown"}</td>
                    <td className="px-4 py-2 max-w-[200px] truncate">{o.justification}</td>
                    <td className="px-4 py-2 text-warm-gray">
                      {o.entity_type ? `${o.entity_type}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Override Analytics
// ============================================================

function OverrideAnalytics({ overrides }: { overrides: Override[] }) {
  const countByPolicy = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of overrides) {
      map.set(o.policy_name, (map.get(o.policy_name) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [overrides]);

  const topJustifications = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of overrides) {
      const key = o.justification.slice(0, 60);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));
  }, [overrides]);

  const maxCount = countByPolicy.length > 0 ? countByPolicy[0].count : 1;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-charcoal">Override Analytics</h2>
        <p className="text-xs text-warm-gray">
          Where is the team pushing against constraints?
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bar chart */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-charcoal">Overrides by Policy</h3>
          {countByPolicy.length === 0 ? (
            <p className="text-xs text-warm-gray">No overrides in the last 90 days.</p>
          ) : (
            <div className="space-y-1.5">
              {countByPolicy.map(({ name, count }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs text-warm-gray w-40 truncate">
                    {name.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 bg-parchment rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-semantic-ochre rounded-full transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-charcoal w-6 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top justifications */}
        {topJustifications.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-charcoal">Top Justifications</h3>
            <div className="space-y-1">
              {topJustifications.map(({ text, count }, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="font-medium text-charcoal shrink-0">{count}x</span>
                  <span className="text-warm-gray">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Venture Policy Toggles
// ============================================================

function VenturePolicyToggles({
  ventures,
  policies,
  orgId,
}: {
  ventures: VentureInfo[];
  policies: PolicyDef[];
  orgId: string;
}) {
  const overrideablePolicies = policies.filter((p) => p.overrideAllowed);
  const [selectedVenture, setSelectedVenture] = useState(ventures[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const venture = ventures.find((v) => v.id === selectedVenture);
  const disabledPolicies = ((venture?.settings?.disabled_policies ?? []) as string[]);

  const [localDisabled, setLocalDisabled] = useState<string[]>(disabledPolicies);

  // Reset localDisabled when venture changes
  const ventureDisabled = useMemo(() => {
    const v = ventures.find((v) => v.id === selectedVenture);
    return ((v?.settings?.disabled_policies ?? []) as string[]);
  }, [selectedVenture, ventures]);

  // Sync localDisabled on venture change
  const [lastVenture, setLastVenture] = useState(selectedVenture);
  if (lastVenture !== selectedVenture) {
    setLastVenture(selectedVenture);
    setLocalDisabled(ventureDisabled);
  }

  async function togglePolicy(policyName: string) {
    const next = localDisabled.includes(policyName)
      ? localDisabled.filter((p) => p !== policyName)
      : [...localDisabled, policyName];
    setLocalDisabled(next);

    setSaving(true);
    const supabase = createClient();
    const currentSettings = venture?.settings ?? {};
    await supabase
      .from("ventures")
      .update({
        settings: { ...currentSettings, disabled_policies: next },
      })
      .eq("id", selectedVenture);
    setSaving(false);
  }

  if (ventures.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-charcoal">Venture Policy Overrides</h2>
          <select
            value={selectedVenture}
            onChange={(e) => setSelectedVenture(e.target.value)}
            className="text-xs border border-warm-border rounded-lg px-2 py-1 bg-ivory text-charcoal"
          >
            {ventures.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-warm-gray mb-3">
          Disable specific overrideable policies for this venture. Hard-block policies cannot be disabled.
        </p>
        <div className="space-y-2">
          {overrideablePolicies.map((p) => {
            const isDisabled = localDisabled.includes(p.name);
            return (
              <label
                key={p.name}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-parchment cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!isDisabled}
                  onChange={() => togglePolicy(p.name)}
                  className="rounded border-warm-border text-moss focus:ring-moss"
                />
                <div className="flex-1">
                  <span className="text-sm text-charcoal">
                    {p.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <p className="text-xs text-warm-gray">{p.description}</p>
                </div>
                {isDisabled && (
                  <Badge status="yellow" dot={false}>
                    Disabled
                  </Badge>
                )}
              </label>
            );
          })}
        </div>
        {saving && <p className="text-xs text-warm-gray mt-2">Saving...</p>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main View
// ============================================================

export function PolicyDashboardView({
  policies,
  overrides,
  userNameMap,
  ventures,
  orgId,
}: {
  policies: PolicyDef[];
  overrides: Override[];
  userNameMap: Record<string, string>;
  ventures: VentureInfo[];
  orgId: string;
}) {
  // Compute override counts per policy
  const overrideCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of overrides) {
      map.set(o.policy_name, (map.get(o.policy_name) ?? 0) + 1);
    }
    return map;
  }, [overrides]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Policy Dashboard</h1>
        <p className="text-sm text-warm-gray mt-1">
          {policies.length} active policies governing your organization.
        </p>
      </div>

      {/* Active Policies Grid */}
      <div>
        <h2 className="text-lg font-semibold text-charcoal mb-3">Active Policies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map((p) => (
            <PolicyCard
              key={p.name}
              policy={p}
              overrideCount={overrideCounts.get(p.name) ?? 0}
            />
          ))}
        </div>
      </div>

      {/* Override Analytics */}
      <OverrideAnalytics overrides={overrides} />

      {/* Override Log */}
      <OverrideLogTable
        overrides={overrides}
        userNameMap={userNameMap}
        policies={policies}
      />

      {/* Venture Policy Toggles */}
      <VenturePolicyToggles
        ventures={ventures}
        policies={policies}
        orgId={orgId}
      />
    </div>
  );
}
