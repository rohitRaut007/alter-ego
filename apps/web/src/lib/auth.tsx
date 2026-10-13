import { createApiClient, type ApiClient, type Me } from "@alter-ego/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { API_BASE_URL } from "@/env";

/**
 * Access token lives in memory only. The refresh token is kept in sessionStorage so a tab
 * reload keeps the session without persisting credentials beyond the tab.
 */
const REFRESH_KEY = "ae.refresh";

function readRefresh(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(value: string | null): void {
  try {
    if (value) sessionStorage.setItem(REFRESH_KEY, value);
    else sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

type Status = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: Status;
  api: ApiClient;
  signIn: (tokens: { access: string; refresh: string }) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const accessRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>(() => (readRefresh() ? "loading" : "signedOut"));

  const clear = useCallback(() => {
    accessRef.current = null;
    writeRefresh(null);
    queryClient.clear();
    setStatus("signedOut");
  }, [queryClient]);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE_URL,
        getAccessToken: () => accessRef.current,
        onUnauthorized: clear,
      }),
    [clear],
  );

  const signIn = useCallback((tokens: { access: string; refresh: string }) => {
    accessRef.current = tokens.access;
    writeRefresh(tokens.refresh);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async () => {
    const refresh = readRefresh();
    if (refresh && accessRef.current) {
      await api.POST("/api/v1/auth/logout", { body: { refresh } }).catch(() => undefined);
    }
    clear();
  }, [api, clear]);

  // Restore the session after a reload by exchanging the stored refresh token.
  useEffect(() => {
    const refresh = readRefresh();
    if (!refresh || accessRef.current) return;
    let cancelled = false;
    api
      .POST("/api/v1/auth/token/refresh", { body: { refresh } })
      .then(({ data }) => {
        if (cancelled) return;
        if (data) signIn({ access: data.access, refresh: data.refresh ?? refresh });
        else clear();
      })
      .catch(() => {
        // Network failure while restoring: fall back to signed out rather than hanging on the spinner.
        if (!cancelled) clear();
      });
    return () => {
      cancelled = true;
    };
  }, [api, clear, signIn]);

  const value = useMemo(() => ({ status, api, signIn, signOut }), [status, api, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export type { Me };
