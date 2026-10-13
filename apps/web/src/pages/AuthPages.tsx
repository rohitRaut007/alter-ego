import { loginInput, registerInput } from "@alter-ego/validation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Button, Card, Field } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const CONSENT_VERSION = "2026-10";

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Alter Ego OS</p>
      <h1 className="mt-2 font-display text-3xl leading-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <Card className="mt-8">{children}</Card>
    </main>
  );
}

export function LoginPage() {
  const { api, signIn, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  const login = useMutation({
    mutationFn: async () => {
      const parsed = loginInput.safeParse({ email, password });
      if (!parsed.success) throw new Error("Enter a valid email and password.");
      const { data, response } = await api.POST("/api/v1/auth/token", { body: parsed.data });
      if (!data) {
        throw new Error(
          response.status === 429 ? "Too many attempts. Try again shortly." : "Email or password is incorrect.",
        );
      }
      signIn(data);
    },
    onSuccess: () => navigate("/", { replace: true }),
    onError: (e: Error) => setError(e.message),
  });

  if (status === "signedIn") return <Navigate to="/" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    login.mutate();
  };

  return (
    <Shell title="Welcome back." subtitle="Sign in to continue your protocol.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <Field id="password" label="Password" type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" loading={login.isPending}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here? <Link className="font-medium text-foreground underline" to="/register">Create an account</Link>
      </p>
    </Shell>
  );
}

export function RegisterPage() {
  const { api, signIn, status } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const [accepted, setAccepted] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [error, setError] = useState<string>();

  const register = useMutation({
    mutationFn: async () => {
      const parsed = registerInput.safeParse({
        ...form,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        consents: [
          { purpose: "terms", version: CONSENT_VERSION, granted: accepted },
          { purpose: "privacy", version: CONSENT_VERSION, granted: accepted },
          { purpose: "analytics", version: CONSENT_VERSION, granted: analytics },
        ],
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      }
      const { data, error: apiError } = await api.POST("/api/v1/auth/register", { body: parsed.data });
      if (!data) {
        const first = apiError && typeof apiError === "object" ? Object.values(apiError)[0] : undefined;
        throw new Error(Array.isArray(first) ? String(first[0]) : "Could not create the account.");
      }
      signIn(data);
    },
    onSuccess: () => navigate("/", { replace: true }),
    onError: (e: Error) => setError(e.message),
  });

  if (status === "signedIn") return <Navigate to="/" replace />;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Shell title="Build your system." subtitle="Create an account to begin the interview.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(undefined);
          register.mutate();
        }}
        className="space-y-4"
        noValidate
      >
        <Field id="name" label="Name" autoComplete="name" value={form.display_name} onChange={set("display_name")} />
        <Field id="email" label="Email" type="email" autoComplete="email" value={form.email}
          onChange={set("email")} required />
        <Field id="password" label="Password (10+ characters)" type="password" autoComplete="new-password"
          value={form.password} onChange={set("password")} required />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>I accept the terms and the privacy notice.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-1" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
          <span>Optional: share anonymous product usage to help improve Alter Ego OS.</span>
        </label>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" loading={register.isPending}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link className="font-medium text-foreground underline" to="/login">Sign in</Link>
      </p>
    </Shell>
  );
}
