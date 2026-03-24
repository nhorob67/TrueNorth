"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ============================================================
// Types
// ============================================================

interface StalenessResult {
  artifact_type: string;
  name: string;
  owner_id: string | null;
  last_updated_at: string | null;
  staleness_threshold_days: number;
  days_since_update: number | null;
  is_stale: boolean;
}

// ============================================================
// Artifact links
// ============================================================

const artifactLinks: Record<string, string> = {
  vision_page: "/vision",
  quarterly_bets: "/bets",
  scoreboard: "/scoreboard",
  meeting_cadence: "/sync",
  role_cards: "/profile",
  process_library: "#",
  media_calendar: "#",
};

const artifactIcons: Record<string, string> = {
  vision_page: "North Star for the venture",
  quarterly_bets: "3 active bets per quarter",
  scoreboard: "5-15 KPIs with R/Y/G health",
  meeting_cadence: "Weekly sync, monthly review, quarterly summit",
  role_cards: "Outcomes, metrics, authority per person",
  process_library: "Documented operational processes",
  media_calendar: "Content output across machines",
};

// ============================================================
// Artifact Card
// ============================================================

function ArtifactCard({ artifact }: { artifact: StalenessResult }) {
  const link = artifactLinks[artifact.artifact_type] ?? "#";
  const description = artifactIcons[artifact.artifact_type] ?? "";

  const healthStatus = artifact.is_stale
    ? "red"
    : artifact.days_since_update !== null &&
        artifact.days_since_update >
          artifact.staleness_threshold_days * 0.8
      ? "yellow"
      : "green";

  const healthColors: Record<string, string> = {
    green: "var(--color-semantic-green)",
    yellow: "var(--color-semantic-ochre)",
    red: "var(--color-semantic-brick)",
  };

  return (
    <a href={link} className="block">
      <Card
        borderColor={healthColors[healthStatus]}
        className="hover:shadow-md transition-shadow"
      >
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-charcoal">
                {artifact.name}
              </h3>
              <p className="text-xs text-warm-gray mt-0.5">{description}</p>
            </div>
            <Badge
              status={
                healthStatus as "green" | "yellow" | "red"
              }
            >
              {artifact.is_stale
                ? "STALE"
                : healthStatus === "yellow"
                  ? "DUE SOON"
                  : "CURRENT"}
            </Badge>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs">
            <div className="text-warm-gray">
              {artifact.last_updated_at ? (
                <>
                  Last updated:{" "}
                  {new Date(artifact.last_updated_at).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                  {artifact.days_since_update !== null && (
                    <span className="ml-1">
                      ({artifact.days_since_update}d ago)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-semantic-brick font-medium">
                  Never updated
                </span>
              )}
            </div>
            <div className="text-warm-gray">
              Cadence: every {artifact.staleness_threshold_days}d
            </div>
          </div>

          {/* Freshness bar */}
          {artifact.days_since_update !== null && (
            <div className="mt-2">
              <div className="h-1 rounded-full bg-warm-border overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    healthStatus === "red"
                      ? "bg-semantic-brick"
                      : healthStatus === "yellow"
                        ? "bg-semantic-ochre"
                        : "bg-semantic-green"
                  }`}
                  style={{
                    width: `${Math.min(
                      (artifact.days_since_update /
                        artifact.staleness_threshold_days) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </a>
  );
}

// ============================================================
// Main View
// ============================================================

export function ArtifactsView({
  artifacts,
}: {
  artifacts: StalenessResult[];
}) {
  const staleCount = artifacts.filter((a) => a.is_stale).length;
  const currentCount = artifacts.filter((a) => !a.is_stale).length;

  // Sort stale first
  const sorted = [...artifacts].sort((a, b) => {
    if (a.is_stale && !b.is_stale) return -1;
    if (!a.is_stale && b.is_stale) return 1;
    return (b.days_since_update ?? 999) - (a.days_since_update ?? 999);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Core Artifacts</h1>
          <p className="text-sm text-warm-gray mt-0.5">
            The 7 artifacts that keep the operating system alive. Each has an
            owner and an expected update cadence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {staleCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-semantic-brick/10 text-semantic-brick font-medium">
              {staleCount} stale
            </span>
          )}
          <span className="text-xs px-2 py-1 rounded-full bg-semantic-green/10 text-semantic-green-text font-medium">
            {currentCount} current
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((artifact) => (
          <ArtifactCard key={artifact.artifact_type} artifact={artifact} />
        ))}
      </div>
    </div>
  );
}
