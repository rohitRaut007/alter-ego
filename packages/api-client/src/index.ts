import createClient, { type Middleware } from "openapi-fetch";

import type { components, paths } from "./schema";

export type { components, paths } from "./schema";

export type Me = components["schemas"]["Me"];
export type ConsentPurpose = components["schemas"]["PurposeEnum"];

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
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

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
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
