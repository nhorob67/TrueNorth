"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { EntityPicker } from "@/components/entity-picker";
import { MentionInput } from "@/components/mention-input";
import { useOptionalUserContext } from "@/hooks/use-user-context";
import { useOfflinePulse, type OfflinePulseData } from "@/hooks/use-offline-pulse";
import { PulseSidebar } from "@/components/pulse-sidebar";

interface PulseItem {
  type: "shipped" | "focus" | "blockers" | "signal";
  text: string;
  linked_entity_ids?: string[];
  mentions?: string[];
}

interface Pulse {
  id: string;
  user_id: string;
  date: string;
  items: PulseItem[];
  user_profiles?: { full_name: string; avatar_url: string | null };
}

interface Bet {
  id: string;
  outcome: string;
}

interface LinkedEntity {
  type: string;
  id: string;
  label: string;
}

function PulseForm({
  existingPulse,
  bets,
  userId,
  pulseStreak,
  isOnline,
  storeOffline,
}: {
  existingPulse: Pulse | null;
  bets: Bet[];
  userId: string;
  pulseStreak: number;
  isOnline: boolean;
  storeOffline: (pulse: OfflinePulseData) => Promise<boolean>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useOptionalUserContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const existingItems = existingPulse?.items ?? [];
  const getExisting = (type: string) =>
    existingItems.find((i: PulseItem) => i.type === type)?.text ?? "";

  const [shipped, setShipped] = useState(getExisting("shipped"));
  const [focus, setFocus] = useState(getExisting("focus"));
  const [blockers, setBlockers] = useState(getExisting("blockers"));
  const [signal, setSignal] = useState(getExisting("signal"));
  const [linkedEntities, setLinkedEntities] = useState<LinkedEntity[]>([]);
  const [mentions, setMentions] = useState<Array<{ userId: string; name: string }>>([]);
  const [showMoveAutoSuggest, setShowMoveAutoSuggest] = useState(false);
  const [selectedVentureId, setSelectedVentureId] = useState(userCtx?.ventureId ?? "");

  function addLinkedEntity(entityType: string, entityId: string, label: string) {
    if (linkedEntities.some((e) => e.id === entityId)) return;
    setLinkedEntities([...linkedEntities, { type: entityType, id: entityId, label }]);
  }

  function removeLinkedEntity(entityId: string) {
    setLinkedEntities(linkedEntities.filter((e) => e.id !== entityId));
  }

  const [offlineSaved, setOfflineSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOfflineSaved(false);

    const entityIds = linkedEntities.map((e) => e.id);
    const mentionIds = mentions.map((m) => m.userId);

    const items = [
      { type: "shipped" as const, text: shipped, linked_entity_ids: entityIds },
      { type: "focus" as const, text: focus, linked_entity_ids: entityIds },
      { type: "blockers" as const, text: blockers, mentions: mentionIds },
      { type: "signal" as const, text: signal },
    ].filter((item) => item.text.trim());

    const today = new Date().toISOString().split("T")[0];

    // If offline, queue the pulse for later sync
    if (!isOnline) {
      const stored = await storeOffline({
        user_id: userId,
        organization_id: userCtx?.orgId ?? "",
        venture_id: selectedVentureId || userCtx?.ventureId || null,
        date: today,
        items,
      });
      setLoading(false);
      if (stored) {
        setOfflineSaved(true);
        setShipped("");
        setFocus("");
        setBlockers("");
        setSignal("");
        setLinkedEntities([]);
        setMentions([]);
      } else {
        setError("Failed to save pulse offline. Please try again.");
      }
      return;
    }

    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!membership) {
      setError("No organization found.");
      setLoading(false);
      return;
    }

    if (existingPulse) {
      const { error: updateError } = await supabase
        .from("pulses")
        .update({ items })
        .eq("id", existingPulse.id);
      if (updateError) setError(updateError.message);
    } else {
      const { error: insertError } = await supabase.from("pulses").insert({
        user_id: userId,
        organization_id: membership.organization_id,
        venture_id: selectedVentureId || userCtx?.ventureId || null,
        date: today,
        items,
      });
      if (insertError) {
        // Network failed mid-request — fall back to offline storage
        if (insertError.message.includes("Failed to fetch") || !navigator.onLine) {
          const stored = await storeOffline({
            user_id: userId,
            organization_id: membership.organization_id,
            venture_id: selectedVentureId || userCtx?.ventureId || null,
            date: today,
            items,
          });
          setLoading(false);
          if (stored) {
            setOfflineSaved(true);
          } else {
            setError("Connection lost. Failed to save offline.");
          }
          return;
        }
        setError(insertError.message);
      }
    }

    // Auto-create blockers for @mentions
    if (mentions.length > 0) {
      for (const mention of mentions) {
        await supabase.from("blockers").insert({
          organization_id: membership.organization_id,
          description: `Blocker from ${userCtx?.fullName ?? "teammate"}'s pulse: ${blockers.substring(0, 200)}`,
          owner_id: mention.userId,
          severity: "medium",
        });
      }
    }

    // Update pulse streak
    const { data: recentPulses } = await supabase
      .from("pulses")
      .select("date")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(60);

    if (recentPulses) {
      let streak = 0;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      for (let i = 0; i < recentPulses.length; i++) {
        const expected = new Date(todayDate);
        expected.setDate(expected.getDate() - i);
        if (recentPulses[i].date === expected.toISOString().split("T")[0]) {
          streak++;
        } else break;
      }
      await supabase.from("user_profiles").update({ pulse_streak: streak }).eq("id", userId);
    }

    setLoading(false);
    if (!error) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {existingPulse ? "Update Today's Pulse" : "Submit Your Pulse"}
          </h2>
          {pulseStreak > 0 && (
            <span className="text-sm text-moss font-medium">
              🔥 {pulseStreak} day streak
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Venture selector for multi-venture orgs */}
          {userCtx && !userCtx.isSingleVenture && (
            <Select
              label="Venture"
              value={selectedVentureId}
              onChange={(e) => setSelectedVentureId(e.target.value)}
            >
              {userCtx.ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}

          {/* Shipped field with move auto-suggest */}
          <div className="space-y-1">
            <Textarea
              label="Shipped"
              value={shipped}
              onChange={(e) => setShipped(e.target.value)}
              placeholder="What did you ship or complete today?"
              className="min-h-[60px]"
            />
            <button
              type="button"
              onClick={() => setShowMoveAutoSuggest(!showMoveAutoSuggest)}
              className="text-xs text-clay-text hover:text-clay-text/80"
            >
              {showMoveAutoSuggest ? "Hide" : "Link a Move you shipped"}
            </button>
            {showMoveAutoSuggest && (
              <EntityPicker
                entityTypes={["move"]}
                onSelect={(type, id, label) => {
                  setShipped((s) => s ? `${s}\n✅ ${label}` : `✅ ${label}`);
                  addLinkedEntity(type, id, label);
                  setShowMoveAutoSuggest(false);
                }}
                placeholder="Search your moves..."
              />
            )}
          </div>

          {/* Focus field with entity linking */}
          <div className="space-y-1">
            <Textarea
              label="Focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="What are you focused on? (Tie to an active bet)"
              className="min-h-[60px]"
            />
            {bets.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {bets.map((bet) => (
                  <button
                    key={bet.id}
                    type="button"
                    onClick={() => {
                      setFocus((f) => f ? `${f}\n[${bet.outcome}]` : `[${bet.outcome}]`);
                      addLinkedEntity("bet", bet.id, bet.outcome);
                    }}
                    className="text-xs px-2 py-0.5 rounded bg-moss/10 text-moss hover:bg-moss/20"
                  >
                    {bet.outcome.substring(0, 40)}
                  </button>
                ))}
              </div>
            )}
            <EntityPicker
              entityTypes={["bet", "kpi", "move"]}
              onSelect={addLinkedEntity}
              placeholder="Link an entity..."
              className="mt-1"
            />
          </div>

          {/* Blockers field with @mention */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-charcoal">
              Blockers
            </label>
            <MentionInput
              value={blockers}
              onChange={setBlockers}
              onMentionsChange={setMentions}
              placeholder="Anything blocking you? Use @name to tag someone."
            />
          </div>

          {/* Signal */}
          <Textarea
            label="Signal"
            value={signal}
            onChange={(e) => setSignal(e.target.value)}
            placeholder="Any patterns, risks, or opportunities you noticed?"
            className="min-h-[60px]"
          />

          {/* Linked entities display */}
          {linkedEntities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {linkedEntities.map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-moss/10 text-moss"
                >
                  {e.type}: {e.label.substring(0, 30)}
                  <button type="button" onClick={() => removeLinkedEntity(e.id)} className="text-moss/50 hover:text-moss">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {!isOnline && (
            <div className="flex items-center gap-2 rounded-md border border-semantic-ochre/30 bg-semantic-ochre/10 px-3 py-2 text-sm text-semantic-ochre">
              <span className="inline-block h-2 w-2 rounded-full bg-semantic-ochre" />
              You are offline. Your pulse will be saved locally and synced when you reconnect.
            </div>
          )}

          {offlineSaved && (
            <div className="flex items-center gap-2 rounded-md border border-moss/30 bg-moss/10 px-3 py-2 text-sm text-moss">
              <span className="inline-block h-2 w-2 rounded-full bg-moss" />
              Pulse saved offline. It will sync automatically when you are back online.
            </div>
          )}

          {error && <p className="text-sm text-semantic-brick">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? "Saving..."
              : !isOnline
                ? "Save Offline"
                : existingPulse
                  ? "Update Pulse"
                  : "Submit Pulse"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PulseCard({ pulse }: { pulse: Pulse }) {
  const items = pulse.items ?? [];

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-moss/20 flex items-center justify-center text-sm font-medium text-moss">
            {pulse.user_profiles?.full_name?.charAt(0) ?? "?"}
          </div>
          <div>
            <p className="text-sm font-medium">
              {pulse.user_profiles?.full_name ?? "Unknown"}
            </p>
            <p className="text-xs text-warm-gray">{pulse.date}</p>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item: PulseItem, i: number) => (
            <div key={i}>
              <span className="text-xs font-semibold text-warm-gray uppercase">
                {item.type}
              </span>
              <p className="text-sm text-charcoal whitespace-pre-wrap">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface SidebarTodo {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: "high" | "medium" | "low" | null;
  linked_entity_type: string | null;
}

interface SidebarRhythm {
  id: string;
  title: string;
  cadence: string;
  target_per_cycle: number | null;
  bet_outcome: string;
  health_status: "green" | "yellow" | "red";
  instances_completed: number;
  instances_total: number;
}

export function PulseView({
  myPulse,
  teamPulses,
  bets,
  userId,
  pulseStreak,
  todos = [],
  rhythms = [],
}: {
  myPulse: Pulse | null;
  teamPulses: Pulse[];
  bets: Bet[];
  userId: string;
  pulseStreak?: number;
  todos?: SidebarTodo[];
  rhythms?: SidebarRhythm[];
}) {
  const supabase = createClient();

  // Sync callback: submits a queued offline pulse to Supabase
  const handleSyncPulse = useCallback(
    async (pulse: OfflinePulseData): Promise<boolean> => {
      const { error } = await supabase.from("pulses").upsert(
        {
          user_id: pulse.user_id,
          organization_id: pulse.organization_id,
          venture_id: pulse.venture_id,
          date: pulse.date,
          items: pulse.items,
        },
        { onConflict: "user_id,date" }
      );
      return !error;
    },
    [supabase]
  );

  const { isOnline, pendingCount, syncing, storeOffline } =
    useOfflinePulse(handleSyncPulse);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Daily Pulse</h1>
        {syncing && (
          <span className="text-xs text-moss animate-pulse">
            Syncing offline pulses...
          </span>
        )}
        {!syncing && pendingCount > 0 && isOnline && (
          <span className="text-xs text-semantic-ochre">
            {pendingCount} pulse{pendingCount > 1 ? "s" : ""} pending sync
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_240px] gap-6">
        <div>
          <PulseForm
            existingPulse={myPulse}
            bets={bets}
            userId={userId}
            pulseStreak={pulseStreak ?? 0}
            isOnline={isOnline}
            storeOffline={storeOffline}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Team Feed</h2>
          {teamPulses.length === 0 ? (
            <p className="text-sm text-warm-gray">No pulses submitted today yet.</p>
          ) : (
            <div className="space-y-4">
              {teamPulses.map((pulse) => (
                <PulseCard key={pulse.id} pulse={pulse} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: To-dos + Active Rhythms */}
        <div className="hidden lg:block">
          <PulseSidebar todos={todos} rhythms={rhythms} />
        </div>
      </div>
    </div>
  );
}
