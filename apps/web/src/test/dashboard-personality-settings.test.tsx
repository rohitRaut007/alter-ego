import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { render } from "@testing-library/react";

import { ME, json, renderApp, stubApi, task } from "./utils";

const layers = ["identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy"].map(
  (id, i) => ({ id, index: i + 1, name: `Layer ${i + 1}`, status: i === 0 ? "locked_in" : "active", progress: i === 0 ? 100 : 30 }),
);

const dashboard = (over: Record<string, unknown> = {}) => ({
  day_number: 14, total_days: 90, sprint_percent: 16, sprint_goal: "Move toward 50 paying customers.",
  alter_ego_name: "The Operator", identity_statement: "I do the work in front of me.",
  tone: "balanced", headline: "Day 14: keep the cadence.", body: "Work the priorities in order.",
  insight: "You have completed 2 of 3 Week 2 tasks. The 1 overdue is all in Knowledge.",
  priority_task: task(), unread_nudges: 2, ritual_due: false, personality_completed: false,
  key_results: [
    { id: "tasks", label: "Tasks completed", value: 5, target: 48, suffix: "" },
    { id: "practices", label: "Practices done today", value: 1, target: 4, suffix: "" },
    { id: "reading", label: "Reading progress", value: 12, target: 100, suffix: "%" },
  ],
  weekly_momentum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
    day, date: `2026-10-${21 + i}`, deep_work_hours: i / 2, practices: i % 3,
  })),
  stats: { tasks_done_today: 1, tasks_due_today: 3, practices_done: 1, practices_total: 4, longest_streak: 5, reading_progress: 12 },
  layers,
  ...over,
});

