import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { App } from "@/App";
import { AuthProvider } from "@/lib/auth";
import { LanguageProvider } from "@/lib/i18n";

export type Handler = (req: Request) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** An SSE response made of the given raw event blocks. */
export function sse(blocks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const b of blocks) controller.enqueue(enc.encode(b));
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

export const ME = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "ada@example.com",
  display_name: "Ada Lovelace",
  timezone: "UTC",
  locale: "en",
  ai_training_opt_out: true,
  mentor_nudges: true,
  weekly_digest: true,
  created_at: "2026-10-01T00:00:00Z",
  tier: "full",
  entitlements: ["protocol", "daily_os", "character", "knowledge", "mentor", "presence", "legacy", "calendar"],
  analytics_opt_in: true,
  alter_ego_name: "The Operator",
  identity_statement: "I do the work in front of me.",
};

const DEFAULTS: Record<string, Handler> = {
  "POST /api/v1/auth/token/refresh": () => json({ access: "access-token", refresh: "refresh-2" }),
  "GET /api/v1/me": () => json(ME),
};

/** Route fetch calls by "METHOD /path". Unlisted requests fail loudly. */
export function stubApi(routes: Record<string, Handler> = {}) {
  const calls: string[] = [];
  const bodies: Record<string, unknown[]> = {};
  const table = { ...DEFAULTS, ...routes };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      const key = `${req.method} ${new URL(req.url).pathname}`;
      calls.push(key);
      const handler = table[key];
      if (!handler) throw new Error(`Unexpected request: ${key}`);
      if (req.method !== "GET") {
        try {
          (bodies[key] ??= []).push(await req.clone().json());
        } catch {
          /* no body */
        }
      }
      return handler(req);
    }),
  );
  return { calls, bodies };
}

/** Render the whole app at a path, signed in (session restored via the refresh token). */
export function renderApp(path: string, opts: { signedIn?: boolean } = {}) {
  const { signedIn = true } = opts;
  sessionStorage.clear();
  if (signedIn) sessionStorage.setItem("ae.refresh", "refresh-1");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

export const PROTOCOL_ID = "22222222-2222-2222-2222-222222222222";
export const INTERVIEW_ID = "11111111-1111-1111-1111-111111111111";
export const TASK_ID = "33333333-3333-3333-3333-333333333333";
export const PRACTICE_ID = "44444444-4444-4444-4444-444444444444";
export const TRAIT_ID = "55555555-5555-5555-5555-555555555555";

export const task = (over: Record<string, unknown> = {}) => ({
  id: TASK_ID,
  source: "sprint90",
  layer: "knowledge",
  block: "deep_work",
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

export const practice = (over: Record<string, unknown> = {}) => ({
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

export const brief = (over: Record<string, unknown> = {}) => ({
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

export const safetyNotice = {
  paused: true,
  category: "crisis",
  message: "What you wrote sounds like you may be going through something very painful.",
  resources: [
    { id: "in_tele_manas", name: "Tele-MANAS (Government of India)", contact: "14416", kind: "phone", note: "Free, 24x7." },
  ],
};
