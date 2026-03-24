"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";

interface SettingsProps {
  org: { id: string; name: string; slug: string; settings: Record<string, unknown> } | null;
  ventures: Array<{ id: string; name: string }>;
  pendingInvites: Array<{
    id: string;
    email: string;
    role: string;
    created_at: string;
    accepted_at: string | null;
  }>;
  members: Array<{
    user_id: string;
    role: string;
    user_profiles: { full_name: string } | null;
  }>;
  isAdmin: boolean;
  quietHours: {
    enabled: boolean;
    start_hour: number;
    end_hour: number;
    timezone: string;
  };
  userId: string;
}

function VenturesSection({ orgId, ventures: initialVentures, userId }: { orgId: string; ventures: Array<{ id: string; name: string }>; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [ventures, setVentures] = useState(initialVentures);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  function slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");

    const slug = slugify(newName.trim());

    const { data: venture, error: insertError } = await supabase
      .from("ventures")
      .insert({
        organization_id: orgId,
        name: newName.trim(),
        slug,
      })
      .select("id, name")
      .single();

    if (insertError) {
      setError(insertError.message);
      setCreating(false);
      return;
    }

    // Create venture_membership for the current admin user
    if (venture) {
      await supabase.from("venture_memberships").insert({
        venture_id: venture.id,
        user_id: userId,
        role: "admin",
      });
      setVentures([...ventures, venture]);
    }

    setNewName("");
    setShowForm(false);
    setCreating(false);
    router.refresh();
  }

  async function handleRename(ventureId: string) {
    if (!editName.trim()) return;
    setError("");

    const { error: updateError } = await supabase
      .from("ventures")
      .update({ name: editName.trim() })
      .eq("id", ventureId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setVentures(ventures.map((v) => (v.id === ventureId ? { ...v, name: editName.trim() } : v)));
    setEditingId(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Ventures</h2>
        <p className="text-xs text-warm-gray">
          Manage your organization&apos;s ventures. Each venture is an independent product or initiative.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {ventures.map((v) => (
            <div key={v.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-parchment">
              {editingId === v.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(v.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button size="sm" onClick={() => handleRename(v.id)}>Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium">{v.name}</span>
                  <button
                    type="button"
                    onClick={() => { setEditingId(v.id); setEditName(v.name); }}
                    className="text-xs text-warm-gray hover:text-charcoal transition-colors"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {showForm ? (
          <form onSubmit={handleCreate} className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                label="Venture Name"
                placeholder="e.g., New Product Line"
                autoFocus
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? "..." : "Create"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setShowForm(false); setNewName(""); }}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
            + Add Venture
          </Button>
        )}

        {error && <p className="text-sm text-semantic-brick">{error}</p>}
      </CardContent>
    </Card>
  );
}

function InviteForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role, orgId }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage(`Invite sent to ${email}`);
      setEmail("");
      router.refresh();
    } else {
      setMessage(data.error ?? "Failed to send invite");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="teammate@company.com"
            label="Email"
            required
          />
        </div>
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="member">Member</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </Select>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "..." : "Invite"}
        </Button>
      </div>
      {message && (
        <p className="text-sm text-semantic-green-text">{message}</p>
      )}
    </form>
  );
}

function DiscordIntegrationSection({
  orgId,
  initialWebhookUrl,
}: {
  orgId: string;
  initialWebhookUrl: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const existingSettings = (org?.settings ?? {}) as Record<string, unknown>;

    const { error } = await supabase
      .from("organizations")
      .update({
        settings: {
          ...existingSettings,
          discord_webhook_url: webhookUrl.trim() || null,
        },
      })
      .eq("id", orgId);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Discord webhook saved.");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleTest() {
    if (!webhookUrl.trim()) {
      setMessage("Enter a webhook URL first.");
      return;
    }
    setTesting(true);
    setMessage("");

    try {
      const res = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "TrueNorth Test Notification",
              description:
                "If you see this, your Discord webhook is configured correctly.",
              color: 0x5f6f52,
              footer: { text: "Test | TrueNorth" },
            },
          ],
        }),
      });
      if (res.ok) {
        setMessage("Test message sent! Check your Discord channel.");
      } else {
        setMessage(`Webhook returned ${res.status}. Check the URL.`);
      }
    } catch {
      setMessage("Failed to reach the webhook URL.");
    }
    setTesting(false);
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Discord Integration</h2>
        <p className="text-xs text-warm-gray">
          Paste a Discord webhook URL to receive team notifications in a channel.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          label="Discord Webhook URL"
          placeholder="https://discord.com/api/webhooks/..."
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleTest}
            disabled={testing || !webhookUrl.trim()}
          >
            {testing ? "Sending..." : "Test"}
          </Button>
        </div>
        {message && (
          <p className="text-sm text-warm-gray">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Brand Voice Configuration (3.5)
// ============================================================

function BrandVoiceSection({
  orgId,
  initialBrandVoice,
}: {
  orgId: string;
  initialBrandVoice: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [brandVoice, setBrandVoice] = useState(initialBrandVoice);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const existingSettings = (org?.settings ?? {}) as Record<string, unknown>;

    const { error } = await supabase
      .from("organizations")
      .update({
        settings: {
          ...existingSettings,
          brand_voice: brandVoice.trim() || null,
        },
      })
      .eq("id", orgId);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Brand voice saved. The Content Copilot will now use this voice.");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Brand Voice</h2>
        <p className="text-xs text-warm-gray">
          Describe your organization&apos;s brand voice. The Content Copilot will use
          this to match your tone when drafting, rewriting, and continuing content.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={brandVoice}
          onChange={(e) => setBrandVoice(e.target.value)}
          placeholder="e.g., We write in a conversational but authoritative tone. We use short sentences and active voice. We avoid jargon but aren't afraid of technical terms when they're precise. Our audience is experienced digital business operators..."
          className="w-full min-h-[120px] text-sm border border-warm-border rounded-lg px-3 py-2 bg-ivory text-charcoal placeholder:text-warm-gray/60 outline-none focus:ring-2 focus:ring-moss/30 resize-y"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Brand Voice"}
          </Button>
          {message && (
            <span className="text-xs text-warm-gray">{message}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuietHoursSection({
  quietHours,
  userId,
}: {
  quietHours: { enabled: boolean; start_hour: number; end_hour: number; timezone: string };
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [enabled, setEnabled] = useState(quietHours.enabled);
  const [startHour, setStartHour] = useState(quietHours.start_hour);
  const [endHour, setEndHour] = useState(quietHours.end_hour);
  const [timezone, setTimezone] = useState(quietHours.timezone);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    const existingSettings = (profile?.settings ?? {}) as Record<string, unknown>;

    await supabase
      .from("user_profiles")
      .update({
        settings: {
          ...existingSettings,
          quiet_hours: {
            enabled,
            start_hour: startHour,
            end_hour: endHour,
            timezone,
          },
        },
      })
      .eq("id", userId);

    setSaving(false);
    router.refresh();
  }

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:00 ${ampm}`;
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Quiet Hours</h2>
        <p className="text-xs text-warm-gray">
          Non-immediate notifications are held during quiet hours.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          label="Enabled"
        />

        {enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Start"
                value={startHour}
                onChange={(e) => setStartHour(parseInt(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                ))}
              </Select>
              <Select
                label="End"
                value={endHour}
                onChange={(e) => setEndHour(parseInt(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              label="Timezone"
              placeholder="America/Chicago"
            />
            <p className="text-xs text-warm-gray">
              Quiet: {formatHour(startHour)} → {formatHour(endHour)}
            </p>
          </>
        )}

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Quiet Hours"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function SettingsView({
  org,
  ventures,
  pendingInvites,
  members,
  isAdmin,
  quietHours,
  userId,
}: SettingsProps) {
  if (!org) return <p className="text-warm-gray">No organization found.</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Organization Info */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Organization</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">{org.name}</span>
              <span className="text-warm-gray ml-2">({org.slug})</span>
            </p>
            <p className="text-xs text-warm-gray mt-1">
              {ventures.length} venture{ventures.length !== 1 ? "s" : ""}:{" "}
              {ventures.map((v) => v.name).join(", ")}
            </p>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Team Members</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-sm">
                    {m.user_profiles?.full_name ?? "Unknown"}
                  </span>
                  <Badge status="neutral">{m.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Invite */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Invite Team Members</h2>
            </CardHeader>
            <CardContent>
              <InviteForm orgId={org.id} />

              {pendingInvites.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-warm-gray uppercase mb-2">
                    Pending Invites
                  </p>
                  <div className="space-y-1">
                    {pendingInvites
                      .filter((i) => !i.accepted_at)
                      .map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{invite.email}</span>
                          <div className="flex items-center gap-2">
                            <Badge status="neutral">{invite.role}</Badge>
                            <span className="text-xs text-warm-gray">
                              {new Date(invite.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {/* Ventures (admin only) */}
        {isAdmin && (
          <VenturesSection orgId={org.id} ventures={ventures} userId={userId} />
        )}

        {/* Discord Integration (admin only) */}
        {isAdmin && (
          <DiscordIntegrationSection
            orgId={org.id}
            initialWebhookUrl={
              (org.settings?.discord_webhook_url as string) ?? ""
            }
          />
        )}

        {/* Brand Voice (admin only, 3.5) */}
        {isAdmin && (
          <BrandVoiceSection
            orgId={org.id}
            initialBrandVoice={
              (org.settings?.brand_voice as string) ?? ""
            }
          />
        )}

        {/* Quiet Hours */}
        <QuietHoursSection quietHours={quietHours} userId={userId} />
      </div>
    </div>
  );
}
