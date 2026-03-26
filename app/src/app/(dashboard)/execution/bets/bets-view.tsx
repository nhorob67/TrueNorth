"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/loading";
import { AddToTodoButton } from "@/components/add-to-todo-button";

interface Move {
  id: string;
  title: string;
  lifecycle_status: "not_started" | "in_progress" | "shipped" | "cut";
  health_status: "green" | "yellow" | "red";
  due_date: string | null;
  owner_id: string;
  type?: "milestone" | "recurring";
}

interface Bet {
  id: string;
  outcome: string;
  mechanism: string | null;
  owner_id: string;
  health_status: "green" | "yellow" | "red";
  lifecycle_status: string;
  quarter: string | null;
  proof_by_week6: string | null;
  kill_criteria: string | null;
  moves: Move[];
}

function MoveProgressBar({ moves }: { moves: Move[] }) {
  const active = moves.filter((m) => m.lifecycle_status !== "cut");
  if (active.length === 0) return null;

  const shipped = active.filter((m) => m.lifecycle_status === "shipped").length;
  const inProgress = active.filter((m) => m.lifecycle_status === "in_progress").length;
  const notStarted = active.filter((m) => m.lifecycle_status === "not_started").length;
  const total = active.length;

  return (
    <div className="mt-3">
      <div className="flex h-2 rounded-full overflow-hidden bg-line">
        {shipped > 0 && (
          <div
            className="bg-semantic-green"
            style={{ width: `${(shipped / total) * 100}%` }}
          />
        )}
        {inProgress > 0 && (
          <div
            className="bg-semantic-ochre"
            style={{ width: `${(inProgress / total) * 100}%` }}
          />
        )}
        {notStarted > 0 && (
          <div
            className="bg-line"
            style={{ width: `${(notStarted / total) * 100}%` }}
          />
        )}
      </div>
      <p className="text-xs text-subtle mt-1">
        {shipped} shipped, {inProgress} in progress, {notStarted} not started
      </p>
      <RhythmIndicators moves={moves} />
    </div>
  );
}

function RhythmIndicators({ moves }: { moves: Move[] }) {
  const recurring = moves.filter(
    (m) => m.type === "recurring" && m.lifecycle_status !== "cut"
  );
  if (recurring.length === 0) return null;

  const dotColor: Record<string, string> = {
    green: "bg-semantic-green",
    yellow: "bg-semantic-ochre",
    red: "bg-semantic-brick",
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="text-[10px] text-subtle mr-0.5">Rhythms:</span>
      {recurring.map((m) => (
        <span
          key={m.id}
          title={m.title}
          className={`w-2 h-2 rounded-full ${dotColor[m.health_status] ?? "bg-faded"}`}
        />
      ))}
    </div>
  );
}

function ExecutionHealth({ moves }: { moves: Move[] }) {
  const active = moves.filter(
    (m) => m.lifecycle_status !== "cut" && m.lifecycle_status !== "shipped"
  );
  if (active.length === 0) return null;

  const greenCount = active.filter((m) => m.health_status === "green").length;
  const pct = Math.round((greenCount / active.length) * 100);

  const color =
    pct >= 80
      ? "text-semantic-green-text"
      : pct >= 50
        ? "text-semantic-ochre"
        : "text-semantic-brick";

  return (
    <span
      className={`text-xs font-semibold ${color}`}
      title={`${greenCount}/${active.length} active moves are healthy`}
    >
      {pct}% exec
    </span>
  );
}

function BetCard({ bet }: { bet: Bet }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="bg-accent/5 border-b border-line">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-ink leading-tight">
            {bet.outcome}
          </h3>
          <div className="flex items-center gap-1.5">
            <ExecutionHealth moves={bet.moves} />
            <AddToTodoButton
              entityId={bet.id}
              entityType="bet"
              entityLabel={bet.outcome}
            />
            <Badge status={bet.health_status}>
              {bet.health_status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {bet.mechanism && (
          <p className="text-sm text-subtle mt-2">{bet.mechanism}</p>
        )}
        {bet.quarter && (
          <p className="text-xs text-subtle mt-1">Q: {bet.quarter}</p>
        )}
        <MoveProgressBar moves={bet.moves} />

        {bet.moves.length > 0 && (
          <div className="mt-3 space-y-1">
            {bet.moves
              .filter((m) => m.lifecycle_status !== "cut")
              .sort((a, b) => {
                const order = { in_progress: 0, not_started: 1, shipped: 2 };
                return (
                  (order[a.lifecycle_status as keyof typeof order] ?? 3) -
                  (order[b.lifecycle_status as keyof typeof order] ?? 3)
                );
              })
              .slice(0, 5)
              .map((move) => (
                <div
                  key={move.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      move.lifecycle_status === "shipped"
                        ? "bg-semantic-green"
                        : move.lifecycle_status === "in_progress"
                          ? "bg-semantic-ochre"
                          : "bg-faded"
                    }`}
                  />
                  <span
                    className={
                      move.lifecycle_status === "shipped"
                        ? "line-through text-subtle"
                        : "text-ink"
                    }
                  >
                    {move.title}
                  </span>
                  {move.due_date && (
                    <span className="text-subtle ml-auto">
                      {new Date(move.due_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BetsWarRoom({ bets }: { bets: Bet[] }) {
  if (bets.length === 0) {
    return (
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6">War Room</h1>
        <EmptyState
          title="The War Room is empty"
          description="No bets, no battles, no progress. You have 3 slots. Use them wisely — each one is a commitment to your team that something matters enough to fight for."
          action={
            <Button onClick={() => (window.location.href = "/execution/bets/new")}>
              Place Your First Bet
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">War Room</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => (window.location.href = "/execution/bets/retrospective")}
          >
            Retrospective
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => (window.location.href = "/execution/bets/graveyard")}
          >
            Graveyard
          </Button>
          {bets.length < 3 && (
            <Button
              size="sm"
              onClick={() => (window.location.href = "/execution/bets/new")}
            >
              Create Bet
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bets.map((bet) => (
          <a key={bet.id} href={`/execution/bets/${bet.id}`}>
            <BetCard bet={bet} />
          </a>
        ))}
      </div>
    </div>
  );
}
