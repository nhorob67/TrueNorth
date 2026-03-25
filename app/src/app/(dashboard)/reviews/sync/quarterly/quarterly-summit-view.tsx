"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserContext } from "@/hooks/use-user-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetingTimer } from "@/components/meetings/meeting-timer";
import { SegmentNav, type SegmentConfig } from "@/components/meetings/segment-nav";
import { AttendanceTracker } from "@/components/meetings/attendance-tracker";

// ============================================================
// Types
// ============================================================

interface VisionData {
  id: string;
  bhag: string;
  strategic_filters: Array<{ id: string; name: string; description: string }>;
  annual_outcomes: Array<{ id: string; description: string; constraints: Record<string, string> }>;
  not_doing_list: string[];
  year: number;
  locked: boolean;
}

interface BetMove {
  id: string;
  title: string;
  lifecycle_status: string;
  health_status: string;
  type: string;
  owner_id: string;
}

interface ActiveBet {
  id: string;
  outcome: string;
  health_status: "green" | "yellow" | "red";
  owner_id: string;
  lifecycle_status: string;
  moves: BetMove[];
}

interface ClosedBet {
  id: string;
  outcome: string;
  health_status: "green" | "yellow" | "red";
  owner_id: string;
  lifecycle_status: string;
  updated_at: string;
}

interface Kpi {
  id: string;
  name: string;
  health_status: "green" | "yellow" | "red";
  current_value: number | null;
  target: number | null;
  unit: string | null;
  owner_id: string;
  lifecycle_status: string;
}

interface KpiSnapshot {
  kpi_id: string;
  value: number;
  snapshot_date: string;
}

interface IdeaCandidate {
  id: string;
  name: string;
  description: string;
  classification: string | null;
  score_total: number | null;
  score_alignment: number | null;
  score_revenue: number | null;
  score_effort: number | null;
  lifecycle_status: string;
  submitter_id: string;
  created_at: string;
}

interface RoleCard {
  id: string;
  entity_id: string;
  entity_type: "user" | "agent";
  outcomes_owned: string[];
  metrics_moved: string[];
  decision_authority: string;
  commitments_standard: string;
}

interface TeamMember {
  user_id: string;
  role: string;
  full_name: string;
}

interface BetGrade {
  betId: string;
  grade: "A" | "B" | "C" | "D";
  lessons: string;
}

type QuarterlySegment = "bhag" | "outgoing" | "incoming" | "scoreboard" | "not_doing" | "commitments";

const SEGMENT_CONFIG: SegmentConfig<QuarterlySegment>[] = [
  {
    key: "bhag",
    label: "BHAG Progress",
    duration: 15,
    description: "Review BHAG, annual outcomes, and key metrics.",
  },
  {
    key: "outgoing",
    label: "Outgoing Bets",
    duration: 20,
    description: "Grade each active bet from the ending quarter.",
  },
  {
    key: "incoming",
    label: "Incoming Bets",
    duration: 25,
    description: "Select up to 3 new bets from the idea vault.",
  },
  {
    key: "scoreboard",
    label: "Scoreboard",
    duration: 20,
    description: "Recalibrate KPI targets and thresholds.",
  },
  {
    key: "not_doing",
    label: "Not Doing List",
    duration: 10,
    description: "Review and update what we choose not to pursue.",
  },
  {
    key: "commitments",
    label: "Commitments & Close",
    duration: 30,
    description: "Finalize commitments, assign owners, and save the summit.",
  },
];

const TOTAL_MINUTES = 120;

// ============================================================
// Segment Components
// ============================================================

