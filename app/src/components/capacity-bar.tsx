"use client";

export function CapacityBar({
  betHours,
  totalCapacity,
  className = "",
}: {
  betHours: number;
  totalCapacity: number;
  className?: string;
}) {
  if (totalCapacity === 0) return null;

  const betPercent = Math.min((betHours / totalCapacity) * 100, 100);
  const targetPercent = 70;
  const isOver = betPercent > targetPercent;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-xs text-subtle">
        <span>Bet work: {betHours}h</span>
        <span>70/30 target</span>
      </div>
      <div className="relative h-3 rounded-full bg-line overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOver ? "bg-semantic-ochre" : "bg-accent"
          }`}
          style={{ width: `${betPercent}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-ink/40"
          style={{ left: `${targetPercent}%` }}
        />
      </div>
      <p className="text-xs text-subtle">
        {betPercent.toFixed(0)}% on bets ({isOver ? "over" : "under"} 70% target)
      </p>
    </div>
  );
}