describe("dashboard", () => {
  it("shows the priority, brief, sprint, key results, stats and the seven layers", async () => {
    const { bodies } = stubApi({
      "GET /api/v1/dashboard": () => json(dashboard()),
      [`PATCH /api/v1/tasks/${task().id}`]: () => json(task({ done: true })),
    });
    renderApp("/dashboard");
    expect(await screen.findByText(/Good (morning|afternoon|evening), Ada\./)).toBeTruthy();
    expect(screen.getByText("Week 2: reading")).toBeTruthy();
    expect(screen.getByText(/The 1 overdue is all in Knowledge/)).toBeTruthy();
    expect(screen.getByText("Tasks completed")).toBeTruthy();
    expect(screen.getAllByText("Reading progress").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/% built/).length).toBe(7);
    expect(screen.getByText("Calibrate your mentor with the Big Five assessment")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy(); // unread mentor messages

    fireEvent.click(screen.getByRole("button", { name: /Mark complete/ }));
    await waitFor(() => expect(bodies[`PATCH /api/v1/tasks/${task().id}`]).toEqual([{ done: true }]));
  });

  it("invites a new user to the interview when there is no protocol", async () => {
    stubApi({ "GET /api/v1/dashboard": () => json({ detail: "none" }, 404) });
    renderApp("/dashboard");
    expect(await screen.findByText("Begin the interview")).toBeTruthy();
  });

  it("shows a retry state when the dashboard fails to load", async () => {
    stubApi({ "GET /api/v1/dashboard": () => json({ detail: "boom" }, 500) });
    renderApp("/dashboard");
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not load/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

const questions = Array.from({ length: 3 }, (_, i) => ({
  id: `p${i + 1}`, text: `Statement number ${i + 1}.`, trait: i === 0 ? "openness" : "stability",
}));
const traits = ["openness", "conscientiousness", "extraversion", "agreeableness", "stability"].map((t) => ({
  trait: t, name: t[0]!.toUpperCase() + t.slice(1), high: `${t} high text`, low: `${t} low text`,
}));

describe("personality assessment", () => {
  it("walks through the questions and shows results", async () => {
    const { bodies } = stubApi({
      "GET /api/v1/personality/questions": () => json({ questions, traits }),
      "POST /api/v1/personality": () => json({
        scores: { openness: 100, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 75 },
        completed_at: "2026-10-27T10:00:00Z", answered: 3,
      }),
    });
    renderApp("/personality");
    expect(await screen.findByText("Statement number 1.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Strongly agree" }));
    // Auto-advances; answer the rest via the navigation chips.
    fireEvent.click(await screen.findByRole("button", { name: "Question 2" }));
    fireEvent.click(screen.getByRole("radio", { name: "Agree" }));
    fireEvent.click(screen.getByRole("button", { name: "Question 3" }));
    fireEvent.click(screen.getByRole("radio", { name: "Neutral" }));
    fireEvent.click(screen.getByRole("button", { name: /View results/ }));

    expect(await screen.findByText("Assessment complete.")).toBeTruthy();
    expect(bodies["POST /api/v1/personality"]![0]).toEqual({ answers: { p1: 5, p2: 4, p3: 3 } });
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText(/self-reported tendencies, not a diagnosis/)).toBeTruthy();
  });
});

describe("settings", () => {
  const settingsRoutes = (extra: Record<string, () => Response | Promise<Response>> = {}) =>
    stubApi({
      "GET /api/v1/dashboard": () => json(dashboard()),
      "GET /api/v1/personality": () => json({ detail: "none" }, 404),
      "GET /api/v1/calendar": () => json({ connected: false, link: null, demo_notice: null }),
      ...extra,
    });

  it("shows profile, privacy toggles, plan and the honest calendar state", async () => {
    settingsRoutes();
    renderApp("/settings");
    expect(await screen.findByText("Profile & Settings")).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ada Lovelace");
    expect((screen.getByLabelText("Alter ego") as HTMLInputElement).value).toBe("The Operator");
    expect(screen.getByText(/Not connected/)).toBeTruthy();
    expect(screen.getByText(/Plan: full/)).toBeTruthy();
  });

  it("updates the mentor nudges preference", async () => {
    const { bodies } = settingsRoutes({ "PATCH /api/v1/me": () => json({ ...ME, mentor_nudges: false }) });
    renderApp("/settings");
    fireEvent.click(await screen.findByRole("switch", { name: "Mentor nudges" }));
    await waitFor(() => expect(bodies["PATCH /api/v1/me"]).toEqual([{ mentor_nudges: false }]));
  });

  it("records analytics consent changes in the ledger", async () => {
    const { bodies } = settingsRoutes({
      "POST /api/v1/me/consents": () => json({ id: 9, purpose: "analytics", version: "2026-10", granted: false, created_at: "x" }, 201),
    });
    renderApp("/settings");
    fireEvent.click(await screen.findByRole("switch", { name: "Usage analytics" }));
    await waitFor(() => expect(bodies["POST /api/v1/me/consents"]).toBeTruthy());
    expect(bodies["POST /api/v1/me/consents"]![0]).toMatchObject({ purpose: "analytics", granted: false });
  });

  it("requires confirmation before resetting the protocol", async () => {
    const { bodies, calls } = settingsRoutes({
      "POST /api/v1/me/reset": () => json({ protocols: 1, interviews: 1 }),
      "POST /api/v1/interviews": () => json({ detail: "x" }, 500),
    });
    renderApp("/settings");
    fireEvent.click(await screen.findByRole("button", { name: /Reset protocol/ }));
    const dialog = await screen.findByRole("dialog");
    expect(calls).not.toContain("POST /api/v1/me/reset");
    expect(dialog.textContent).toMatch(/reflections, mentor conversations and notes are kept/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset protocol" }));
    await waitFor(() => expect(bodies["POST /api/v1/me/reset"]).toEqual([{ confirm: true }]));
  });

  it("connects a calendar in clearly labelled demo mode", async () => {
    const { bodies } = settingsRoutes({
      "POST /api/v1/calendar": () => json({ connected: true,
        link: { provider: "google", account_email: "me@gmail.com", mode: "demo", connected_at: "x" },
        demo_notice: "Demo mode: events are kept inside Alter Ego OS." }),
      "POST /api/v1/calendar/sync": () => json({ created: 8, mode: "demo" }),
    });
    renderApp("/settings");
    fireEvent.click(await screen.findByRole("button", { name: "Connect calendar" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toMatch(/Demo mode/);
    fireEvent.change(within(dialog).getByLabelText("Google account email"), { target: { value: "me@gmail.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Connect (demo)" }));
    await waitFor(() => expect(bodies["POST /api/v1/calendar"]).toEqual([{ account_email: "me@gmail.com" }]));
  });
});

describe("error boundary", () => {
  it("renders a recovery screen instead of a blank page", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("render failure");
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("This page did not load")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go home" })).toBeTruthy();
    spy.mockRestore();
  });
});
