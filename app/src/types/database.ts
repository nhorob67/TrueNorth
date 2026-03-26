// Core entity types used across the application.
// These will be expanded as each phase adds tables.

export type OrganizationRole = "admin" | "manager" | "member" | "viewer";
export type VentureRole = "admin" | "manager" | "member" | "viewer";

export type LifecycleStatus = "active" | "paused" | "archived" | "completed";
export type HealthStatus = "green" | "yellow" | "red";

export type EntityType =
  | "bet"
  | "kpi"
  | "move"
  | "move_instance"
  | "idea"
  | "funnel"
  | "decision"
  | "blocker"
  | "commitment"
  | "issue"
  | "process"
  | "content_piece"
  | "todo";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Venture {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  settings: Record<string, unknown>;
}

export interface OrganizationMembership {
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
}

export interface VentureMembership {
  user_id: string;
  venture_id: string;
  role: VentureRole;
}

// ============================================================
// Vision Board (Pillar 1)
// ============================================================

export interface Vision {
  id: string;
  venture_id: string;
  organization_id: string;
  bhag: string;
  strategic_filters: StrategicFilter[];
  annual_outcomes: AnnualOutcome[];
  not_doing_list: string[];
  year: number;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface StrategicFilter {
  id: string;
  name: string;
  description: string;
}

export interface AnnualOutcome {
  id: string;
  description: string;
  constraints: {
    team_size?: string;
    budget_cap?: string;
    timeline?: string;
    complexity?: string;
  };
}

export interface VisionSnapshot {
  id: string;
  vision_id: string;
  snapshot: Vision;
  created_at: string;
  created_by: string;
}

// ============================================================
// Idea Vault (Pillar 2)
// ============================================================

export type IdeaClassification = "more" | "better" | "new";

export type IdeaLifecycleStatus =
  | "quarantine"
  | "filter_review"
  | "scoring"
  | "candidate"
  | "archived"
  | "selected";

export interface IdeaFilterResult {
  filter_id: string;
  filter_name: string;
  passed: boolean;
  reasoning: string;
  ai_generated: boolean;
}

export interface Idea {
  id: string;
  venture_id: string;
  organization_id: string;
  name: string;
  description: string;
  classification: IdeaClassification | null;
  submitter_id: string;
  submitted_at: string;
  cooling_expires_at: string;
  lifecycle_status: IdeaLifecycleStatus;
  filter_results: IdeaFilterResult[];
  score_alignment: number | null;
  score_revenue: number | null;
  score_effort: number | null;
  score_total: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Moves (Enhanced — Pillar 3 Execution)
// ============================================================

export type MoveType = "milestone" | "recurring";

export type MoveLifecycleStatus = "not_started" | "in_progress" | "shipped" | "cut";

export type MoveCadence = "daily" | "weekly" | "biweekly" | "monthly";

export interface Move {
  id: string;
  bet_id: string;
  venture_id: string;
  organization_id: string;
  type: MoveType;
  title: string;
  description: string | null;
  owner_id: string;
  lifecycle_status: MoveLifecycleStatus;
  health_status: HealthStatus;
  due_date: string | null;
  effort_estimate: { value?: number; unit?: string } | null;
  position: number;
  cut_reason: string | null;
  // Recurring-specific fields
  cadence: MoveCadence | null;
  target_per_cycle: number | null;
  content_machine_id: string | null;
  external_source: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type MoveInstanceStatus = "pending" | "completed" | "missed" | "skipped";

export interface MoveInstance {
  id: string;
  move_id: string;
  cycle_start: string;
  cycle_end: string;
  status: MoveInstanceStatus;
  completed_at: string | null;
  linked_entity_id: string | null;
  linked_entity_type: string | null;
  notes: string | null;
  skip_reason: string | null;
}

// ============================================================
// Role Cards (Pillar 6)
// ============================================================

export interface RoleCard {
  id: string;
  entity_id: string;
  entity_type: "user" | "agent";
  organization_id: string;
  venture_assignments: string[];
  outcomes_owned: string[];
  metrics_moved: string[]; // KPI IDs — resolved to live R/Y/G at render time
  decision_authority: string;
  interfaces: string;
  commitments_standard: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// AI Agents (Pillar 2.4)
// ============================================================

export type AgentCategory =
  | "filter_guardian"
  | "signal_watch"
  | "content_copilot"
  | "cockpit_advisor"
  | "agenda_builder";

export type AgentStatus = "active" | "paused" | "disabled";

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: string;
  automation_level: number;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================
// AI Actions Log (Section 3.9 — Trust & Audit Dashboard)
// ============================================================

export type AiActionType = "recommendation" | "evaluation" | "assessment" | "generation";
export type AiActionOutcome = "accepted" | "overridden" | "ignored" | "pending";
export type AiConfidence = "high" | "medium" | "low";

export interface AiAction {
  id: string;
  organization_id: string;
  agent_category: string;
  action_type: string;
  entity_id: string | null;
  entity_type: string | null;
  input_summary: string | null;
  output_summary: string | null;
  outcome: string;
  override_reason: string | null;
  confidence: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

// ============================================================
// Core Artifacts & Staleness (Pillar 9)
// ============================================================

export type ArtifactType =
  | "vision_page"
  | "quarterly_bets"
  | "scoreboard"
  | "meeting_cadence"
  | "role_cards"
  | "process_library"
  | "media_calendar";

export interface CoreArtifact {
  id: string;
  organization_id: string;
  venture_id: string | null;
  artifact_type: ArtifactType;
  name: string;
  owner_id: string;
  update_cadence_days: number;
  last_updated_at: string;
  staleness_threshold_days: number;
  is_stale: boolean;
  created_at: string;
}

// ============================================================
// Content Machines (Pillar 7)
// ============================================================

export type ContentMachineType = "newsletter" | "deep_content" | "short_form" | "live_event";

export type ContentLifecycleStatus =
  | "ideation"
  | "drafting"
  | "review"
  | "scheduled"
  | "published";

export interface ContentPiece {
  id: string;
  organization_id: string;
  venture_id: string;
  title: string;
  machine_type: ContentMachineType;
  lifecycle_status: ContentLifecycleStatus;
  body_json: Record<string, unknown>;
  owner_id: string;
  scheduled_at: string | null;
  linked_funnel_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentVersion {
  id: string;
  content_piece_id: string;
  body_json: Record<string, unknown>;
  body_html: string;
  created_at: string;
  created_by: string;
}

// ============================================================
// Funnel Registry (Pillar 7)
// ============================================================

export type FunnelHealth = "healthy" | "underperforming" | "stalled" | "orphaned";

export interface Funnel {
  id: string;
  organization_id: string;
  venture_id: string;
  name: string;
  entry_point: string;
  capture_mechanism: string;
  nurture_sequence: string;
  conversion_event: string;
  scoreboard_tie: string[];
  owner_id: string;
  lifecycle_status: string;
  health_status: FunnelHealth;
  last_result_at: string | null;
  linked_idea_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Notification / Attention Model
// ============================================================

// ============================================================
// Personal To-Dos
// ============================================================

export type TodoPriority = "low" | "medium" | "high";
export type TodoVisibility = "private" | "team";

export interface Todo {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: TodoPriority;
  linked_entity_id: string | null;
  linked_entity_type: EntityType | null;
  visibility: TodoVisibility;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Cron Broadcast Engine
// ============================================================

export interface CronJob {
  id: string;
  organization_id: string;
  venture_id: string | null;
  name: string;
  description: string | null;
  schedule: string;
  query_template: string;
  format_template: string | null;
  discord_channel_id: string | null;
  discord_webhook_url: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CronExecution {
  id: string;
  cron_job_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  result: Record<string, unknown> | null;
  error_message: string | null;
  records_processed: number;
}

// ============================================================
// Notification / Attention Model
// ============================================================

// ============================================================
// Process Library (Pillar 10)
// ============================================================

export type AutomationLevel = 0 | 1 | 2 | 3 | 4;

export interface Process {
  id: string;
  organization_id: string;
  venture_id: string;
  name: string;
  description: string | null;
  owner_id: string;
  content: Record<string, unknown>;
  trigger_conditions: string | null;
  linked_kpi_ids: string[];
  linked_bet_ids: string[];
  automation_level: AutomationLevel;
  lifecycle_status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessVersion {
  id: string;
  process_id: string;
  version: number;
  content: Record<string, unknown>;
  name: string;
  description: string | null;
  trigger_conditions: string | null;
  changed_by: string;
  created_at: string;
}

// ============================================================
// Notification / Attention Model
// ============================================================

export type NotificationTier = "immediate" | "urgent" | "daily_digest" | "weekly_digest";

export interface QuietHoursConfig {
  enabled: boolean;
  start_hour: number; // 0-23
  end_hour: number;   // 0-23
  timezone: string;
}

// ============================================================
// KPIs (Pillar 3 — Scoreboard)
// ============================================================

export type KpiTier = "tier1" | "tier2";
export type KpiFrequency = "daily" | "weekly" | "monthly" | "quarterly";
export type KpiDirectionality = "up_is_good" | "down_is_good" | "target_is_good";

export interface Kpi {
  id: string;
  organization_id: string;
  venture_id: string;
  name: string;
  description: string | null;
  unit: string | null;
  frequency: KpiFrequency;
  tier: KpiTier;
  directionality: KpiDirectionality;
  aggregation_window: string | null;
  owner_id: string;
  target: number | null;
  current_value: number | null;
  health_status: HealthStatus;
  lifecycle_status: LifecycleStatus;
  threshold_logic: Record<string, number>;
  action_playbook: Record<string, string>;
  formula_description: string | null;
  template_slug: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export type KpiIconKey = "dollar-sign" | "comment" | "envelope" | "rectangle-ad";

export interface KpiEntry {
  id: string;
  kpi_id: string;
  value: number;
  recorded_at: string;
  source: string;
  created_at: string;
}

// ============================================================
// KPI Integrations (Pillar 3.11)
// ============================================================

export type IntegrationType = "stripe" | "convertkit" | "beehiiv" | "discourse" | "webhook" | "csv";

export interface KpiIntegration {
  id: string;
  kpi_id: string;
  integration_type: IntegrationType;
  config: Record<string, unknown>;
  enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Meeting History (Pillar 5 — Cadence)
// ============================================================

export interface MeetingLog {
  id: string;
  organization_id: string;
  venture_id: string | null;
  meeting_type: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  output: MeetingLogOutput;
  facilitator_id: string | null;
  created_at: string;
}

export interface MeetingLogOutput {
  attendees?: string[];
  resolvedBlockerIds?: string[];
  recordedDecisionIds?: string[];
  newCommitmentIds?: string[];
  reviewedCommitments?: Array<{ id: string; status: string }>;
  resolvedBlockersCount?: number;
  recordedDecisionsCount?: number;
  newCommitmentsCount?: number;
  reviewedCommitmentsCount?: number;
  // Monthly review fields
  kpisReviewed?: number;
  commitmentCompletionRate?: number | null;
  killedBetsCount?: number;
  rootCauseNotes?: string;
  actionItems?: Array<{ description: string; ownerId: string; dueDate?: string }>;
  // Quarterly summit fields
  betGrades?: Array<{ betId: string; grade: string; lessons: string }>;
  selectedIdeas?: Array<{ ideaId: string; title: string }>;
  kpiChanges?: Array<{ kpiId: string; action: string; newTarget?: number }>;
  notDoingListChanges?: { added: string[]; removed: string[] };
}

// ============================================================
// Operating Health (Phase 4 — Behavioral Culture Metrics)
// ============================================================

export interface OperatingHealthMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: "improving" | "declining" | "stable";
  trend_delta: number;
  status: HealthStatus;
  sparkline: number[];
}

export interface OperatingHealthReport {
  venture_id: string;
  organization_id: string;
  computed_at: string;
  composite_score: number;
  composite_status: HealthStatus;
  metrics: {
    decision_velocity: OperatingHealthMetric;
    blocker_half_life: OperatingHealthMetric;
    strategy_connection_rate: OperatingHealthMetric;
    execution_cadence_health: OperatingHealthMetric;
    cross_venture_collaboration: OperatingHealthMetric;
    kill_courage: OperatingHealthMetric;
  };
}

export interface OperatingHealthSnapshot {
  id: string;
  organization_id: string;
  venture_id: string;
  composite_score: number;
  composite_status: HealthStatus;
  metrics: Record<string, OperatingHealthMetric>;
  ai_interpretation: string | null;
  created_at: string;
}

// ============================================================
// AI Narrative Generator (Phase 4)
// ============================================================

export type NarrativeType =
  | "weekly_team_update"
  | "monthly_board_memo"
  | "investor_update"
  | "all_hands_talking_points"
  | "quarterly_retrospective";

export interface GeneratedNarrative {
  id: string;
  organization_id: string;
  venture_id: string | null;
  narrative_type: NarrativeType;
  title: string;
  body_json: Record<string, unknown>;
  body_html: string;
  time_window_start: string;
  time_window_end: string;
  source_entity_ids: string[];
  confidence: "high" | "medium" | "low";
  generated_by: string;
  created_at: string;
}

export interface NarrativeDataSnapshot {
  timeWindow: { start: string; end: string };
  kpis: {
    total: number;
    green: number;
    yellow: number;
    red: number;
    biggestMovers: Array<{ name: string; change_pct: number; direction: "up" | "down" }>;
    statusChanges: Array<{ name: string; from: HealthStatus; to: HealthStatus }>;
  };
  bets: {
    active: number;
    statusChanges: Array<{ outcome: string; change: string }>;
    movesShipped: number;
    movesCut: number;
    newBlockers: number;
  };
  pulses: {
    totalSubmitted: number;
    uniqueContributors: number;
    topShippedItems: string[];
    recurringBlockerThemes: string[];
    signalHighlights: string[];
  };
  decisions: Array<{ title: string; context: string; final_decision: string; decided_at: string }>;
  contentOutput: {
    published: number;
    byMachineType: Record<string, number>;
  };
  commitments: {
    completed: number;
    missed: number;
    newCreated: number;
  };
  operatingHealth: {
    compositeScore: number;
    compositeStatus: HealthStatus;
    metricSummaries: Array<{ label: string; value: number; status: HealthStatus; trend: string }>;
  } | null;
  blockersResolved: Array<{ description: string; resolution_notes: string | null; severity: string }>;
}
