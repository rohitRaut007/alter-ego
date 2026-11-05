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
  today_availability?: string;
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

export class ApiError extends Error {
  status: number;
  code?: string | undefined;

  constructor(message: string, status: number, code?: string | undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Concrete API Client communicating with backend REST endpoints
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(data.error || response.statusText, response.status, data.code);
    }

    return data as T;
  }

  async seedGoal(payload: SeedPayload): Promise<SeedResult> {
    return this.request<SeedResult>("/api/seed/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getCards(): Promise<Card[]> {
    return this.request<Card[]>("/api/cards/", {
      method: "GET",
    });
  }

  async getCardStep(cardId: string, stepNumber: number): Promise<CardStep> {
    return this.request<CardStep>(`/api/cards/${cardId}/steps/${stepNumber}/`, {
      method: "GET",
    });
  }

  async submitCardAnswer(
    cardId: string,
    stepNumber: number,
    answer: string | string[],
  ): Promise<{ accepted: boolean; safety_notice?: string; next_step?: number | null; completed?: boolean }> {
    return this.request<{ accepted: boolean; safety_notice?: string; next_step?: number | null; completed?: boolean }>(
      `/api/cards/${cardId}/steps/${stepNumber}/answer/`,
      {
        method: "POST",
        body: JSON.stringify({ answer }),
      },
    );
  }

  async submitTradeoffs(cardId: string, choices: string[]): Promise<any> {
    return this.request<any>(`/api/cards/${cardId}/tradeoffs/`, {
      method: "POST",
      body: JSON.stringify({ choices }),
    });
  }

  async patchTaskFallback(taskId: string, did15Min: boolean): Promise<FallbackTask> {
    return this.request<FallbackTask>(`/api/tasks/${taskId}/fallback/`, {
      method: "PATCH",
      body: JSON.stringify({ did_15_min_version: did15Min }),
    });
  }

  async rebuildSprint(): Promise<{ sprint_id: string; needs_review: boolean; generated_tasks_count: number }> {
    return this.request<{ sprint_id: string; needs_review: boolean; generated_tasks_count: number }>(
      "/api/sprint/rebuild/",
      {
        method: "POST",
      },
    );
  }
}

export const apiClient = new ApiClient();
