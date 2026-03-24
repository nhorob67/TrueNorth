"use client";

import { Card, CardContent } from "@/components/ui/card";

interface MeetingTimerProps {
  running: boolean;
  onToggle: () => void;
  secondsRemaining: number;
  totalMinutes: number;
}

export function MeetingTimer({
  running,
  onToggle,
  secondsRemaining,
  totalMinutes,
}: MeetingTimerProps) {
  const mins = Math.floor(Math.abs(secondsRemaining) / 60);
  const secs = Math.abs(secondsRemaining) % 60;
  const isOvertime = secondsRemaining < 0;
  const pct = isOvertime ? 0 : (secondsRemaining / (totalMinutes * 60)) * 100;

  const isWarning = !isOvertime && secondsRemaining <= 300 && secondsRemaining > 60;
  const isCritical = isOvertime || secondsRemaining <= 60;

  return (
    <Card className="mb-4">
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-full border border-warm-border flex items-center justify-center hover:bg-parchment transition-colors"
          >
            {running ? (
              <svg className="w-4 h-4 text-charcoal" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-charcoal" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-2xl font-mono font-bold ${
                  isCritical
                    ? "text-semantic-brick"
                    : isWarning
                      ? "text-semantic-ochre-text"
                      : "text-charcoal"
                }`}
              >
                {isOvertime ? "-" : ""}
                {mins}:{secs.toString().padStart(2, "0")}
              </span>
              <span className="text-xs text-warm-gray">
                {totalMinutes} min meeting
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-warm-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isCritical
                    ? "bg-semantic-brick"
                    : isWarning
                      ? "bg-semantic-ochre"
                      : "bg-moss"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
