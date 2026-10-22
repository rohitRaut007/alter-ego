import example from "@alter-ego/validation/fixtures/protocol.v2.example.json";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INTERVIEW_ID, PROTOCOL_ID, json, renderApp, safetyNotice, stubApi } from "./utils";

const STEP = {
  interview_id: INTERVIEW_ID,
  status: "in_progress",
  answered_count: 0,
  acknowledgement: "",
  progress: 0,
  done: false,
  safety: null,
};

const question = {
  idx: 0,
  stage: "Ambition",
  question: "Tell me what you are trying to become.",
  suggestions: ["A founder who ships"],
  multi_select: false,
  placeholder: "Say it plainly.",
};

describe("interview", () => {
  it("asks a question, sends the answer, and completes when the interviewer is done", async () => {
    const { calls } = stubApi({
      "POST /api/v1/interviews": () => json({ ...STEP, question }, 201),
      [`POST /api/v1/interviews/${INTERVIEW_ID}/turns`]: async (req) => {
        expect(await req.json()).toEqual({ answer: "A founder who ships" });
        return json({ ...STEP, answered_count: 1, question: null, done: true, progress: 1,
                      acknowledgement: "Good. That is enough to build from." });
      },
      [`POST /api/v1/interviews/${INTERVIEW_ID}/complete`]: () => json({ protocol_id: PROTOCOL_ID }, 202),
      [`GET /api/v1/protocols/${PROTOCOL_ID}`]: () => json({ id: PROTOCOL_ID, status: "generating",
        sections: [], expected_sections: [], failure_code: "", accuracy_rating: null, document: null }),
      [`GET /api/v1/protocols/${PROTOCOL_ID}/events`]: () =>
        new Response("", { headers: { "content-type": "text/event-stream" } }),
    });
    renderApp("/onboarding");
    expect(await screen.findByText("Tell me what you are trying to become.")).toBeTruthy();
    expect(screen.getByText("Ambition")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "A founder who ships" }));
    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
    await waitFor(() =>
      expect(calls).toContain(`POST /api/v1/interviews/${INTERVIEW_ID}/complete`),
    );
    expect(await screen.findByText(/Building your protocol/i)).toBeTruthy();
  });

  it("keeps the question open and shows support when the safety boundary triggers", async () => {
    stubApi({
      "POST /api/v1/interviews": () => json({ ...STEP, question }, 201),
      [`POST /api/v1/interviews/${INTERVIEW_ID}/turns`]: () =>
        json({ ...STEP, question, safety: safetyNotice }),
    });
    renderApp("/onboarding");
    fireEvent.change(await screen.findByLabelText("Your answer"), {
      target: { value: "Some days I want to die." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
    const alert = await screen.findByRole("alert", { name: "Support" });
    expect(alert.textContent).toMatch(/Tele-MANAS/);
    // The answer bubble is withdrawn; nothing was stored.
    expect(screen.queryByText("Some days I want to die.")).toBeNull();
  });

  it("shows an error instead of a blank screen when the interview cannot start", async () => {
    stubApi({ "POST /api/v1/interviews": () => json({ detail: "no" }, 500) });
    renderApp("/onboarding");
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not start/i);
  });
});

function readyProtocol(overrides: Record<string, unknown> = {}) {
  const doc = example as Record<string, unknown>;
  const keys = ["identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy",
                "checklist_30", "sprint_90"];
  return {
    id: PROTOCOL_ID,
    status: "ready",
    schema_version: "2.0.0",
    failure_code: "",
    accuracy_rating: null,
    created_at: "2026-10-14T05:30:00Z",
    completed_at: "2026-10-14T05:31:00Z",
    expected_sections: keys,
    sections: keys.map((key) => ({
      key,
      revision: 1,
      created_at: "2026-10-14T05:30:00Z",
      content: key === "checklist_30" ? { tasks: doc.checklist_30 } : doc[key],
    })),
    document: doc,
    ...overrides,
  };
}

