"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================================
// Types
// ============================================================

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  pulse_streak: number;
  settings: Record<string, unknown>;
}

interface RoleCard {
  id: string;
  entity_id: string;
  outcomes_owned: string[];
  metrics_moved: string[];
  decision_authority: string;
  interfaces: string;
  commitments_standard: string;
}

interface Kpi {
  id: string;
  name: string;
  health_status: "green" | "yellow" | "red";
  current_value: number | null;
  target: number | null;
  unit: string | null;
}

interface Bet {
  id: string;
  outcome: string;
  health_status: "green" | "yellow" | "red";
}

interface Commitment {
  id: string;
  description: string;
  status: string;
  due_date: string | null;
}

// ============================================================
// Live Metrics Section
// ============================================================

function MetricsMoved({ kpis }: { kpis: Kpi[] }) {
  if (kpis.length === 0) {
    return (
      <p className="text-xs text-subtle">
        No KPIs assigned. KPI owners appear here with live health status.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className="flex items-center justify-between py-1.5 border-b border-line last:border-0"
        >
          <div>
            <p className="text-sm text-ink">{kpi.name}</p>
            <p className="text-xs text-subtle">
              {kpi.current_value ?? "—"}
              {kpi.target !== null && ` / ${kpi.target}`}
              {kpi.unit && ` ${kpi.unit}`}
            </p>
          </div>
          <Badge status={kpi.health_status}>
            {kpi.health_status.toUpperCase()}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Role Card Editor
// ============================================================

function RoleCardEditor({
  roleCard,
  onSave,
  onCancel,
}: {
  roleCard: RoleCard | null;
  onSave: (data: {
    outcomes_owned: string[];
    decision_authority: string;
    interfaces: string;
    commitments_standard: string;
  }) => void;
  onCancel: () => void;
}) {
  const [outcomes, setOutcomes] = useState(
    roleCard?.outcomes_owned?.join("\n") ?? ""
  );
  const [authority, setAuthority] = useState(
    roleCard?.decision_authority ?? ""
  );
  const [interfaces, setInterfaces] = useState(
    roleCard?.interfaces ?? ""
  );
  const [standard, setStandard] = useState(
    roleCard?.commitments_standard ?? ""
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Outcomes Owned
        </label>
        <textarea
          value={outcomes}
          onChange={(e) => setOutcomes(e.target.value)}
          placeholder="One outcome per line..."
          className="w-full min-h-[80px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
        <p className="text-xs text-subtle mt-0.5">
          What business outcomes are you accountable for?
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Decision Authority
        </label>
        <textarea
          value={authority}
          onChange={(e) => setAuthority(e.target.value)}
          placeholder="What decisions can you make without escalating?"
          className="w-full min-h-[60px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Interfaces
        </label>
        <textarea
          value={interfaces}
          onChange={(e) => setInterfaces(e.target.value)}
          placeholder="Who do you regularly coordinate with and how?"
          className="w-full min-h-[60px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Commitments Standard
        </label>
        <textarea
          value={standard}
          onChange={(e) => setStandard(e.target.value)}
          placeholder="What is your standard for keeping commitments?"
          className="w-full min-h-[60px] rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            onSave({
              outcomes_owned: outcomes
                .split("\n")
                .map((o) => o.trim())
                .filter(Boolean),
              decision_authority: authority.trim(),
              interfaces: interfaces.trim(),
              commitments_standard: standard.trim(),
            })
          }
        >
          Save Role Card
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Main Profile / Role Card View
// ============================================================

export function ProfileView({
  profile,
  roleCard,
  ownedKpis,
  ownedBets,
  activeCommitments,
}: {
  profile: Profile | null;
  roleCard: RoleCard | null;
  ownedKpis: Kpi[];
  ownedBets: Bet[];
  activeCommitments: Commitment[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingRoleCard, setEditingRoleCard] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!profile) return <p className="text-subtle">Profile not found.</p>;

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("user_profiles")
      .update({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", profile!.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Profile updated.");
      setEditingProfile(false);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleRoleCardSave(data: {
    outcomes_owned: string[];
    decision_authority: string;
    interfaces: string;
    commitments_standard: string;
  }) {
    setSaving(true);

    const payload = {
      ...data,
      entity_id: profile!.id,
      entity_type: "user" as const,
      organization_id: userCtx.orgId,
      venture_assignments: [userCtx.ventureId],
      metrics_moved: ownedKpis.map((k) => k.id),
      updated_at: new Date().toISOString(),
    };

    if (roleCard) {
      await supabase
        .from("role_cards")
        .update(payload)
        .eq("id", roleCard.id);
    } else {
      await supabase.from("role_cards").insert(payload);
    }

    setSaving(false);
    setEditingRoleCard(false);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Role Card</h1>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent flex-shrink-0">
              {fullName.charAt(0) || "?"}
            </div>
            <div className="flex-1">
              {editingProfile ? (
                <form onSubmit={handleProfileSave} className="space-y-2">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    label="Full name"
                    required
                  />
                  <Input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    label="Avatar URL"
                    placeholder="https://..."
                  />
                  {message && (
                    <p className="text-xs text-semantic-green-text">{message}</p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={saving}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingProfile(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{fullName}</p>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => setEditingProfile(true)}
                    >
                      Edit
                    </Button>
                  </div>
                  {profile.pulse_streak > 0 && (
                    <p className="text-sm text-accent mt-0.5">
                      {profile.pulse_streak} day pulse streak
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metrics Moved — Live KPI linkage */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">
              Metrics Moved
            </h2>
            <p className="text-xs text-subtle">
              KPIs you own — live health status
            </p>
          </CardHeader>
          <CardContent>
            <MetricsMoved kpis={ownedKpis} />
          </CardContent>
        </Card>

        {/* Active Bets */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">
              Active Bets
            </h2>
          </CardHeader>
          <CardContent>
            {ownedBets.length === 0 ? (
              <p className="text-xs text-subtle">No active bets assigned.</p>
            ) : (
              <div className="space-y-1.5">
                {ownedBets.map((bet) => (
                  <div
                    key={bet.id}
                    className="flex items-center justify-between py-1.5 border-b border-line last:border-0"
                  >
                    <p className="text-sm text-ink">{bet.outcome}</p>
                    <Badge status={bet.health_status}>
                      {bet.health_status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Role Card Details */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              Role Card Details
            </h2>
            {!editingRoleCard && (
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => setEditingRoleCard(true)}
              >
                {roleCard ? "Edit" : "Set Up Role Card"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingRoleCard ? (
            <RoleCardEditor
              roleCard={roleCard}
              onSave={handleRoleCardSave}
              onCancel={() => setEditingRoleCard(false)}
            />
          ) : roleCard ? (
            <div className="space-y-4">
              {/* Outcomes Owned */}
              <div>
                <p className="text-xs font-semibold text-subtle uppercase mb-1">
                  Outcomes Owned
                </p>
                {roleCard.outcomes_owned.length === 0 ? (
                  <p className="text-sm text-subtle">None defined.</p>
                ) : (
                  <ul className="space-y-1">
                    {roleCard.outcomes_owned.map((outcome, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-ink flex items-start gap-2"
                      >
                        <span className="text-accent mt-0.5">•</span>
                        {outcome}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Decision Authority */}
              {roleCard.decision_authority && (
                <div>
                  <p className="text-xs font-semibold text-subtle uppercase mb-1">
                    Decision Authority
                  </p>
                  <p className="text-sm text-ink whitespace-pre-wrap">
                    {roleCard.decision_authority}
                  </p>
                </div>
              )}

              {/* Interfaces */}
              {roleCard.interfaces && (
                <div>
                  <p className="text-xs font-semibold text-subtle uppercase mb-1">
                    Interfaces
                  </p>
                  <p className="text-sm text-ink whitespace-pre-wrap">
                    {roleCard.interfaces}
                  </p>
                </div>
              )}

              {/* Commitments Standard */}
              {roleCard.commitments_standard && (
                <div>
                  <p className="text-xs font-semibold text-subtle uppercase mb-1">
                    Commitments Standard
                  </p>
                  <p className="text-sm text-ink whitespace-pre-wrap">
                    {roleCard.commitments_standard}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-subtle">
              No role card defined yet. Set up your role card to define your
              outcomes, decision authority, and commitments standard.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Active Commitments */}
      {activeCommitments.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">
              Active Commitments
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {activeCommitments.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-1.5 border-b border-line last:border-0"
                >
                  <div>
                    <p className="text-sm text-ink">{c.description}</p>
                    {c.due_date && (
                      <p className="text-xs text-subtle">
                        Due{" "}
                        {new Date(c.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <Badge
                    status={
                      c.status === "on_track"
                        ? "green"
                        : c.status === "at_risk"
                          ? "yellow"
                          : "neutral"
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
