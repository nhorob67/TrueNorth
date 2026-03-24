"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/loading";

// ============================================================
// Types
// ============================================================

interface KilledMove {
  id: string;
  effort_estimate: { value?: number; unit?: string } | null;
  lifecycle_status: string;
}

interface KilledBet {
  id: string;
  outcome: string;
  mechanism: string | null;
  quarter: string | null;
  owner_id: string;
  health_status: string;
  created_at: string;
  killed_at: string;
  kill_reason: string | null;
  resource_cap: { value?: number; unit?: string } | null;
  moves: KilledMove[];
}

// ============================================================
// Tombstone Card
// ============================================================

function Tombstone({ bet }: { bet: KilledBet }) {
  const created = new Date(bet.created_at);
  const killed = new Date(bet.killed_at);
  const durationMs = killed.getTime() - created.getTime();
  const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
  const durationWeeks = Math.round(durationDays / 7);

  // Calculate hours recovered (effort on non-shipped moves)
  const recoveredHours = bet.moves
    .filter((m) => m.lifecycle_status !== "shipped")
    .reduce((sum, m) => sum + (m.effort_estimate?.value ?? 0), 0);

  // Resource cap hours that were freed
  const capHours = bet.resource_cap?.value ?? 0;

  return (
    <Card className="overflow-hidden">
      {/* Tombstone header — dark, somber, but celebratory */}
      <div className="bg-charcoal px-6 py-5 text-center">
        <div className="text-warm-gray/40 text-3xl mb-2">&#x2020;</div>
        <h3 className="text-ivory font-semibold text-base leading-tight">
          {bet.outcome}
        </h3>
        {bet.mechanism && (
          <p className="text-warm-gray text-xs mt-1">{bet.mechanism}</p>
        )}
        <div className="flex items-center justify-center gap-3 mt-3 text-xs text-warm-gray">
          <span>
            {created.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </span>
          <span>—</span>
          <span>
            {killed.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <p className="text-xs text-warm-gray/60 mt-1">
          {durationWeeks > 0
            ? `${durationWeeks} week${durationWeeks !== 1 ? "s" : ""}`
            : `${durationDays} day${durationDays !== 1 ? "s" : ""}`}
        </p>
      </div>

      <CardContent className="py-4 space-y-3">
        {/* Lessons learned */}
        {bet.kill_reason && (
          <div>
            <p className="text-xs font-semibold text-warm-gray uppercase mb-1">
              What We Learned
            </p>
            <p className="text-sm text-charcoal whitespace-pre-wrap">
              {bet.kill_reason}
            </p>
          </div>
        )}

        {/* Resources recovered */}
        <div className="flex gap-4">
          {recoveredHours > 0 && (
            <div className="flex-1 p-2 bg-semantic-green/5 rounded text-center">
              <p className="text-lg font-mono font-bold text-semantic-green-text">
                {recoveredHours}h
              </p>
              <p className="text-xs text-warm-gray">Hours saved</p>
            </div>
          )}
          {capHours > 0 && (
            <div className="flex-1 p-2 bg-semantic-green/5 rounded text-center">
              <p className="text-lg font-mono font-bold text-semantic-green-text">
                {capHours}h/wk
              </p>
              <p className="text-xs text-warm-gray">Capacity freed</p>
            </div>
          )}
          <div className="flex-1 p-2 bg-moss/5 rounded text-center">
            <p className="text-lg font-mono font-bold text-moss">
              {bet.moves.filter((m) => m.lifecycle_status === "shipped").length}
            </p>
            <p className="text-xs text-warm-gray">Moves shipped</p>
          </div>
        </div>

        {/* Quarter tag */}
        {bet.quarter && (
          <p className="text-xs text-warm-gray text-center">{bet.quarter}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main View
// ============================================================

export function GraveyardView({
  killedBets,
}: {
  killedBets: KilledBet[];
}) {
  // Aggregate stats
  const totalKilled = killedBets.length;
  const totalHoursSaved = killedBets.reduce((sum, bet) => {
    const recovered = bet.moves
      .filter((m) => m.lifecycle_status !== "shipped")
      .reduce((s, m) => s + (m.effort_estimate?.value ?? 0), 0);
    return sum + recovered;
  }, 0);
  const totalCapacityFreed = killedBets.reduce(
    (sum, bet) => sum + (bet.resource_cap?.value ?? 0),
    0
  );

  if (totalKilled === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Bet Graveyard</h1>
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => (window.location.href = "/bets")}
          >
            Back to War Room
          </Button>
        </div>
        <EmptyState
          title="The Graveyard is empty"
          description="No bets have been killed yet. When a bet is killed, it moves here to celebrate the smart decision and preserve the lessons learned."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bet Graveyard</h1>
          <p className="text-sm text-warm-gray mt-0.5">
            The system worked. Every tombstone here represents a smart kill
            that protected focus and resources.
          </p>
        </div>
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => (window.location.href = "/bets")}
        >
          Back to War Room
        </Button>
      </div>

      {/* Aggregate celebration */}
      <Card className="mb-8">
        <CardContent className="py-5">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-mono font-bold text-charcoal">
                {totalKilled}
              </p>
              <p className="text-xs text-warm-gray mt-1">
                Smart Kill{totalKilled !== 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <p className="text-3xl font-mono font-bold text-semantic-green-text">
                {totalHoursSaved}h
              </p>
              <p className="text-xs text-warm-gray mt-1">
                Total Hours Saved
              </p>
            </div>
            <div>
              <p className="text-3xl font-mono font-bold text-moss">
                {totalCapacityFreed}h/wk
              </p>
              <p className="text-xs text-warm-gray mt-1">
                Total Capacity Freed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tombstones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {killedBets.map((bet) => (
          <Tombstone key={bet.id} bet={bet} />
        ))}
      </div>
    </div>
  );
}
