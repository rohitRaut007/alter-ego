import { supabase } from "@/lib/supabase";
import type {
  Goal,
  FirstTask,
  Card,
  SeedPayload,
  SeedResult,
  TradeoffSelectionPayload,
  FallbackPatchPayload,
  CardStep,
} from "@/lib/api-types";
import { mockCardListEveryState, mockCardStepsAllInputTypes, mockSprintWithMilestonesAndFallbacks } from "@/test/fixtures";

// In-memory / session store for API simulation and test boundaries when live DB table is not pre-migrated
interface ApiStore {
  goalsByUser: Map<string, Goal>;
  cardsByUser: Map<string, Card[]>;
  tasksById: Map<string, any>;
  sprintByUser: Map<string, any>;
}

export const apiStore: ApiStore = {
  goalsByUser: new Map(),
  cardsByUser: new Map(),
  tasksById: new Map(),
  sprintByUser: new Map(),
};

// Initialize sprint tasks in store
for (const t of mockSprintWithMilestonesAndFallbacks.tasks) {
  apiStore.tasksById.set(t.id, { ...t });
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, ""); // Normalize trailing slash
  const method = request.method;

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1. POST /api/seed
    if (path === "/api/seed" && method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Partial<SeedPayload> & { today_availability?: string };

      // Validation
      const { situation, target_statement, target_date, weekday_minutes, weekend_minutes, today_minutes } = body;
      if (!situation || !["know_goal", "direction", "change"].includes(situation)) {
        return new Response(
          JSON.stringify({ error: "Invalid or missing situation" }),
          { status: 400, headers: corsHeaders },
        );
      }
      if (!target_statement || typeof target_statement !== "string" || target_statement.trim().length < 3) {
        return new Response(
          JSON.stringify({ error: "Target statement must be at least 3 characters" }),
          { status: 400, headers: corsHeaders },
        );
      }
      if (!target_date || typeof target_date !== "string") {
        return new Response(
          JSON.stringify({ error: "Target date is required" }),
          { status: 400, headers: corsHeaders },
        );
      }

      // 14 to 730 day boundary validation
      const targetDateObj = new Date(target_date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffDays = Math.round((targetDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 14 || diffDays > 730) {
        return new Response(
          JSON.stringify({ error: "Target date must be between 14 and 730 days from today" }),
          { status: 400, headers: corsHeaders },
        );
      }

      if (!weekday_minutes || weekday_minutes <= 0 || !weekend_minutes || weekend_minutes <= 0) {
        return new Response(
          JSON.stringify({ error: "Weekday and weekend minutes must be positive integers" }),
          { status: 400, headers: corsHeaders },
        );
      }

      // Check user auth token if present
      const authHeader = request.headers.get("Authorization");
      let userId = "default-user";
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
          if (user) userId = user.id;
        } catch {
          // ignore auth failure for test/demo mode
        }
      }

      // 409 Conflict check: if user already has an active goal
      if (apiStore.goalsByUser.has(userId)) {
        return new Response(
          JSON.stringify({ error: "Goal already exists for this user", code: "GOAL_CONFLICT" }),
          { status: 409, headers: corsHeaders },
        );
      }

      const createdGoal: Goal = {
        id: `goal-${Date.now()}`,
        user_id: userId,
        title: target_statement.trim(),
        target_date,
        weekday_minutes,
        weekend_minutes,
        today_minutes: today_minutes || 10,
        situation,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const firstTask: FirstTask = {
        id: `task-seed-${Date.now()}`,
        title: `10-minute kick-off: ${body.today_availability || "Right now"} — solidify identity thesis`,
        estimated_minutes: 10,
        layer: "identity",
        priority: true,
        status: "pending",
      };

      const userCards: Card[] = mockCardListEveryState.map((c) => ({ ...c }));

      apiStore.goalsByUser.set(userId, createdGoal);
      apiStore.cardsByUser.set(userId, userCards);
      apiStore.tasksById.set(firstTask.id, { ...firstTask, week_number: 1, fallback_plan: "Review statement for 5 min" });

      const seedResult: SeedResult = {
        goal: createdGoal,
        first_task: firstTask,
        cards: userCards,
      };

      return new Response(JSON.stringify(seedResult), { status: 201, headers: corsHeaders });
    }

    // 2. GET /api/cards
    if (path === "/api/cards" && method === "GET") {
      const cards = mockCardListEveryState.map((c) => ({ ...c }));
      return new Response(JSON.stringify(cards), { status: 200, headers: corsHeaders });
    }

    // 3. GET /api/cards/:card_id/steps/:step_number
    const stepMatch = path.match(/^\/api\/cards\/([^/]+)\/steps\/(\d+)$/);
    if (stepMatch && method === "GET") {
      const [, cardId, stepNumStr] = stepMatch;
      const stepNumber = parseInt(stepNumStr || "1", 10);
      const stepTypes: Array<"text" | "chips" | "multi_chips" | "options"> = ["text", "chips", "multi_chips", "options"];
      const chosenType = stepTypes[(stepNumber - 1) % stepTypes.length] ?? "text";
      const baseStep = mockCardStepsAllInputTypes[chosenType]!;

      const stepData: CardStep = {
        ...baseStep,
        id: `step-${cardId}-${stepNumber}`,
        card_id: cardId || "card",
        step_number: stepNumber,
        total_steps: 4,
      };

      return new Response(JSON.stringify(stepData), { status: 200, headers: corsHeaders });
    }

    // 4. POST /api/cards/:card_id/steps/:step_number/answer
    const answerMatch = path.match(/^\/api\/cards\/([^/]+)\/steps\/(\d+)\/answer$/);
    if (answerMatch && method === "POST") {
      const [, , stepNumStr] = answerMatch;
      const stepNumber = parseInt(stepNumStr || "1", 10);
      const body = await request.json().catch(() => ({}));
      const answer = body.answer;

      // Safety boundary keywords check
      const answerStr = Array.isArray(answer) ? answer.join(" ") : String(answer || "");
      const lower = answerStr.toLowerCase();
      const safetyKeywords = ["burnout", "hopeless", "can't go on", "harm", "giving up", "collapse"];
      const flagged = safetyKeywords.some((kw) => lower.includes(kw));

      let safety_notice: string | undefined;
      if (flagged) {
        safety_notice = "Pacing matters. Alter Ego OS emphasizes sustainable progression and healthy boundaries.";
      }

      const isFinal = stepNumber >= 4;
      return new Response(
        JSON.stringify({
          accepted: true,
          safety_notice,
          next_step: isFinal ? null : stepNumber + 1,
          completed: isFinal,
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    // 5. POST /api/cards/:card_id/tradeoffs
    const tradeoffMatch = path.match(/^\/api\/cards\/([^/]+)\/tradeoffs$/);
    if (tradeoffMatch && method === "POST") {
      const body = (await request.json().catch(() => ({}))) as TradeoffSelectionPayload;
      const choices = body.choices;

      if (!choices || !Array.isArray(choices) || choices.length === 0) {
        return new Response(
          JSON.stringify({ error: "Choices array is required" }),
          { status: 400, headers: corsHeaders },
        );
      }

      const choice = choices[0];
      if (!["move_date", "add_time", "narrow_scope"].includes(choice || "")) {
        return new Response(
          JSON.stringify({ error: `Invalid tradeoff choice: ${choice}` }),
          { status: 400, headers: corsHeaders },
        );
      }

      return new Response(
        JSON.stringify({
          applied_choice: choice,
          updated_target_date: "2027-04-28",
          new_status: "feasible",
          effort_hours: choice === "add_time" ? 210 : 180,
          weekly_hours: choice === "add_time" ? 15 : 12,
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    // 6. PATCH /api/tasks/:task_id/fallback
    const fallbackMatch = path.match(/^\/api\/tasks\/([^/]+)\/fallback$/);
    if (fallbackMatch && method === "PATCH") {
      const [, taskId] = fallbackMatch;
      const body = (await request.json().catch(() => ({}))) as FallbackPatchPayload;

      if (typeof body.did_15_min_version !== "boolean") {
        return new Response(
          JSON.stringify({ error: "did_15_min_version must be boolean" }),
          { status: 400, headers: corsHeaders },
        );
      }

      const existing = apiStore.tasksById.get(taskId || "") || {
        id: taskId,
        title: "Sprint Action Task",
        week_number: 1,
        fallback_plan: "15 min version",
        did_15_min_version: false,
        status: "pending",
      };

      existing.did_15_min_version = body.did_15_min_version;
      apiStore.tasksById.set(taskId || "", existing);

      return new Response(JSON.stringify(existing), { status: 200, headers: corsHeaders });
    }

    // 7. POST /api/sprint/rebuild
    if (path === "/api/sprint/rebuild" && method === "POST") {
      return new Response(
        JSON.stringify({
          sprint_id: "sprint-2026-q4",
          needs_review: false,
          generated_tasks_count: 4,
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: corsHeaders });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      { status: 500, headers: corsHeaders },
    );
  }
}

