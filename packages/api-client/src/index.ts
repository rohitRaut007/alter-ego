import createClient, { type Middleware } from "openapi-fetch";

import { readSse, type SseEvent } from "./sse";
import type { components, paths } from "./schema";

export type { components, paths } from "./schema";
export { parseSse, readSse, type SseEvent } from "./sse";

export type Me = components["schemas"]["Me"];
export type ConsentPurpose = components["schemas"]["PurposeEnum"];
export type InterviewStep = components["schemas"]["InterviewStep"];
export type Question = components["schemas"]["Question"];
export type Protocol = components["schemas"]["Protocol"];
export type ProtocolSection = components["schemas"]["ProtocolSection"];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the current access token, or null when signed out. */
  getAccessToken: () => string | null;
  /** Called once when the API answers 401 to an authenticated request. */
  onUnauthorized?: () => void;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** The only way web and mobile talk to the API. Types come from the generated OpenAPI schema. */
export function createApiClient(options: ApiClientOptions) {
  const doFetch: typeof fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const client = createClient<paths>({ baseUrl: options.baseUrl, fetch: doFetch });

  const auth: Middleware = {
    onRequest({ request }) {
      const token = options.getAccessToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
    onResponse({ request, response }) {
      if (response.status === 401 && request.headers.has("Authorization")) {
        options.onUnauthorized?.();
      }
      return response;
    },
  };
  client.use(auth);

  async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const token = options.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await doFetch(`${options.baseUrl}${path}`, { ...init, headers });
    if (response.status === 401 && token) options.onUnauthorized?.();
    if (!response.ok) throw new ApiError(response.status, `Request failed (${response.status})`);
    return response;
  }

  return Object.assign(client, {
    /** Stream server-sent events. Resumes after `lastEventId` when given. */
    async *streamEvents(
      path: string,
      opts: { lastEventId?: string; signal?: AbortSignal } = {},
    ): AsyncGenerator<SseEvent> {
      const headers: Record<string, string> = { Accept: "text/event-stream" };
      if (opts.lastEventId) headers["Last-Event-ID"] = opts.lastEventId;
      const init: RequestInit = { headers };
      if (opts.signal) init.signal = opts.signal;
      yield* readSse(await rawFetch(path, init));
    },
    /** Fetch a binary resource (e.g. the protocol PDF) with the current credentials. */
    async fetchBlob(path: string): Promise<Blob> {
      return (await rawFetch(path)).blob();
    },
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
