import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PRACTICE_ID,
  TASK_ID,
  TRAIT_ID,
  brief,
  json,
  practice,
  renderApp,
  safetyNotice,
  stubApi,
  task,
} from "./utils";

const noSession = () => json({ detail: "none" }, 404);
const locked = () => json({ detail: "x", code: "entitlement_required", feature: "calendar" }, 403);

const dailyRoutes = (extra: Record<string, () => Response | Promise<Response>> = {}) => ({
  "GET /api/v1/daily/brief": () => json(brief()),
  "GET /api/v1/deep-work/sessions/active": noSession,
  "GET /api/v1/calendar": locked,
  "GET /api/v1/reflections": () => json({ reflection: null, safety: null, prompts: [
    { key: "compounded", question: "What compounded today?" },
    { key: "leaked", question: "What leaked?" },
    { key: "tomorrow", question: "What is tomorrow's first action?" },
  ] }),
  ...extra,
});

describe("daily OS", () => {
  it("shows the brief, names what slipped, groups tasks by block and completes one", async () => {
    const { bodies, calls } = stubApi(dailyRoutes({
      [`PATCH /api/v1/tasks/${TASK_ID}`]: () => json(task({ done: true })),
    }));
    renderApp("/daily");

    expect(await screen.findByText("Day 14: keep the cadence.")).toBeTruthy();
    expect(screen.getByText(/The 1 overdue is all in Knowledge/)).toBeTruthy();
    expect(screen.getByText("Day 14 of 90")).toBeTruthy();
    expect(screen.getByText("25 of 120 minutes logged today.")).toBeTruthy();
    // Block tabs from the legacy design.
    expect(screen.getByRole("tab", { name: "Morning" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Deep work" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Evening" })).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /Week 2: reading/ }));
    await waitFor(() => expect(bodies[`PATCH /api/v1/tasks/${TASK_ID}`]).toEqual([{ done: true }]));
    await waitFor(() =>
      expect(calls.filter((c) => c === "GET /api/v1/daily/brief").length).toBeGreaterThan(1),
    );
  });

  it("moves between blocks and adds your own task", async () => {
    const { bodies } = stubApi(dailyRoutes({
      "POST /api/v1/tasks/new": () => json({ task: task({ id: "n", source: "user", title: "Write launch email" }), safety: null }),
    }));
    renderApp("/daily");
    await screen.findByText("Day 14: keep the cadence.");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Evening" }));
    expect(await screen.findByText(/Nothing scheduled in this block/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Add a task"), { target: { value: "Write launch email" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(bodies["POST /api/v1/tasks/new"]).toBeTruthy());
    expect(bodies["POST /api/v1/tasks/new"]![0]).toMatchObject({ title: "Write launch email", block: "deep_work" });
  });

  it("shows support instead of adding a task when the text trips the boundary", async () => {
    stubApi(dailyRoutes({
      "POST /api/v1/tasks/new": () => json({ task: null, safety: safetyNotice }),
    }));
    renderApp("/daily");
    await screen.findByText("Day 14: keep the cadence.");
    fireEvent.change(screen.getByLabelText("Add a task"), { target: { value: "end my life" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect((await screen.findByRole("alert", { name: "Support" })).textContent).toMatch(/Tele-MANAS/);
  });

  it("logs a practice", async () => {
    const { bodies } = stubApi(dailyRoutes({
      [`POST /api/v1/practices/${PRACTICE_ID}/logs`]: () =>
        json({ practice_id: PRACTICE_ID, date: "2026-10-27", done: true }),
    }));
    renderApp("/daily");
    fireEvent.click(await screen.findByRole("checkbox", { name: /must-finish task/ }));
    await waitFor(() =>
      expect(bodies[`POST /api/v1/practices/${PRACTICE_ID}/logs`]).toEqual([{ done: true }]),
    );
  });

  it("offers the weekly ritual when due and starts a deep work block", async () => {
    const { bodies } = stubApi(dailyRoutes({
      "GET /api/v1/daily/brief": () =>
        json(brief({ ritual: { available: true, week_start: "2026-10-26", completed: false, due: true } })),
      "POST /api/v1/deep-work/sessions": () =>
        json({ id: "6", task_id: null, planned_minutes: 50, started_at: new Date().toISOString(),
               ended_at: null, abandoned: false, actual_minutes: 0 }, 201),
    }));
    renderApp("/daily");
    expect(await screen.findByText("Weekly output ritual")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "50 min" }));
    fireEvent.click(screen.getByRole("button", { name: /Start block/ }));
    await waitFor(() =>
      expect(bodies["POST /api/v1/deep-work/sessions"]).toEqual([{ planned_minutes: 50 }]),
    );
  });

  it("saves an evening reflection inline", async () => {
    const { bodies } = stubApi(dailyRoutes({
      "POST /api/v1/reflections": () => json({
        reflection: { date: "2026-10-27", answers: { compounded: "Shipped it.", leaked: "", tomorrow: "" },
                      rating: null, updated_at: "x" },
        prompts: [], safety: null,
      }),
    }));
    renderApp("/daily");
    fireEvent.change(await screen.findByLabelText("What compounded today?"), { target: { value: "Shipped it." } });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    expect((await screen.findByRole("status", { name: "" })).textContent ?? "").toBeDefined();
    await waitFor(() => expect(bodies["POST /api/v1/reflections"]).toBeTruthy());
    expect((bodies["POST /api/v1/reflections"]![0] as { answers: { compounded: string } }).answers.compounded)
      .toBe("Shipped it.");
  });

  it("shows support and does not claim a save when a reflection trips the boundary", async () => {
    stubApi(dailyRoutes({
      "POST /api/v1/reflections": () => json({ reflection: null, prompts: [], safety: safetyNotice }),
    }));
    renderApp("/reflection");
    fireEvent.change(await screen.findByLabelText("What compounded today?"), { target: { value: "Nothing." } });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    expect((await screen.findByRole("alert", { name: "Support" })).textContent).toMatch(/Tele-MANAS/);
    expect(screen.getByText(/not saved or used for coaching/)).toBeTruthy();
  });

  it("points a user without a protocol to the interview", async () => {
    stubApi({ "GET /api/v1/daily/brief": () => json({ detail: "none" }, 404) });
    renderApp("/daily");
    expect(await screen.findByText("Your day starts with a protocol")).toBeTruthy();
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
  it("shows traits and streaks, records the starting self-rating and takes a challenge", async () => {
    const { bodies } = stubApi({
      "GET /api/v1/traits": () => json([trait()]),
      "GET /api/v1/mentor/challenges": () => json([
        { id: "c1", week_index: 2, layer: "knowledge", difficulty: "Medium", title: "Clear the knowledge backlog",
          detail: "Finish the oldest item first.", status: "offered", task_id: null },
      ]),
      [`POST /api/v1/traits/${TRAIT_ID}/ratings`]: () => json({ rating: { day_offset: 0, score: 2 }, safety: null }),
      "POST /api/v1/mentor/challenges/c1/accept": () => json({ id: "c1", status: "accepted" }),
    });
    renderApp("/character");
    expect(await screen.findByText("Follow-through")).toBeTruthy();
    expect(screen.getByText("Where are you starting?")).toBeTruthy();
    expect(screen.getByText("Streaks")).toBeTruthy();
    expect(await screen.findByText("Clear the knowledge backlog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "2 · Sometimes" }));
    await waitFor(() =>
      expect(bodies[`POST /api/v1/traits/${TRAIT_ID}/ratings`]).toEqual([{ day_offset: 0, score: 2 }]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Take it on" }));
    await waitFor(() => expect(bodies["POST /api/v1/mentor/challenges/c1/accept"]).toBeUndefined());
  });

  it("shows support when a monthly reflection trips the boundary", async () => {
    stubApi({
      "GET /api/v1/traits": () => json([trait({ rating_due_offset: null })]),
      "GET /api/v1/mentor/challenges": () => json([]),
      [`POST /api/v1/traits/${TRAIT_ID}/reflections`]: () => json({ saved: false, safety: safetyNotice }),
    });
    renderApp("/character");
    fireEvent.change(await screen.findByLabelText("Where did I stop early this month?"), {
      target: { value: "text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    expect((await screen.findByRole("alert", { name: "Support" })).textContent).toMatch(/14416/);
  });
});

describe("weekly ritual", () => {
  it("explains when the ritual is not open yet", async () => {
    stubApi({
      "GET /api/v1/weekly-ritual": () => json({
        state: { available: false, week_start: null, completed: false, due: false },
        stats: null, prompts: [], answers: null, safety: null,
      }),
    });
    renderApp("/ritual");
    expect(await screen.findByText(/opens on Sunday at 5pm/)).toBeTruthy();
  });
});
