import type {
  Card,
  CardStep,
  Goal,
  SeedResult,
  SprintPlan,
  UserMe,
  FallbackTask,
  MilestonePlan,
  FeasibilityVerdict,
} from "../../../../packages/api-client/src/index";

/**
 * Fixture: User ME with has_goal
 */
export const mockUserMeWithGoal: UserMe = {
  id: "user-123",
  email: "architect@alterego.internal",
  has_goal: true,
  created_at: "2026-09-01T08:00:00Z",
};

export const mockUserMeWithoutGoal: UserMe = {
  id: "user-456",
  email: "newcomer@alterego.internal",
  has_goal: false,
  created_at: "2026-10-01T12:00:00Z",
};

/**
 * Fixture: Valid Seed Result
 */
export const mockValidGoal: Goal = {
  id: "goal-001",
  user_id: "user-123",
  title: "By 2027-01-01, I want to be someone who builds resilient autonomous software systems.",
  target_date: "2027-01-01",
  weekday_minutes: 60,
  weekend_minutes: 120,
  today_minutes: 15,
  situation: "know_goal",
  created_at: "2026-10-29T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
};

export const mockValidSeedResult: SeedResult = {
  goal: mockValidGoal,
  first_task: {
    id: "task-001",
    title: "10-minute sprint kick-off: outline identity statement",
    estimated_minutes: 10,
    layer: "identity",
    priority: true,
    status: "pending",
  },
  cards: [
    {
      id: "card-goal",
      slug: "goal",
      title: "Goal Card",
      description: "Define the core transformation and time horizon",
      state: "active",
      question_count: 3,
      estimated_minutes: 5,
      current_step: 1,
      total_steps: 3,
      completed: false,
    },
    {
      id: "card-reality",
      slug: "reality",
      title: "Reality Card",
      description: "Audit true baseline capacity and current blockers",
      state: "needs_input",
      question_count: 4,
      estimated_minutes: 8,
      current_step: 0,
      total_steps: 4,
      completed: false,
    },
  ],
};

/**
 * Fixture: Card List covering EVERY card state
 * - locked
 * - needs_input
 * - calibrating
 * - active
 * - needs_review
 */
export const mockCardListEveryState: Card[] = [
  {
    id: "card-1-locked",
    slug: "identity-depth",
    title: "Deep Identity Architecture",
    description: "Multi-layered persona mapping and archetypes",
    state: "locked",
    unlock_reason: "Opens on day 3",
    question_count: 5,
    estimated_minutes: 10,
    completed: false,
  },
  {
    id: "card-2-needs-input",
    slug: "reality-audit",
    title: "Reality Audit",
    description: "Measure non-negotiable weekly friction patterns",
    state: "needs_input",
    question_count: 3,
    estimated_minutes: 5,
    current_step: 1,
    total_steps: 3,
    completed: false,
  },
  {
    id: "card-3-calibrating",
    slug: "calibration-engine",
    title: "Feasibility Calibration",
    description: "Aligning scope, hours, and date against algorithmic capacity",
    state: "calibrating",
    question_count: 0,
    estimated_minutes: 2,
    completed: false,
    verdict: {
      status: "stretch",
      effort_hours: 180,
      weekly_hours: 12,
      coverage_pct: 75,
      verdict_text: "High ambition target. May require timeline shift or daily load adjustment.",
      tradeoff_options: [
        {
          id: "move_date",
          label: "Move the date out by 4 weeks",
          available: true,
          impact_summary: "+28 days timeline relief",
        },
        {
          id: "add_time",
          label: "Add 3 hours/week of deep work",
          available: true,
          impact_summary: "+36 total project hours",
        },
        {
          id: "narrow_scope",
          label: "Narrow the scope to core MVP",
          available: false,
          reason_disabled: "Scope is already minimized to core protocol modules.",
        },
      ],
    },
  },
  {
    id: "card-4-active",
    slug: "daily-os-habits",
    title: "Daily OS Practices",
    description: "Non-negotiable morning blocks and evening reflection loop",
    state: "active",
    question_count: 4,
    estimated_minutes: 6,
    current_step: 3,
    total_steps: 4,
    completed: false,
  },
  {
    id: "card-5-needs-review",
    slug: "sprint-retrospective",
    title: "Two-Week Sprint Review",
    description: "Evaluate task completion rates and adjust upcoming velocity",
    state: "needs_review",
    question_count: 2,
    estimated_minutes: 4,
    completed: true,
  },
];

/**
 * Fixture: Card Steps covering EACH supported input type:
 * - text
 * - chips
 * - multi_chips
 * - options
 */
