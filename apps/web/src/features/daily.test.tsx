import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/lib/auth";

import { CharacterPage } from "./character/CharacterPage";
import { ReflectionPage } from "./reflection/ReflectionPage";
import { RitualPage } from "./ritual/RitualPage";
import { TodayPage } from "./today/TodayPage";

type Handler = (req: Request) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubApi(routes: Record<string, Handler>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      const key = `${req.method} ${new URL(req.url).pathname}`;
      calls.push(key);
      const handler = routes[key];
      if (!handler) throw new Error(`Unexpected request: ${key}`);
      return handler(req);
    }),
  );
  return calls;
}

function renderPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route path="/today" element={<TodayPage />} />
            <Route path="/reflection" element={<ReflectionPage />} />
            <Route path="/character" element={<CharacterPage />} />
            <Route path="/ritual" element={<RitualPage />} />
            <Route path="/onboarding" element={<p>interview</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const TASK_ID = "33333333-3333-3333-3333-333333333333";
const PRACTICE_ID = "44444444-4444-4444-4444-444444444444";
const TRAIT_ID = "55555555-5555-5555-5555-555555555555";

const task = (over: Record<string, unknown> = {}) => ({
  id: TASK_ID,
  source: "sprint90",
  layer: "knowledge",
  title: "Week 2: reading",
  detail: "Continue the list.",
  minutes: 45,
  priority: true,
  due_day: 12,
  due_date: "2026-10-26",
  week_index: 2,
  trait_id: null,
  done: false,
  done_at: null,
  ...over,
});

const practice = (over: Record<string, unknown> = {}) => ({
  id: PRACTICE_ID,
  trait_id: TRAIT_ID,
  trait_name: "Follow-through",
  description: "Write tomorrow's single must-finish task.",
  cadence: "daily",
  minutes: 10,
  streak: 3,
  best_streak: 5,
  done_today: false,
  done_this_week: false,
  due_today: true,
  history: Array.from({ length: 14 }, (_, i) => i > 10),
  ...over,
});

const brief = (over: Record<string, unknown> = {}) => ({
  date: "2026-10-27",
  day_number: 14,
  total_days: 90,
  sprint_over: false,
  sprint_goal: "Move toward 50 paying customers.",
  tone: "balanced",
  headline: "Day 14: keep the cadence.",
  body: "Work the priorities in order.",
  insight: "You have completed 2 of 3 Week 2 tasks. The 1 overdue is all in Knowledge.",
  week: { week: 2, total: 3, done: 2, overdue: 1, overdue_by_layer: { knowledge: 1 } },
  focus: [task()],
  due_tasks: [task()],
  completed_today: [],
  checklist: { total: 12, done: 5, overdue: 1 },
  practices: [practice()],
  practice_streak: 3,
  best_practice_streak: 5,
  schedule: [{ start: "06:30", end: "08:30", label: "Deep work", layer: "mission", kind: "deep_work" }],
  deep_work_target_minutes: 120,
  deep_work_minutes_today: 25,
  reflection_done: false,
  ritual: { available: false, week_start: null, completed: false, due: false },
  alter_ego_name: "The Operator",
  identity_statement: "I do the work in front of me.",
  ...over,
});

const noSession = () => json({ detail: "none" }, 404);

describe("today", () => {
  it("shows the brief, names what slipped, and completes a task", async () => {
    let patched: unknown;
    const calls = stubApi({
      "GET /api/v1/daily/brief": () => json(brief()),
      "GET /api/v1/deep-work/sessions/active": noSession,
      [`PATCH /api/v1/tasks/${TASK_ID}`]: async (req) => {
        patched = await req.json();
        return json(task({ done: true }));
      },
    });
    renderPage("/today");

    expect(await screen.findByText("Day 14: keep the cadence.")).toBeTruthy();
    expect(screen.getByText(/The 1 overdue is all in Knowledge/)).toBeTruthy();
    expect(screen.getByText("Day 14 of 90")).toBeTruthy();
    expect(screen.getByText("25 of 120 minutes logged today.")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /Week 2: reading/ }));
    await waitFor(() => expect(patched).toEqual({ done: true }));
    await waitFor(() =>
      expect(calls.filter((c) => c === "GET /api/v1/daily/brief").length).toBeGreaterThan(1),
    );
  });

  it("logs a practice", async () => {
    let body: unknown;
    stubApi({
      "GET /api/v1/daily/brief": () => json(brief()),
      "GET /api/v1/deep-work/sessions/active": noSession,
      [`POST /api/v1/practices/${PRACTICE_ID}/logs`]: async (req) => {
        body = await req.json();
        return json({ practice_id: PRACTICE_ID, date: "2026-10-27", done: true });
      },
    });
    renderPage("/today");
    fireEvent.click(await screen.findByRole("checkbox", { name: /must-finish task/ }));
    await waitFor(() => expect(body).toEqual({ done: true }));
  });

  it("offers the weekly ritual when it is due and starts a deep work block", async () => {
    let started: unknown;
    stubApi({
      "GET /api/v1/daily/brief": () =>
        json(brief({ ritual: { available: true, week_start: "2026-10-26", completed: false, due: true } })),
      "GET /api/v1/deep-work/sessions/active": noSession,
      "POST /api/v1/deep-work/sessions": async (req) => {
        started = await req.json();
        return json({ id: "6", task_id: null, planned_minutes: 50, started_at: new Date().toISOString(),
                      ended_at: null, abandoned: false, actual_minutes: 0 }, 201);
      },
    });
    renderPage("/today");
    expect(await screen.findByText("Weekly output ritual")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "50 min" }));
    fireEvent.click(screen.getByRole("button", { name: /Start block/ }));
    await waitFor(() => expect(started).toEqual({ planned_minutes: 50 }));
  });

  it("points a user without a protocol to the interview", async () => {
    stubApi({ "GET /api/v1/daily/brief": () => json({ detail: "none" }, 404) });
    renderPage("/today");
    expect(await screen.findByText("Your day starts with a protocol")).toBeTruthy();
  });
});

