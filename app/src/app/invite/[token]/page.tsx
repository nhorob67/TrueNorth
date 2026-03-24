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
    organization_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      // Invites table has RLS requiring admin. Use a public-accessible check.
      // For now, we try to sign up with the invite email and the trigger handles joining.
      // We'll just show the signup form.
      setLoading(false);
    }
    loadInvite();
  }, [token]);

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
      <div className="flex items-center justify-center min-h-screen bg-parchment">
        <p className="text-warm-gray">Loading invite...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-parchment">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold text-moss mb-2">Check your email</h1>
            <p className="text-sm text-warm-gray">
              Confirm your account, then sign in. You&apos;ll automatically join the team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-parchment">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-moss">TrueNorth</h1>
          <p className="text-warm-gray mt-1">You&apos;ve been invited to join a team</p>
        </div>

        <Card>
          <CardContent className="pt-6">
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
            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-warm-gray hover:text-charcoal">
                Already have an account? Sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
