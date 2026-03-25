"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const supabase = createClient();
  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    organizationName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvite() {
      try {
        const [inviteRes, userRes] = await Promise.all([
          fetch(`/api/invites/${token}`, { method: "GET" }),
          supabase.auth.getUser(),
        ]);

        const inviteBody = await inviteRes.json();
        if (!inviteRes.ok) {
          setError(inviteBody.error ?? "Failed to load invite");
          setLoading(false);
          return;
        }

        setInvite(inviteBody);
        setEmail(inviteBody.email);
        setCurrentUserEmail(userRes.data.user?.email ?? null);
      } catch {
        setError("Failed to load invite");
      } finally {
        setLoading(false);
      }
    }
    loadInvite();
  }, [supabase.auth, token]);

  async function handleAccept() {
    setAccepting(true);
    setError("");

    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Failed to accept invite");
        setAccepting(false);
        return;
      }

      setAccepted(true);
    } catch {
      setError("Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setSubmitting(false);
    } else {
      setSuccess(true);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <p className="text-subtle">Loading invite...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-accent mb-2">Check your email</h1>
            <p className="text-sm text-subtle">
              Confirm your account, then sign in. You&apos;ll automatically join the team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-accent mb-2">Invite accepted</h1>
            <p className="text-sm text-subtle">
              You&apos;ve joined {invite?.organizationName ?? "the team"}.
            </p>
            <div className="mt-4">
              <a href="/" className="text-sm text-accent hover:text-accent/80">
                Continue to TrueNorth
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-accent">TrueNorth</h1>
          <p className="text-subtle mt-1">
            You&apos;ve been invited to join {invite?.organizationName ?? "a team"}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {invite && currentUserEmail?.toLowerCase() === invite.email.toLowerCase() ? (
              <div className="space-y-4">
                <p className="text-sm text-subtle">
                  Signed in as <strong>{currentUserEmail}</strong>. Accept this invite to join as a{" "}
                  <strong>{invite.role}</strong>.
                </p>
                {error && (
                  <p className="text-sm text-semantic-brick">{error}</p>
                )}
                <Button type="button" className="w-full" onClick={handleAccept} disabled={accepting}>
                  {accepting ? "Joining team..." : "Accept Invite"}
                </Button>
              </div>
            ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Input
                id="fullName"
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={Boolean(invite?.email)}
                required
              />
              <Input
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              {error && (
                <p className="text-sm text-semantic-brick">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating account..." : "Join Team"}
              </Button>
            </form>
            )}
            <div className="mt-4 text-center">
              <a
                href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                className="text-sm text-subtle hover:text-ink"
              >
                Already have an account? Sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