const safetyNotice = {
  paused: true,
  category: "crisis",
  message: "What you wrote sounds like you may be going through something very painful.",
  resources: [
    { id: "in_tele_manas", name: "Tele-MANAS (Government of India)", contact: "14416",
      kind: "phone", note: "Free, 24x7." },
  ],
};

const prompts = [
  { key: "compounded", question: "What compounded today?" },
  { key: "leaked", question: "What leaked?" },
  { key: "tomorrow", question: "What is tomorrow's first action?" },
];

describe("reflection", () => {
  it("saves a reflection", async () => {
    let body: { answers: Record<string, string> } | undefined;
    stubApi({
      "GET /api/v1/reflections": () => json({ reflection: null, prompts, safety: null }),
      "POST /api/v1/reflections": async (req) => {
        body = (await req.json()) as { answers: Record<string, string> };
        return json({
          reflection: { date: "2026-10-27", answers: body.answers, rating: null, updated_at: "x" },
          prompts,
          safety: null,
        });
      },
      "GET /api/v1/daily/brief": () => json(brief()),
    });
    renderPage("/reflection");
    fireEvent.change(await screen.findByLabelText("What compounded today?"), {
      target: { value: "Shipped the fix." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/Saved/);
    expect(body?.answers.compounded).toBe("Shipped the fix.");
  });

  it("shows support resources instead of a saved state when the boundary triggers", async () => {
    stubApi({
      "GET /api/v1/reflections": () => json({ reflection: null, prompts, safety: null }),
      "POST /api/v1/reflections": () => json({ reflection: null, prompts, safety: safetyNotice }),
    });
    renderPage("/reflection");
    fireEvent.change(await screen.findByLabelText("What compounded today?"), {
      target: { value: "Nothing." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));

    const alert = await screen.findByRole("alert", { name: "Support" });
    expect(alert.textContent).toMatch(/Tele-MANAS/);
    expect(screen.getByText(/not saved or used for coaching/)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

const trait = (over: Record<string, unknown> = {}) => ({
  id: TRAIT_ID,
  name: "Follow-through",
  statement: "I finish what I commit to this week.",
  rationale: "You said you start projects and abandon them.",
  failure_mode: "Starting new work to avoid finishing old work.",
  reflection_prompt: "Where did I stop early this month?",
  practices: [practice()],
  streak: 3,
  ratings: [],
  rating_due_offset: 0,
  reflection_done_this_month: false,
  ...over,
});

describe("character", () => {
  it("shows traits, streaks and records the starting self-rating", async () => {
    let body: unknown;
    stubApi({
      "GET /api/v1/traits": () => json([trait()]),
      [`POST /api/v1/traits/${TRAIT_ID}/ratings`]: async (req) => {
        body = await req.json();
        return json({ rating: { day_offset: 0, score: 2 }, safety: null });
      },
    });
    renderPage("/character");
    expect(await screen.findByText("Follow-through")).toBeTruthy();
    expect(screen.getAllByText(/I finish what I commit to this week/).length).toBeGreaterThan(0);
    expect(screen.getByText("Where are you starting?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "2 · Sometimes" }));
    await waitFor(() => expect(body).toEqual({ day_offset: 0, score: 2 }));
  });

  it("shows support resources when a monthly reflection trips the boundary", async () => {
    stubApi({
      "GET /api/v1/traits": () => json([trait({ rating_due_offset: null })]),
      [`POST /api/v1/traits/${TRAIT_ID}/reflections`]: () =>
        json({ saved: false, safety: safetyNotice }),
    });
    renderPage("/character");
    fireEvent.change(await screen.findByLabelText("Where did I stop early this month?"), {
      target: { value: "text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    expect((await screen.findByRole("alert", { name: "Support" })).textContent).toMatch(/14416/);
  });
});

describe("ritual", () => {
  it("explains when the ritual is not open yet", async () => {
    stubApi({
      "GET /api/v1/weekly-ritual": () =>
        json({
          state: { available: false, week_start: null, completed: false, due: false },
          stats: null,
          prompts: [],
          answers: null,
          safety: null,
        }),
    });
    renderPage("/ritual");
    expect(await screen.findByText(/opens on Sunday at 5pm/)).toBeTruthy();
  });
});