export const mockCardStepsAllInputTypes: Record<string, CardStep> = {
  text: {
    id: "step-text-01",
    card_id: "card-goal",
    step_number: 1,
    total_steps: 4,
    question: "What is the single most critical breakthrough you need to achieve?",
    type: "text",
    placeholder: "Describe the breakthrough in 1-2 sentences...",
    acknowledgement: "Noted. Clear articulation is the first step toward execution.",
    safety_boundary: {
      flagged_keywords: ["burnout", "give up", "hopeless", "can't take this"],
      notice: "Pacing matters. Alter Ego OS emphasizes sustainable progression over destructive overwork.",
    },
  },
  chips: {
    id: "step-chips-02",
    card_id: "card-reality",
    step_number: 2,
    total_steps: 4,
    question: "Which primary friction pattern most often disrupts your deep work?",
    type: "chips",
    options: ["Notification leakage", "Energy crashes", "Unclear priorities", "Perfectionist paralysis"],
    acknowledgement: "Recognizing your friction vector allows us to construct defensive habits around it.",
  },
  multi_chips: {
    id: "step-multi-chips-03",
    card_id: "card-identity",
    step_number: 3,
    total_steps: 4,
    question: "Select the character traits your alter ego embodies under pressure:",
    type: "multi_chips",
    options: ["Unshakable Focus", "Direct Candor", "Sovereign Calm", "Rapid Prototyping", "Relentless Follow-Through"],
    acknowledgement: "Traits selected. These will form the foundation of your daily practice prompts.",
  },
  options: {
    id: "step-options-04",
    card_id: "card-habits",
    step_number: 4,
    total_steps: 4,
    question: "What time of day is your non-negotiable 90-minute deep work block?",
    type: "options",
    options: ["Early Morning (6:00 - 8:30 AM)", "Late Morning (9:30 AM - 12:00 PM)", "Evening (7:00 - 9:30 PM)"],
    acknowledgement: "Scheduled. Your daily brief will prioritize this sacred block.",
  },
};

/**
 * Fixture: Sprint with milestones and fallback plans
 */
export const mockSprintWithMilestonesAndFallbacks: SprintPlan = {
  id: "sprint-2026-q4",
  start_date: "2026-10-01",
  target_date: "2026-12-31",
  needs_review: false,
  milestones: [
    {
      id: "m-01",
      title: "Core Protocol Architecture Locked",
      target_date: "2026-10-14",
      status: "completed",
      horizon: "2_weeks",
    },
    {
      id: "m-02",
      title: "First 10 Working Prototypes Shipped",
      target_date: "2026-10-31",
      status: "in_progress",
      horizon: "1_month",
    },
    {
      id: "m-03",
      title: "Full 90-Day Sprint Transformation Verified",
      target_date: "2026-12-31",
      status: "pending",
      horizon: "90_days",
    },
  ],
  tasks: [
    {
      id: "t-001",
      title: "Draft identity manifesto and 3 core anti-patterns",
      milestone_id: "m-01",
      milestone_title: "Core Protocol Architecture Locked",
      fallback_plan: "If feeling scattered, write just 3 bullet points defining who you are NOT.",
      did_15_min_version: false,
      estimated_minutes: 45,
      week_number: 1,
      status: "completed",
    },
    {
      id: "t-002",
      title: "Execute 90-minute architecture review for prototype alpha",
      milestone_id: "m-02",
      milestone_title: "First 10 Working Prototypes Shipped",
      fallback_plan: "If short on time, do the 15-minute skeleton review of the top 3 modules.",
      did_15_min_version: false,
      estimated_minutes: 90,
      week_number: 1,
      status: "pending",
    },
    {
      id: "t-003",
      title: "Conduct customer feedback audit on initial feature batch",
      milestone_id: "m-02",
      milestone_title: "First 10 Working Prototypes Shipped",
      fallback_plan: "If interviews stall, read through 5 survey logs and write top 2 insights.",
      did_15_min_version: true,
      estimated_minutes: 60,
      week_number: 2,
      status: "pending",
    },
  ],
  later_weeks: [
    {
      week_number: 3,
      theme: "Velocity Acceleration",
      expected_outcome: "Double daily throughput with protected morning blocks.",
    },
    {
      week_number: 4,
      theme: "Resilience & Friction Defense",
      expected_outcome: "Eliminate secondary leaks and conduct milestone 2 signoff.",
    },
  ],
};

import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { LanguageProvider } from "@/lib/i18n";
import { AppStateProvider } from "@/lib/app-state";

export interface RenderResult {
  container: HTMLDivElement;
  unmount: () => void;
  html: () => string;
}

export async function renderWithProviders(element: React.ReactElement): Promise<RenderResult> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      <LanguageProvider>
        <AppStateProvider>{element}</AppStateProvider>
      </LanguageProvider>
    );
  });

  return {
    container,
    unmount: () => {
      if (root) {
        act(() => {
          root?.unmount();
        });
      }
      container.remove();
    },
    html: () => container.innerHTML,
  };
}

export function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}



