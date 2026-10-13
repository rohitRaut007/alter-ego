import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { json, renderApp, safetyNotice, sse, stubApi } from "./utils";

const THREAD = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  title: "What should I do first today?",
  kind: "chat",
  status: "open",
  created_at: "2026-10-27T08:00:00Z",
  updated_at: "2026-10-27T08:00:00Z",
  message_count: 2,
};

const mentorBase = (extra: Record<string, () => Response | Promise<Response>> = {}) => ({
  "GET /api/v1/mentor/threads": () => json([THREAD]),
  "GET /api/v1/mentor/prompts": () => json({ prompts: ["What should I do first today?", "Recalibrate my 90-day sprint"], persona_name: "Mentor" }),
  "GET /api/v1/mentor/nudges": () => json([]),
  "GET /api/v1/mentor/challenges": () => json([]),
  "GET /api/v1/mentor/memory": () => json([]),
  [`GET /api/v1/mentor/threads/${THREAD.id}`]: () =>
    json({ thread: THREAD, messages: [
      { id: "m1", role: "user", body: "What should I do first today?", created_at: "x" },
      { id: "m2", role: "mentor", body: "Start with the first priority.", created_at: "x" },
    ] }),
  ...extra,
});

describe("mentor", () => {
  it("shows history, prompts and the conversation, and streams a reply token by token", async () => {
    const { bodies } = stubApi(mentorBase({
      [`POST /api/v1/mentor/threads/${THREAD.id}/messages`]: () =>
        sse([
          'event: start\ndata: {"user_message_id":"u1"}\n\n',
          'event: token\ndata: {"text":"Focus on "}\n\n',
          'event: token\ndata: {"text":"the pricing page."}\n\n',
          'event: done\ndata: {"message_id":"m9","title":"x"}\n\n',
        ]),
    }));
    renderApp("/mentor");
    expect(await screen.findByText("Start with the first priority.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "What now?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(bodies[`POST /api/v1/mentor/threads/${THREAD.id}/messages`]).toEqual([
        { content: "What now?", stream: true },
      ]),
    );
  });

  it("shows support and a resume control when the safety boundary pauses the thread", async () => {
    stubApi(mentorBase({
      [`POST /api/v1/mentor/threads/${THREAD.id}/messages`]: () =>
        json({ user_message: null, reply: null, thread: { ...THREAD, status: "paused_safety" },
               safety: safetyNotice }),
    }));
    renderApp("/mentor");
    await screen.findByText("Start with the first priority.");
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "I want to die" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    const alert = await screen.findByRole("alert", { name: "Support" });
    expect(alert.textContent).toMatch(/Tele-MANAS/);
  });

  it("lists proactive nudges and open challenges and accepts a challenge", async () => {
    const { bodies } = stubApi(mentorBase({
      "GET /api/v1/mentor/nudges": () =>
        json([{ id: "n1", kind: "reengagement", body: "It has been 4 days. Do one small thing.", created_at: "x", read: false }]),
      "GET /api/v1/mentor/challenges": () =>
        json([{ id: "c1", week_index: 2, layer: "knowledge", difficulty: "Hard", title: "Ship one imperfect thing",
                detail: "Publish what you have been polishing.", status: "offered", task_id: null }]),
      "POST /api/v1/mentor/challenges/c1/accept": () => json({ id: "c1", status: "accepted" }),
    }));
    renderApp("/mentor");
    expect(await screen.findByText(/It has been 4 days/)).toBeTruthy();
    expect(screen.getByText("Ship one imperfect thing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(bodies["POST /api/v1/mentor/challenges/c1/accept"]).toBeUndefined());
  });

  it("lets the user see and forget what the mentor remembers", async () => {
    const { calls } = stubApi(mentorBase({
      "GET /api/v1/mentor/memory": () =>
        json([{ id: "f1", kind: "commitment", text: "User states: I will ship the pricing page", created_at: "x" }]),
      "DELETE /api/v1/mentor/memory/f1": () => new Response(null, { status: 204 }),
    }));
    renderApp("/mentor");
    expect(await screen.findByText(/I will ship the pricing page/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Forget this" }));
    await waitFor(() => expect(calls).toContain("DELETE /api/v1/mentor/memory/f1"));
  });
});

const item = (over: Record<string, unknown> = {}) => ({
  id: "i1", sequence: 1, title: "Deep Work", author: "Cal Newport",
  why_now: "Protects the focus block your plan depends on.", estimated_hours: 8,
  status: "want", progress: 0, started_at: null, finished_at: null, ...over,
});

const library = (over: Record<string, unknown> = {}) => ({
  items: [item()],
  stats: { reading: 0, finished: 0, want: 1, notes: 0, average_progress: 0 },
  recommendation: { kind: "start", title: "Deep Work", author: "Cal Newport", reason: "Start here.", item_id: "i1", source_id: null },
  roadmap: [
    { phase: "now", focus: "operations foundations", titles: ["Deep Work"] },
    { phase: "next_90_days", focus: "Build on what is in progress", titles: [] },
    { phase: "this_year", focus: "The long arc of the list", titles: [] },
  ],
  destruction_test_template: "State the strongest argument against this book's main claim.",
  sequencing_rationale: "Execution habits first.",
  ...over,
});

describe("knowledge", () => {
  const routes = (extra: Record<string, () => Response | Promise<Response>> = {}) => stubApi({
    "GET /api/v1/knowledge/library": () => json(library()),
    "GET /api/v1/knowledge/notes": () => json([]),
    ...extra,
  });

  it("shows the sequenced list, recommendation, roadmap and stats", async () => {
    routes();
    renderApp("/knowledge");
    expect(await screen.findByText("Deep Work")).toBeTruthy();
    expect(screen.getByText(/Cal Newport/)).toBeTruthy();
    expect(screen.getByText(/Start “Deep Work”/)).toBeTruthy();
    expect(screen.getByText("Next 90 days")).toBeTruthy();
    expect(screen.getByText("Currently reading")).toBeTruthy();
  });

  it("logs progress", async () => {
    const { bodies } = routes({
      "PATCH /api/v1/knowledge/items/i1": () => json(item({ progress: 10, status: "reading" })),
    });
    renderApp("/knowledge");
    fireEvent.click(await screen.findByRole("button", { name: "+10%" }));
    await waitFor(() => expect(bodies["PATCH /api/v1/knowledge/items/i1"]).toEqual([{ progress: 10 }]));
  });

  it("asks for a destruction test before finishing a book and saves it as a note", async () => {
    const { bodies } = routes({
      "POST /api/v1/knowledge/notes": () => json({ note: { id: "n" }, safety: null }),
      "PATCH /api/v1/knowledge/items/i1": () => json(item({ status: "finished", progress: 100 })),
    });
    renderApp("/knowledge");
    fireEvent.click(await screen.findByRole("button", { name: "Finish" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/strongest argument against/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Destruction test"), {
      target: { value: "It ignores people who cannot control their calendar." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and finish" }));
    await waitFor(() => expect(bodies["PATCH /api/v1/knowledge/items/i1"]).toEqual([{ status: "finished" }]));
    expect(bodies["POST /api/v1/knowledge/notes"]![0]).toMatchObject({
      kind: "destruction_test", item_id: "i1",
    });
  });

  it("answers an advisor question with cited sources", async () => {
    routes({
      "POST /api/v1/knowledge/advisor": () => json({
        answer: "Next, from the curated set: Essentialism.",
        sources: [{ id: "essentialism", title: "Essentialism", author: "Greg McKeown", summary: "A framework for choosing fewer things." }],
        safety: null,
      }),
    });
    renderApp("/knowledge");
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /AI Analysis|Advisor/ }));
    fireEvent.change(await screen.findByLabelText("Ask the advisor"), { target: { value: "what next about focus" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText(/Next, from the curated set/)).toBeTruthy();
    expect(screen.getByText("A framework for choosing fewer things.")).toBeTruthy();
  });

  it("shows support instead of saving a note that trips the boundary", async () => {
    routes({ "POST /api/v1/knowledge/notes": () => json({ note: null, safety: safetyNotice }) });
    renderApp("/knowledge");
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /Collision notebook/ }));
    fireEvent.change(await screen.findByLabelText("Collision title"), { target: { value: "T" } });
    fireEvent.change(screen.getByLabelText("Collision thought"), { target: { value: "end my life" } });
    fireEvent.click(screen.getByRole("button", { name: /Save collision/ }));
    expect((await screen.findByRole("alert", { name: "Support" })).textContent).toMatch(/Tele-MANAS/);
  });
});

const milestone = (over: Record<string, unknown> = {}) => ({
  id: "m1", horizon: "2y", title: "A product with 50 paying customers", detail: "Leading indicators: weekly output",
  due_label: "Within two years", progress: 20, done: false, origin: "protocol", position: 0, ...over,
});

describe("legacy timeline", () => {
  it("shows milestones per horizon with summary and lets you complete one", async () => {
    const { bodies } = stubApi({
      "GET /api/v1/legacy/timeline": () => json({
        milestones: [milestone(), milestone({ id: "m2", horizon: "5y", title: "The work sustains itself" })],
        summary: { total: 2, done: 0, average_progress: 10 }, next_review: null,
      }),
      "PATCH /api/v1/legacy/milestones/m1": () => json({ milestone: milestone({ done: true, progress: 100 }), safety: null }),
    });
    renderApp("/legacy");
    expect(await screen.findByText("A product with 50 paying customers")).toBeTruthy();
    expect(screen.getByText("Milestones mapped")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Mark complete/ }));
    await waitFor(() => expect(bodies["PATCH /api/v1/legacy/milestones/m1"]).toEqual([{ done: true }]));
  });

  it("adds a milestone and schedules a quarterly review", async () => {
    const { bodies } = stubApi({
      "GET /api/v1/legacy/timeline": () => json({ milestones: [], summary: { total: 0, done: 0, average_progress: 0 }, next_review: null }),
      "POST /api/v1/legacy/milestones": () => json({ milestone: milestone({ id: "n", origin: "user" }), safety: null }),
      "POST /api/v1/legacy/reviews": () => json({ id: "r1", scheduled_for: "2026-12-31", completed_at: null }, 201),
    });
    renderApp("/legacy");
    fireEvent.change(await screen.findByLabelText("Milestone"), { target: { value: "Publish a book" } });
    fireEvent.click(screen.getByRole("button", { name: "Add milestone" }));
    await waitFor(() => expect(bodies["POST /api/v1/legacy/milestones"]).toBeTruthy());
    expect(bodies["POST /api/v1/legacy/milestones"]![0]).toMatchObject({ title: "Publish a book", horizon: "2y" });

    fireEvent.click(screen.getByRole("button", { name: /Schedule quarterly review/ }));
    await waitFor(() => expect(bodies["POST /api/v1/legacy/reviews"]).toBeTruthy());
  });

  it("explains that the timeline is part of the Full plan when it is locked", async () => {
    stubApi({ "GET /api/v1/legacy/timeline": () => json({ detail: "x", code: "entitlement_required", feature: "legacy" }, 403) });
    renderApp("/legacy");
    expect(await screen.findByText(/part of the Full plan/)).toBeTruthy();
  });
});
