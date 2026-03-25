"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export default function NewBetPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
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

    // Check 3-bet policy
    const { data: activeBets } = await supabase
      .from("bets")
      .select("id")
      .eq("venture_id", venture.id)
      .eq("lifecycle_status", "active");

    if (activeBets && activeBets.length >= 3) {
      setError(
        "Maximum 3 active bets per venture. Complete or kill an existing bet first."
      );
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("bets").insert({
      organization_id: membership.organization_id,
      venture_id: venture.id,
      outcome: form.get("outcome") as string,
      mechanism: (form.get("mechanism") as string) || null,
      proof_by_week6: (form.get("proof_by_week6") as string) || null,
      kill_criteria: (form.get("kill_criteria") as string) || null,
      quarter: (form.get("quarter") as string) || null,
      owner_id: user.id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      router.push("/bets");
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">Create Bet</h1>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <Input
              id="outcome"
              name="outcome"
              label="Outcome (What will be true?)"
              required
              placeholder="e.g., 500 paying subscribers by end of Q2"
            />
            <Input
              id="mechanism"
              name="mechanism"
              label="Mechanism (How will we get there?)"
              placeholder="e.g., Launch weekly newsletter + referral program"
            />
            <Input
              id="proof_by_week6"
              name="proof_by_week6"
              label="Proof by Week 6"
              placeholder="e.g., 100 subscribers from organic signups"
            />
            <Input
              id="kill_criteria"
              name="kill_criteria"
              label="Kill Criteria"
              placeholder="e.g., <25 signups after 4 weeks of promotion"
            />
            <Input
              id="quarter"
              name="quarter"
              label="Quarter"
              placeholder="e.g., Q2 2026"
            />

            {error && (
              <p className="text-sm text-semantic-brick">{error}</p>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Bet"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
