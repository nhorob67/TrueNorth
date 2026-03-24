"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PolicyCheckResult } from "@/lib/policies/engine";
import { createClient } from "@/lib/supabase/client";

export function PolicyViolation({
  checkResult,
  userId,
  orgId,
  entityId,
  entityType,
  onOverride,
}: {
  checkResult: PolicyCheckResult;
  userId: string;
  orgId: string;
  entityId?: string;
  entityType?: string;
  onOverride?: () => void;
}) {
  const { policy, result } = checkResult;
  const [showOverride, setShowOverride] = useState(false);
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(false);

  if (result.passed) return null;

  async function handleOverride() {
    if (!justification.trim()) return;
    setLoading(true);
    const supabase = createClient();

    await supabase.from("policy_overrides").insert({
      policy_name: policy.name,
      overridden_by: userId,
      justification: justification.trim(),
      entity_id: entityId ?? null,
      entity_type: entityType ?? null,
      organization_id: orgId,
    });

    setLoading(false);
    onOverride?.();
  }

  return (
    <Card borderColor="var(--color-semantic-brick)">
      <CardContent className="py-3">
        <p className="text-sm font-medium text-semantic-brick">
          {policy.description}
        </p>
        <p className="text-sm text-charcoal mt-1">
          {policy.userExplanation}
        </p>
        {result.currentValue !== undefined && result.limit !== undefined && (
          <p className="text-xs text-warm-gray mt-1">
            Current: {result.currentValue} / Limit: {result.limit}
          </p>
        )}
        {result.violation && (
          <p className="text-xs text-warm-gray mt-1">{result.violation}</p>
        )}

        {policy.overrideAllowed && !showOverride && (
          <Button
            variant="tertiary"
            size="sm"
            className="mt-2"
            onClick={() => setShowOverride(true)}
          >
            Request Override
          </Button>
        )}

        {policy.overrideAllowed && showOverride && (
          <div className="mt-2 space-y-2">
            <Input
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Justification for override..."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={loading || !justification.trim()}
                onClick={handleOverride}
              >
                {loading ? "..." : "Override"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowOverride(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!policy.overrideAllowed && (
          <p className="text-xs text-semantic-brick mt-2 font-medium">
            This policy cannot be overridden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