const dashLayers = {
  layers: ["identity", "character", "knowledge", "mission", "daily_os", "presence", "legacy"].map(
    (id, i) => ({ id, index: i + 1, name: id, status: "active", progress: 40 }),
  ),
};

describe("protocol", () => {
  const base = (extra: Record<string, () => Response | Promise<Response>> = {}) =>
    stubApi({
      [`GET /api/v1/protocols/${PROTOCOL_ID}`]: () => json(readyProtocol()),
      "GET /api/v1/dashboard": () => json(dashLayers),
      ...extra,
    });

  it("shows the seven layer tabs, the layer overview, rating and PDF export", async () => {
    base();
    renderApp(`/protocol/${PROTOCOL_ID}`);
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Identity", "Character", "Knowledge", "Mission", "Daily OS", "Presence", "Legacy",
    ]);
    expect(screen.getAllByText(/I do the work in front of me/).length).toBeGreaterThan(0);
    // Legacy-style overview of the seven layers with real progress.
    expect(screen.getByText("Identity Architecture")).toBeTruthy();
    expect(screen.getAllByText("40% built").length).toBe(7);

    fireEvent.click(screen.getByRole("tab", { name: "Daily OS" }));
    expect(screen.getByText("30-day checklist")).toBeTruthy();
    expect(screen.getByText("How accurate is this to your situation?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Download PDF/ })).toBeTruthy();
  });

  it("opens a layer dialog with highlights from the protocol itself", async () => {
    base();
    renderApp(`/protocol/${PROTOCOL_ID}`);
    fireEvent.click(await screen.findByRole("button", { name: /Character Stack/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toMatch(/Follow-through/);
    expect(dialog.textContent).toMatch(/Open this layer/);
  });

  it("reveals a generating protocol section by section", async () => {
    const partial = readyProtocol({ status: "generating", document: null, completed_at: null });
    partial.sections = partial.sections.slice(0, 2);
    base({
      [`GET /api/v1/protocols/${PROTOCOL_ID}`]: () => json(partial),
      [`GET /api/v1/protocols/${PROTOCOL_ID}/events`]: () =>
        new Response("", { headers: { "content-type": "text/event-stream" } }),
    });
    renderApp(`/protocol/${PROTOCOL_ID}`);
    expect(await screen.findByText(/2 of 9 sections written/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Knowledge/ }));
    expect(screen.getByText("Writing this section…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Revise this section/ })).toBeNull();
  });

  it("revises one section and shows support when the instruction trips the boundary", async () => {
    let n = 0;
    const { bodies } = base({
      [`POST /api/v1/protocols/${PROTOCOL_ID}/sections/identity/revise`]: () => {
        n += 1;
        return n === 1
          ? json({ section: { key: "identity", revision: 2, content: {}, created_at: "x" }, safety: null })
          : json({ section: null, safety: safetyNotice });
      },
    });
    renderApp(`/protocol/${PROTOCOL_ID}`);
    fireEvent.click(await screen.findByRole("button", { name: /Revise this section/ }));
    fireEvent.change(screen.getByLabelText("What should change?"), {
      target: { value: "Make it about shipping weekly." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    await waitFor(() =>
      expect(bodies[`POST /api/v1/protocols/${PROTOCOL_ID}/sections/identity/revise`]).toHaveLength(1),
    );

    fireEvent.click(await screen.findByRole("button", { name: /Revise this section/ }));
    fireEvent.change(screen.getByLabelText("What should change?"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    expect((await screen.findByRole("alert", { name: "Support" })).textContent).toMatch(/Tele-MANAS/);
  });

  it("shows a friendly message when the API rejects a revision", async () => {
    base({
      [`POST /api/v1/protocols/${PROTOCOL_ID}/sections/identity/revise`]: () => json({ detail: "no" }, 422),
    });
    renderApp(`/protocol/${PROTOCOL_ID}`);
    fireEvent.click(await screen.findByRole("button", { name: /Revise this section/ }));
    fireEvent.change(screen.getByLabelText("What should change?"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/rephras/i);
  });
});
