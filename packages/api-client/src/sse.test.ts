import { describe, expect, it } from "vitest";

import { createApiClient, parseSse, readSse } from "./index";

describe("parseSse", () => {
  it("parses id, event and data and keeps an incomplete tail", () => {
    const { events, rest } = parseSse(
      'id: 1\nevent: section.ready\ndata: {"key":"identity"}\n\n: keep-alive\n\nid: 2\nevent: do',
    );
    expect(events).toEqual([{ id: "1", event: "section.ready", data: '{"key":"identity"}' }]);
    expect(rest).toBe("id: 2\nevent: do");
  });

  it("handles CRLF and multi-line data", () => {
    const { events } = parseSse("event: x\r\ndata: a\r\ndata: b\r\n\r\n");
    expect(events).toEqual([{ id: null, event: "x", data: "a\nb" }]);
  });
});

describe("streaming", () => {
  function streamOf(chunks: string[]): Response {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(enc.encode(c));
        controller.close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  }

  it("reassembles events split across chunks", async () => {
    const seen: string[] = [];
    for await (const ev of readSse(streamOf(["id: 1\nevent: pro", "gress\ndata: {}\n\nid: 2\n", "event: done\ndata: {}\n\n"]))) {
      seen.push(`${ev.id}:${ev.event}`);
    }
    expect(seen).toEqual(["1:progress", "2:done"]);
  });

  it("sends auth and Last-Event-ID and throws ApiError on failure", async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const api = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken: () => "tok",
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, headers: new Headers(init.headers) });
        return streamOf(["id: 9\nevent: done\ndata: {}\n\n"]);
      }) as unknown as typeof fetch,
    });
    const out: string[] = [];
    for await (const ev of api.streamEvents("/api/v1/protocols/x/events", { lastEventId: "8" })) {
      out.push(ev.event);
    }
    expect(out).toEqual(["done"]);
    expect(calls[0]!.headers.get("Authorization")).toBe("Bearer tok");
    expect(calls[0]!.headers.get("Last-Event-ID")).toBe("8");

    const failing = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken: () => null,
      fetch: (async () => new Response("no", { status: 403 })) as unknown as typeof fetch,
    });
    await expect(failing.fetchBlob("/api/v1/protocols/x/pdf")).rejects.toMatchObject({ status: 403 });
  });
});
