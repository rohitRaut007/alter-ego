/**
 * API Types and Contract Aliases for Alter Ego OS
 *
 * In accordance with J2 and frozen contract definitions:
 * - Cards
 * - Card steps
 * - Seed results
 * - Goals
 * - Feasibility & Tradeoffs
 * - Sprint & Fallback tasks
 */

export type CardState =
  | "locked"
  | "needs_input"
  | "calibrating"
  | "active"
  | "needs_review";

export type CardStepInputType = "text" | "chips" | "multi_chips" | "options";

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  target_date: string;
  weekday_minutes: number;
  weekend_minutes: number;
  today_minutes: number;
  situation: "know_goal" | "direction" | "change" | string;
  created_at: string;
  updated_at: string;
}

export interface FirstTask {
  id: string;
  title: string;
  estimated_minutes: number;
  layer: string;
  priority: boolean;
  status: "pending" | "completed";
}

export interface CardStep {
  id: string;
  card_id: string;
  step_number: number;
  total_steps: number;
  question: string;
  type: CardStepInputType;
  options?: string[];
  placeholder?: string;
  optional?: boolean;
  acknowledgement?: string;
  safety_boundary?: {
    flagged_keywords?: string[];
    notice?: string;
  };
}

export interface TradeoffOption {
  id: "move_date" | "add_time" | "narrow_scope" | string;
  label: string;
  available: boolean;
  reason_disabled?: string;
  impact_summary?: string;
}

export interface FeasibilityVerdict {
  status: "feasible" | "stretch" | "unfeasible" | string;
  effort_hours: number;
  weekly_hours: number;
  coverage_pct: number;
  verdict_text: string;
  tradeoff_options: TradeoffOption[];
}

export interface Card {
  id: string;
  slug: string;
  title: string;
  description?: string;
  state: CardState;
  question_count?: number;
  estimated_minutes?: number;
  unlock_reason?: string;
  current_step?: number;
  total_steps?: number;
  completed?: boolean;
  verdict?: FeasibilityVerdict;
}

export interface SeedPayload {
  situation: "know_goal" | "direction" | "change" | string;
  target_statement: string;
  target_date: string;
  weekday_minutes: number;
  weekend_minutes: number;
  today_minutes: number;
}

export interface SeedResult {
  goal: Goal;
  first_task: FirstTask;
  cards: Card[];
}

export interface FallbackTask {
  id: string;
  title: string;
  milestone_id?: string;
  milestone_title?: string;
  fallback_plan: string;
  did_15_min_version: boolean;
  estimated_minutes: number;
  week_number: number;
  status: "pending" | "completed";
  due_date?: string;
}

export interface MilestonePlan {
  id: string;
  title: string;
  target_date: string;
  status: "pending" | "in_progress" | "completed";
  horizon?: string;
}

export interface LaterWeekSummary {
  week_number: number;
  theme: string;
  expected_outcome: string;
}

export interface SprintPlan {
  id: string;
  start_date: string;
  target_date: string;
  needs_review: boolean;
  milestones: MilestonePlan[];
  tasks: FallbackTask[];
  later_weeks?: LaterWeekSummary[];
}

export interface UserMe {
  id: string;
  email: string;
  has_goal: boolean;
  created_at: string;
}

export interface FallbackPatchPayload {
  did_15_min_version: boolean;
}

export interface TradeoffSelectionPayload {
  choices: string[];
}