function BhagProgressSegment({
  vision,
  kpis,
}: {
  vision: VisionData | null;
  kpis: Kpi[];
}) {
  if (!vision) {
    return (
      <div className="py-8 text-center text-subtle">
        No vision data found. Set up your Vision Board first.
      </div>
    );
  }

  const greenCount = kpis.filter((k) => k.health_status === "green").length;
  const yellowCount = kpis.filter((k) => k.health_status === "yellow").length;
  const redCount = kpis.filter((k) => k.health_status === "red").length;

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">{SEGMENT_CONFIG[0].description}</p>

      {/* BHAG */}
      <Card className="bg-brass/5 border-brass/20">
        <CardContent className="py-4">
          <p className="font-mono text-[10px] font-semibold text-brass uppercase tracking-[0.10em] mb-1">BHAG</p>
          <p className="text-lg font-medium text-ink">{vision.bhag}</p>
        </CardContent>
      </Card>

      {/* Annual Outcomes */}
      <div>
        <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
          Annual Outcomes ({vision.year})
        </h3>
        <div className="space-y-2">
          {vision.annual_outcomes.map((outcome) => (
            <Card key={outcome.id}>
              <CardContent className="py-3">
                <p className="text-sm text-ink">{outcome.description}</p>
                {Object.keys(outcome.constraints).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(outcome.constraints).map(([k, v]) => (
                      <span key={k} className="text-xs px-2 py-0.5 bg-canvas border border-line rounded">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Key metrics summary */}
      <div>
        <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
          Scoreboard Health
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-semantic-green/10 rounded-lg">
            <p className="text-2xl font-mono font-bold text-semantic-green-text">{greenCount}</p>
            <p className="text-xs text-subtle">Green</p>
          </div>
          <div className="text-center p-3 bg-semantic-ochre/10 rounded-lg">
            <p className="text-2xl font-mono font-bold text-semantic-ochre-text">{yellowCount}</p>
            <p className="text-xs text-subtle">Yellow</p>
          </div>
          <div className="text-center p-3 bg-semantic-brick/10 rounded-lg">
            <p className="text-2xl font-mono font-bold text-semantic-brick">{redCount}</p>
            <p className="text-xs text-subtle">Red</p>
          </div>
        </div>
      </div>

      {/* Discussion prompts */}
      <div className="p-3 bg-sage/10 border border-sage/20 rounded-lg">
        <p className="font-mono text-[10px] font-semibold text-sage uppercase tracking-[0.10em] mb-2">Discussion Prompts</p>
        <ul className="space-y-1 text-sm text-ink">
          <li>• Are we closer to our BHAG than 3 months ago?</li>
          <li>• Which annual outcomes are at risk?</li>
          <li>• Do our current bets align with the biggest gaps?</li>
          <li>• What has changed in our market since last quarter?</li>
        </ul>
      </div>
    </div>
  );
}

function OutgoingBetsSegment({
  activeBets,
  closedBets,
  betGrades,
  onGradeBet,
  teamMembers,
}: {
  activeBets: ActiveBet[];
  closedBets: ClosedBet[];
  betGrades: BetGrade[];
  onGradeBet: (betId: string, grade: "A" | "B" | "C" | "D", lessons: string) => void;
  teamMembers: TeamMember[];
}) {
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const [tempGrade, setTempGrade] = useState<"A" | "B" | "C" | "D">("B");
  const [tempLessons, setTempLessons] = useState("");

  const allBets = [...activeBets, ...closedBets.map((b) => ({ ...b, moves: [] as BetMove[] }))];
  const gradeColors: Record<string, string> = {
    A: "text-semantic-green-text bg-semantic-green/10",
    B: "text-accent bg-accent/10",
    C: "text-semantic-ochre-text bg-semantic-ochre/10",
    D: "text-semantic-brick bg-semantic-brick/10",
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">{SEGMENT_CONFIG[1].description}</p>

      <div className="space-y-3">
        {allBets.map((bet) => {
          const existingGrade = betGrades.find((g) => g.betId === bet.id);
          const isEditing = editingBetId === bet.id;

          return (
            <Card key={bet.id}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{bet.outcome}</p>
                    <p className="text-xs text-subtle mt-0.5">
                      Owner: {teamMembers.find((m) => m.user_id === bet.owner_id)?.full_name ?? "Unassigned"}
                      {" · "}{bet.lifecycle_status}
                    </p>
                    {"moves" in bet && (bet as ActiveBet).moves.length > 0 && (
                      <div className="flex gap-2 mt-1 text-xs text-subtle">
                        <span>{(bet as ActiveBet).moves.filter((m) => m.lifecycle_status === "shipped").length}/{(bet as ActiveBet).moves.length} shipped</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={bet.health_status}>{bet.health_status.toUpperCase()}</Badge>
                    {existingGrade ? (
                      <span className={`px-2 py-1 rounded text-sm font-bold ${gradeColors[existingGrade.grade]}`}>
                        {existingGrade.grade}
                      </span>
                    ) : (
                      <Button
                        variant="tertiary"
                        size="sm"
                        onClick={() => {
                          setEditingBetId(isEditing ? null : bet.id);
                          setTempGrade("B");
                          setTempLessons("");
                        }}
                      >
                        Grade
                      </Button>
                    )}
                  </div>
                </div>

                {existingGrade && (
                  <div className="mt-2 p-2 bg-canvas rounded text-xs text-ink">
                    <span className="font-semibold">Lessons:</span> {existingGrade.lessons}
                  </div>
                )}

                {isEditing && (
                  <div className="mt-3 space-y-2 p-3 bg-canvas rounded-lg">
                    <div className="flex gap-2">
                      {(["A", "B", "C", "D"] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setTempGrade(g)}
                          className={`px-3 py-1.5 rounded text-sm font-bold border transition-colors ${
                            tempGrade === g
                              ? gradeColors[g] + " border-current"
                              : "text-subtle border-line"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                      <div className="text-xs text-subtle flex items-center ml-2">
                        A=Exceeded B=Met C=Partial D=Failed
                      </div>
                    </div>
                    <textarea
                      value={tempLessons}
                      onChange={(e) => setTempLessons(e.target.value)}
                      placeholder="Lessons learned..."
                      rows={2}
                      className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink placeholder:text-subtle focus:outline-none focus:border-line-focus"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="tertiary" size="sm" onClick={() => setEditingBetId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!tempLessons.trim()}
                        onClick={() => {
                          onGradeBet(bet.id, tempGrade, tempLessons.trim());
                          setEditingBetId(null);
                        }}
                      >
                        Save Grade
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function IncomingBetsSegment({
  ideaCandidates,
  selectedIdeas,
  onSelectIdea,
  onDeselectIdea,
}: {
  ideaCandidates: IdeaCandidate[];
  selectedIdeas: Set<string>;
  onSelectIdea: (ideaId: string) => void;
  onDeselectIdea: (ideaId: string) => void;
}) {
  const classificationCounts: Record<string, number> = {};
  for (const id of selectedIdeas) {
    const idea = ideaCandidates.find((i) => i.id === id);
    if (idea?.classification) {
      classificationCounts[idea.classification] = (classificationCounts[idea.classification] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">{SEGMENT_CONFIG[2].description}</p>

      {/* Selection summary */}
      <div className="flex items-center justify-between p-3 bg-brass/5 border border-brass/20 rounded-lg">
        <div>
          <span className="text-sm font-medium text-ink">
            {selectedIdeas.size}/3 bets selected
          </span>
          {selectedIdeas.size > 0 && (
            <div className="flex gap-2 mt-1">
              {Object.entries(classificationCounts).map(([cls, count]) => (
                <span key={cls} className="text-xs px-2 py-0.5 bg-surface border border-line rounded capitalize">
                  {cls}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
        {selectedIdeas.size >= 3 && (
          <Badge status="green">Full</Badge>
        )}
      </div>

      {/* Idea candidates */}
      <div className="space-y-2">
        {ideaCandidates.length === 0 ? (
          <p className="text-sm text-subtle py-4 text-center">
            No idea candidates available. Score ideas in the Idea Vault first.
          </p>
        ) : (
          ideaCandidates.map((idea) => {
            const isSelected = selectedIdeas.has(idea.id);
            return (
              <Card
                key={idea.id}
                borderColor={isSelected ? "var(--color-brass)" : undefined}
              >
                <CardContent className="py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{idea.name}</p>
                      {idea.description && (
                        <p className="text-xs text-subtle mt-0.5 line-clamp-2">{idea.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {idea.classification && (
                          <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded capitalize">
                            {idea.classification}
                          </span>
                        )}
                        {idea.score_total !== null && (
                          <span className="text-xs font-mono text-brass font-bold">
                            Score: {idea.score_total}
                          </span>
                        )}
                        <div className="flex gap-1 text-xs text-subtle">
                          {idea.score_alignment !== null && <span>A:{idea.score_alignment}</span>}
                          {idea.score_revenue !== null && <span>R:{idea.score_revenue}</span>}
                          {idea.score_effort !== null && <span>E:{idea.score_effort}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="ml-3">
                      {isSelected ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onDeselectIdea(idea.id)}
                        >
                          Deselect
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={selectedIdeas.size >= 3}
                          onClick={() => onSelectIdea(idea.id)}
                        >
                          Select as Bet
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function ScoreboardRecalibrationSegment({
  kpis,
  kpiTargetEdits,
  onEditTarget,
}: {
  kpis: Kpi[];
  kpiTargetEdits: Record<string, number>;
  onEditTarget: (kpiId: string, newTarget: number) => void;
}) {
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [tempTarget, setTempTarget] = useState("");

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">{SEGMENT_CONFIG[3].description}</p>

      <div className="space-y-2">
        {kpis.map((kpi) => {
          const editedTarget = kpiTargetEdits[kpi.id];
          const displayTarget = editedTarget !== undefined ? editedTarget : kpi.target;
          const isEditing = editingKpiId === kpi.id;

          return (
            <Card key={kpi.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink">{kpi.name}</p>
                      <Badge status={kpi.health_status}>{kpi.health_status.toUpperCase()}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-subtle">
                      <span>
                        Current: <span className="font-mono font-medium text-ink">{kpi.current_value ?? "—"}</span>
                      </span>
                      <span>
                        Target:{" "}
                        <span className={`font-mono font-medium ${editedTarget !== undefined ? "text-brass" : "text-ink"}`}>
                          {displayTarget ?? "—"}
                        </span>
                        {editedTarget !== undefined && kpi.target !== null && (
                          <span className="text-subtle ml-1">(was {kpi.target})</span>
                        )}
                      </span>
                      {kpi.unit && <span>{kpi.unit}</span>}
                    </div>
                  </div>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => {
                      if (isEditing) {
                        setEditingKpiId(null);
                      } else {
                        setEditingKpiId(kpi.id);
                        setTempTarget(String(displayTarget ?? ""));
                      }
                    }}
                  >
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                </div>
                {isEditing && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      type="number"
                      value={tempTarget}
                      onChange={(e) => setTempTarget(e.target.value)}
                      placeholder="New target..."
                      className="w-32"
                    />
                    <Button
                      size="sm"
                      disabled={!tempTarget.trim()}
                      onClick={() => {
                        onEditTarget(kpi.id, Number(tempTarget));
                        setEditingKpiId(null);
                      }}
                    >
                      Set Target
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NotDoingListSegment({
  items,
  onAdd,
  onRemove,
}: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
}) {
  const [newItem, setNewItem] = useState("");

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">{SEGMENT_CONFIG[4].description}</p>

      <div>
        <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
          Current Not Doing List ({items.length})
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-subtle py-4 text-center">
            No items on the Not Doing list.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 px-3 bg-surface border border-line rounded">
                <span className="text-ink">{item}</span>
                <button
                  onClick={() => onRemove(i)}
                  className="text-xs text-semantic-brick hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add something to the Not Doing list..."
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newItem.trim()) {
              onAdd(newItem.trim());
              setNewItem("");
            }
          }}
        />
        <Button
          size="sm"
          disabled={!newItem.trim()}
          onClick={() => {
            onAdd(newItem.trim());
            setNewItem("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function CommitmentsCloseSegment({
  commitments,
  betGrades,
  selectedIdeas,
  kpiChanges,
  teamMembers,
  newCommDesc,
  newCommOwner,
  newCommDueDate,
  onNewCommDescChange,
  onNewCommOwnerChange,
  onNewCommDueDateChange,
  onAddCommitment,
}: {
  commitments: Array<{ description: string; ownerId: string; dueDate: string }>;
  betGrades: BetGrade[];
  selectedIdeas: Set<string>;
  kpiChanges: Record<string, number>;
  teamMembers: TeamMember[];
  newCommDesc: string;
  newCommOwner: string;
  newCommDueDate: string;
  onNewCommDescChange: (v: string) => void;
  onNewCommOwnerChange: (v: string) => void;
  onNewCommDueDateChange: (v: string) => void;
  onAddCommitment: () => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle">{SEGMENT_CONFIG[5].description}</p>

      {/* Summit summary */}
      <Card className="bg-accent/5">
        <CardHeader>
          <h3 className="text-sm font-semibold text-accent">Summit Summary</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-subtle uppercase mb-1">Bets Graded</p>
              <p className="font-mono text-lg text-ink">{betGrades.length}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-subtle uppercase mb-1">New Bets Selected</p>
              <p className="font-mono text-lg text-ink">{selectedIdeas.size}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-subtle uppercase mb-1">KPIs Adjusted</p>
              <p className="font-mono text-lg text-ink">{Object.keys(kpiChanges).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commitments */}
      <div>
        <h3 className="font-mono text-[10px] font-semibold text-ink uppercase tracking-[0.10em] mb-2">
          Commitments ({commitments.length})
        </h3>
        {commitments.length > 0 && (
          <div className="space-y-1 mb-3">
            {commitments.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 bg-accent/5 rounded">
                <span className="text-ink">{c.description}</span>
                <span className="text-xs text-subtle">
                  {teamMembers.find((m) => m.user_id === c.ownerId)?.full_name ?? "Unassigned"}
                  {c.dueDate && ` · Due ${c.dueDate}`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={newCommDesc}
            onChange={(e) => onNewCommDescChange(e.target.value)}
            placeholder="Commitment description..."
            className="flex-1"
          />
          <select
            value={newCommOwner}
            onChange={(e) => onNewCommOwnerChange(e.target.value)}
            className="text-sm border border-line rounded-lg px-2 py-2 bg-surface w-36"
          >
            <option value="">Owner</option>
            {teamMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
            ))}
          </select>
          <Input
            type="date"
            value={newCommDueDate}
            onChange={(e) => onNewCommDueDateChange(e.target.value)}
            className="w-36"
          />
          <Button
            size="sm"
            disabled={!newCommDesc.trim() || !newCommOwner}
            onClick={onAddCommitment}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Quarterly Summit View
// ============================================================

export function QuarterlySummitView({
  vision,
  activeBets,
  closedBets,
  kpis,
  kpiSnapshots: _kpiSnapshots,
  ideaCandidates,
  roleCards: _roleCards,
  teamMembers,
}: {
  vision: VisionData | null;
  activeBets: ActiveBet[];
  closedBets: ClosedBet[];
  kpis: Kpi[];
  kpiSnapshots: KpiSnapshot[];
  ideaCandidates: IdeaCandidate[];
  roleCards: RoleCard[];
  teamMembers: TeamMember[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const userCtx = useUserContext();

  const [activeSegment, setActiveSegment] = useState<QuarterlySegment>("bhag");
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_MINUTES * 60);
  const [segmentTimeUsed, setSegmentTimeUsed] = useState<Record<QuarterlySegment, number>>({
    bhag: 0,
    outgoing: 0,
    incoming: 0,
    scoreboard: 0,
    not_doing: 0,
    commitments: 0,
  });

  const [betGrades, setBetGrades] = useState<BetGrade[]>([]);
  const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(new Set());
  const [kpiTargetEdits, setKpiTargetEdits] = useState<Record<string, number>>({});
  const [notDoingList, setNotDoingList] = useState<string[]>(vision?.not_doing_list ?? []);
  const [notDoingAdded, setNotDoingAdded] = useState<string[]>([]);
  const [notDoingRemoved, setNotDoingRemoved] = useState<string[]>([]);
  const [summitCommitments, setSummitCommitments] = useState<Array<{ description: string; ownerId: string; dueDate: string }>>([]);
  const [attendees, setAttendees] = useState<string[]>(teamMembers.map((m) => m.user_id));

  const [newCommDesc, setNewCommDesc] = useState("");
  const [newCommOwner, setNewCommOwner] = useState("");
  const [newCommDueDate, setNewCommDueDate] = useState("");

  const [meetingSaved, setMeetingSaved] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const meetingStartedAtRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Timer tick
  useEffect(() => {
    if (!timerRunning) return;
    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      setSecondsRemaining((prev) => prev - elapsed);
      setSegmentTimeUsed((prev) => ({
        ...prev,
        [activeSegment]: (prev[activeSegment] ?? 0) + elapsed,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, activeSegment]);

  const currentConfig = SEGMENT_CONFIG.find((s) => s.key === activeSegment);
  const segmentTimeLimit = (currentConfig?.duration ?? 10) * 60;
  const isOverTime = (segmentTimeUsed[activeSegment] ?? 0) > segmentTimeLimit;

  const handleToggleTimer = useCallback(() => {
    if (!timerRunning && !meetingStartedAtRef.current) {
      meetingStartedAtRef.current = new Date().toISOString();
    }
    setTimerRunning(!timerRunning);
  }, [timerRunning]);

  const handleGradeBet = useCallback(
    async (betId: string, grade: "A" | "B" | "C" | "D", lessons: string) => {
      setBetGrades((prev) => [...prev, { betId, grade, lessons }]);

      // Create a Decision record to capture the grade
      await supabase.from("decisions").insert({
        organization_id: userCtx.orgId,
        title: `Q-grade: ${activeBets.find((b) => b.id === betId)?.outcome ?? betId}`,
        context: `Grade: ${grade}. Lessons: ${lessons}`,
        final_decision: `Grade ${grade}`,
        decided_at: new Date().toISOString(),
        owner_id: userCtx.userId,
      });
    },
    [supabase, userCtx, activeBets]
  );

  const handleSelectIdea = useCallback((ideaId: string) => {
    setSelectedIdeas((prev) => new Set([...prev, ideaId]));
  }, []);

  const handleDeselectIdea = useCallback((ideaId: string) => {
    setSelectedIdeas((prev) => {
      const next = new Set(prev);
      next.delete(ideaId);
      return next;
    });
  }, []);

  const handleEditKpiTarget = useCallback((kpiId: string, newTarget: number) => {
    setKpiTargetEdits((prev) => ({ ...prev, [kpiId]: newTarget }));
  }, []);

  const handleAddNotDoing = useCallback((item: string) => {
    setNotDoingList((prev) => [...prev, item]);
    setNotDoingAdded((prev) => [...prev, item]);
  }, []);

  const handleRemoveNotDoing = useCallback(
    (index: number) => {
      const removed = notDoingList[index];
      setNotDoingList((prev) => prev.filter((_, i) => i !== index));
      setNotDoingRemoved((prev) => [...prev, removed]);
    },
    [notDoingList]
  );

  const handleAddCommitment = useCallback(async () => {
    if (!newCommDesc.trim() || !newCommOwner) return;

    const commitment = {
      description: newCommDesc.trim(),
      ownerId: newCommOwner,
      dueDate: newCommDueDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };

    setSummitCommitments((prev) => [...prev, commitment]);

    await supabase.from("commitments").insert({
      organization_id: userCtx.orgId,
      description: commitment.description,
      owner_id: commitment.ownerId,
      due_date: commitment.dueDate,
      created_in: "quarterly_summit",
    });

    setNewCommDesc("");
    setNewCommOwner("");
    setNewCommDueDate("");
    router.refresh();
  }, [supabase, userCtx.orgId, newCommDesc, newCommOwner, newCommDueDate, router]);

  const handleSaveSummit = useCallback(async () => {
    if (!meetingStartedAtRef.current) return;
    setSavingMeeting(true);

    const now = new Date();
    const startedAt = new Date(meetingStartedAtRef.current);
    const durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);

    // Convert selected ideas to bets
    for (const ideaId of selectedIdeas) {
      const idea = ideaCandidates.find((i) => i.id === ideaId);
      if (idea) {
        await supabase.from("bets").insert({
          organization_id: userCtx.orgId,
          venture_id: userCtx.ventureId,
          outcome: idea.name,
          owner_id: userCtx.userId,
          lifecycle_status: "active",
          health_status: "green",
        });

        await supabase
          .from("ideas")
          .update({ lifecycle_status: "selected" })
          .eq("id", ideaId);
      }
    }

    // Apply KPI target changes
    for (const [kpiId, newTarget] of Object.entries(kpiTargetEdits)) {
      await supabase
        .from("kpis")
        .update({ target: newTarget })
        .eq("id", kpiId);
    }

    // Update vision not-doing list
    if (vision && (notDoingAdded.length > 0 || notDoingRemoved.length > 0)) {
      await supabase
        .from("visions")
        .update({ not_doing_list: notDoingList })
        .eq("id", vision.id);
    }

    // Save meeting log
    await supabase.from("meeting_logs").insert({
      organization_id: userCtx.orgId,
      venture_id: userCtx.ventureId || null,
      meeting_type: "quarterly_summit",
      started_at: meetingStartedAtRef.current,
      completed_at: now.toISOString(),
      duration_seconds: durationSeconds,
      output: {
        attendees,
        betGrades,
        selectedIdeas: Array.from(selectedIdeas).map((id) => ({
          ideaId: id,
          title: ideaCandidates.find((i) => i.id === id)?.name ?? "",
        })),
        kpiChanges: Object.entries(kpiTargetEdits).map(([kpiId, newTarget]) => ({
          kpiId,
          action: "target_adjusted",
          newTarget,
        })),
        notDoingListChanges: {
          added: notDoingAdded,
          removed: notDoingRemoved,
        },
        newCommitmentsCount: summitCommitments.length,
      },
      facilitator_id: userCtx.userId,
    });

    setSavingMeeting(false);
    setMeetingSaved(true);
    setTimerRunning(false);
    router.refresh();
  }, [
    supabase, userCtx, vision, ideaCandidates, selectedIdeas,
    kpiTargetEdits, notDoingList, notDoingAdded, notDoingRemoved,
    betGrades, attendees, summitCommitments, router,
  ]);

  function advanceSegment() {
    const idx = SEGMENT_CONFIG.findIndex((s) => s.key === activeSegment);
    if (idx < SEGMENT_CONFIG.length - 1) {
      setActiveSegment(SEGMENT_CONFIG[idx + 1].key);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">Quarterly Summit</h1>
          <p className="text-sm text-subtle mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Attendance */}
      <div className="mb-4">
        <AttendanceTracker teamMembers={teamMembers} onAttendanceChange={setAttendees} />
      </div>

      {/* Timer */}
      <MeetingTimer
        running={timerRunning}
        onToggle={handleToggleTimer}
        secondsRemaining={secondsRemaining}
        totalMinutes={TOTAL_MINUTES}
      />

      {/* Segment navigation */}
      <SegmentNav
        segments={SEGMENT_CONFIG}
        activeSegment={activeSegment}
        onSelect={setActiveSegment}
        segmentTimeUsed={segmentTimeUsed}
      />

      {/* Over-time warning */}
      {isOverTime && timerRunning && (
        <div className="mb-4 p-2 bg-semantic-ochre/10 border border-semantic-ochre/20 rounded-lg text-xs text-semantic-ochre-text text-center">
          Over time for this segment.{" "}
          <button onClick={advanceSegment} className="font-semibold underline">
            Move to next
          </button>
        </div>
      )}

      {/* Active segment content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{currentConfig?.label}</h2>
            <Button variant="tertiary" size="sm" onClick={advanceSegment}>
              Next Segment &rarr;
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeSegment === "bhag" && (
            <BhagProgressSegment vision={vision} kpis={kpis} />
          )}
          {activeSegment === "outgoing" && (
            <OutgoingBetsSegment
              activeBets={activeBets}
              closedBets={closedBets}
              betGrades={betGrades}
              onGradeBet={handleGradeBet}
              teamMembers={teamMembers}
            />
          )}
          {activeSegment === "incoming" && (
            <IncomingBetsSegment
              ideaCandidates={ideaCandidates}
              selectedIdeas={selectedIdeas}
              onSelectIdea={handleSelectIdea}
              onDeselectIdea={handleDeselectIdea}
            />
          )}
          {activeSegment === "scoreboard" && (
            <ScoreboardRecalibrationSegment
              kpis={kpis}
              kpiTargetEdits={kpiTargetEdits}
              onEditTarget={handleEditKpiTarget}
            />
          )}
          {activeSegment === "not_doing" && (
            <NotDoingListSegment
              items={notDoingList}
              onAdd={handleAddNotDoing}
              onRemove={handleRemoveNotDoing}
            />
          )}
          {activeSegment === "commitments" && (
            <CommitmentsCloseSegment
              commitments={summitCommitments}
              betGrades={betGrades}
              selectedIdeas={selectedIdeas}
              kpiChanges={kpiTargetEdits}
              teamMembers={teamMembers}
              newCommDesc={newCommDesc}
              newCommOwner={newCommOwner}
              newCommDueDate={newCommDueDate}
              onNewCommDescChange={setNewCommDesc}
              onNewCommOwnerChange={setNewCommOwner}
              onNewCommDueDateChange={setNewCommDueDate}
              onAddCommitment={handleAddCommitment}
            />
          )}
        </CardContent>
      </Card>

      {/* Save summit */}
      {meetingStartedAtRef.current && !meetingSaved && (
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="primary" onClick={handleSaveSummit} disabled={savingMeeting}>
            {savingMeeting ? "Saving..." : "Save Summit"}
          </Button>
        </div>
      )}

      {meetingSaved && (
        <div className="mt-4 p-3 bg-semantic-green/10 border border-semantic-green/20 rounded-lg text-center text-sm text-semantic-green-text font-medium">
          Quarterly summit saved successfully. {selectedIdeas.size} new bets created.
        </div>
      )}
    </div>
  );
}
