"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = createClient();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const redirectPath =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/";

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = redirectPath;
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          redirectPath
        )}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for a login link.");
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-parchment">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-moss">TrueNorth</h1>
          <p className="text-warm-gray mt-1">Sign in to your account</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form
              onSubmit={
                mode === "password" ? handlePasswordLogin : handleMagicLink
              }
              className="space-y-4"
            >
              <Input
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />

              {mode === "password" && (
                <Input
                  id="password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                />
              )}

              {error && (
                <p className="text-sm text-semantic-brick">{error}</p>
              )}
              {message && (
                <p className="text-sm text-semantic-green-text">{message}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading
                  ? "Signing in..."
                  : mode === "password"
                    ? "Sign in"
                    : "Send magic link"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() =>
                  setMode(mode === "password" ? "magic" : "password")
                }
                className="text-sm text-clay-text hover:text-clay-text/80"
              >
                {mode === "password"
                  ? "Use magic link instead"
                  : "Use password instead"}
              </button>
            </div>

            <div className="mt-4 text-center">
              <a
                href="/signup"
                className="text-sm text-warm-gray hover:text-charcoal"
              >
                Don&apos;t have an account? Sign up
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
