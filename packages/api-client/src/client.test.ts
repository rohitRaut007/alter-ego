import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./index";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("api client contract", () => {
  it("sends the bearer token and typed body to the right path", async () => {
    const calls: Request[] = [];
    const fetchMock = vi.fn(async (req: Request) => {
      calls.push(req);
      return jsonResponse({
        id: "00000000-0000-0000-0000-000000000000",
        email: "ada@example.com",
        created_at: "2026-10-13T00:00:00Z",
        tier: "core",
        entitlements: ["protocol"],
      });
    });
    const api = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken: () => "tok",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const { data } = await api.GET("/api/v1/me");

    expect(data?.entitlements).toEqual(["protocol"]);
    const req = calls[0]!;
    expect(new URL(req.url).pathname).toBe("/api/v1/me");
    expect(req.headers.get("Authorization")).toBe("Bearer tok");
  });

  it("posts registration payloads as JSON without an auth header when signed out", async () => {
    const calls: Request[] = [];
    const fetchMock = vi.fn(async (req: Request) => {
      calls.push(req);
      return jsonResponse({ detail: "no" }, 400);
    });
    const api = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken: () => null,
      fetch: fetchMock as unknown as typeof fetch,
    });

    const { error } = await api.POST("/api/v1/auth/register", {
      body: {
        email: "ada@example.com",
        password: "a-long-enough-passphrase",
        consents: [{ purpose: "terms", version: "1", granted: true }],
      },
    });

    expect(error).toBeTruthy();
    const req = calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.headers.get("Authorization")).toBeNull();
    expect(await req.json()).toMatchObject({ email: "ada@example.com" });
  });

  it("calls onUnauthorized when an authenticated request gets 401", async () => {
    const onUnauthorized = vi.fn();
    const api = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken: () => "expired",
      onUnauthorized,
      fetch: (async () => jsonResponse({ detail: "expired" }, 401)) as unknown as typeof fetch,
    });
    await api.GET("/api/v1/me");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
