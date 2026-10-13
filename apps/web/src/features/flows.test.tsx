import example from "@alter-ego/validation/fixtures/protocol.v1.example.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/lib/auth";

import { InterviewPage } from "./onboarding/InterviewPage";
import { ProtocolPage } from "./protocol/ProtocolPage";

type Handler = (req: Request) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Route-by-"METHOD path" fetch stub; fails loudly on unexpected calls. */
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

function renderApp(initial: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <AuthProvider>
          <Routes>
            <Route path="/onboarding" element={<InterviewPage />} />
            <Route path="/protocol/:id" element={<ProtocolPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const IID = "11111111-1111-1111-1111-111111111111";
const PID = "22222222-2222-2222-2222-222222222222";

const STEP = {
  interview_id: IID,
  status: "in_progress",
  answered_count: 0,
  acknowledgement: "",
  progress: 0,
  done: false,
};

describe("interview", () => {
  it("asks a question, sends the answer, and completes when the interviewer is done", async () => {
    const calls = stubApi({
      "POST /api/v1/interviews": () =>
        json(
          {
            ...STEP,
            question: {
              idx: 0,
              stage: "Ambition",
              question: "Tell me what you are trying to become.",
              suggestions: ["A founder who ships"],
              multi_select: false,
              placeholder: "Say it plainly.",
            },
          },
          201,
        ),
      [`POST /api/v1/interviews/${IID}/turns`]: async (req) => {
        expect(await req.json()).toEqual({ answer: "A founder who ships" });
        return json({
          ...STEP,
          answered_count: 1,
          question: null,
          done: true,
          progress: 1,
          acknowledgement: "Good. That is enough to build from.",
        });
      },
      [`POST /api/v1/interviews/${IID}/complete`]: () => json({ protocol_id: PID }, 202),
    });

    renderApp("/onboarding");
    expect(await screen.findByText("Tell me what you are trying to become.")).toBeTruthy();
    expect(screen.getByText("Ambition")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "A founder who ships" }));
    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));

    await waitFor(() => expect(calls).toContain(`POST /api/v1/interviews/${IID}/complete`));
  });

  it("shows an error instead of a blank screen when the interview cannot start", async () => {
    stubApi({ "POST /api/v1/interviews": () => json({ detail: "no" }, 500) });
    renderApp("/onboarding");
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not start/i);
  });
});

function readyProtocol(overrides: Record<string, unknown> = {}) {
  const doc = example as Record<string, unknown>;
  const keys = [
    "identity",
    "character",
    "knowledge",
    "mission",
    "daily_os",
    "presence",
    "legacy",
    "checklist_30",
    "sprint_90",
  ];
  return {
    id: PID,
    status: "ready",
    schema_version: "1.0.0",
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

describe("protocol", () => {
  it("shows the seven layer tabs, content, rating and PDF export", async () => {
    stubApi({ [`GET /api/v1/protocols/${PID}`]: () => json(readyProtocol()) });
    renderApp(`/protocol/${PID}`);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Identity",
      "Character",
      "Knowledge",
      "Mission",
      "Daily OS",
      "Presence",
      "Legacy",
    ]);
    expect(screen.getByText(/I do the work in front of me/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Daily OS" }));
    expect(screen.getByText("30-day checklist")).toBeTruthy();
    expect(screen.getByText("90-day sprint")).toBeTruthy();

    expect(screen.getByText("How accurate is this to your situation?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Download PDF/ })).toBeTruthy();
  });

  it("reveals a generating protocol section by section", async () => {
    const partial = readyProtocol({ status: "generating", document: null, completed_at: null });
    partial.sections = partial.sections.slice(0, 2);
    stubApi({
      [`GET /api/v1/protocols/${PID}`]: () => json(partial),
      [`GET /api/v1/protocols/${PID}/events`]: () =>
        new Response("", { headers: { "content-type": "text/event-stream" } }),
    });
    renderApp(`/protocol/${PID}`);

    expect(await screen.findByText(/2 of 9 sections written/)).toBeTruthy();
    expect(screen.getByText(/I do the work in front of me/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Knowledge/ }));
    expect(screen.getByText("Writing this section…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Revise this section/ })).toBeNull();
  });

  it("revises one section through the API and refreshes", async () => {
    let revised = false;
    const calls = stubApi({
      [`GET /api/v1/protocols/${PID}`]: () => json(readyProtocol()),
      [`POST /api/v1/protocols/${PID}/sections/identity/revise`]: async (req) => {
        expect(await req.json()).toEqual({ instruction: "Make it about shipping weekly." });
        revised = true;
        return json({
          section: { key: "identity", revision: 2, content: {}, created_at: "2026-10-14T06:00:00Z" },
          safety: null,
        });
      },
    });
    renderApp(`/protocol/${PID}`);

    fireEvent.click(await screen.findByRole("button", { name: /Revise this section/ }));
    fireEvent.change(screen.getByLabelText("What should change?"), {
      target: { value: "Make it about shipping weekly." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));

    await waitFor(() => expect(revised).toBe(true));
    await waitFor(() =>
      expect(calls.filter((c) => c === `GET /api/v1/protocols/${PID}`).length).toBeGreaterThan(1),
    );
  });

  it("shows a friendly message when the API rejects a revision", async () => {
    stubApi({
      [`GET /api/v1/protocols/${PID}`]: () => json(readyProtocol()),
      [`POST /api/v1/protocols/${PID}/sections/identity/revise`]: () => json({ detail: "no" }, 422),
    });
    renderApp(`/protocol/${PID}`);
    fireEvent.click(await screen.findByRole("button", { name: /Revise this section/ }));
    fireEvent.change(screen.getByLabelText("What should change?"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/rephras/i);
  });
});
