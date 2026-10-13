import { loginInput, registerInput } from "@alter-ego/validation";
import { ArrowRight, Eye, EyeOff, Loader2, Shield, Sparkles } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";

const CONSENT_VERSION = "2026-10";

/** Sign in and sign up on one screen, as in the legacy design. Talks to the Django API only. */
export function AuthPage({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const { api, signIn, status } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  if (status === "signedIn" && !loading) return <Navigate to="/dashboard" replace />;

  async function afterSignIn() {
    // New users go to the interview; everyone else lands on the dashboard.
    const { response } = await api.GET("/api/v1/protocols/latest");
    void navigate(response.status === 404 ? "/onboarding" : "/dashboard", { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      if (isSignUp) {
        const parsed = registerInput.safeParse({
          email,
          password,
          display_name: fullName.trim(),
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
        const { data, error: apiError } = await api.POST("/api/v1/auth/register", {
          body: parsed.data,
        });
        if (!data) {
          const first =
            apiError && typeof apiError === "object" ? Object.values(apiError)[0] : undefined;
          throw new Error(
            Array.isArray(first) ? String(first[0]) : t("auth_auth_error", "Could not create the account."),
          );
        }
        signIn(data);
        toast.success(t("auth_success", "Account created successfully!"));
        void navigate("/onboarding", { replace: true });
      } else {
        const parsed = loginInput.safeParse({ email, password });
        if (!parsed.success) {
          throw new Error(t("auth_error", "Email or password is incorrect."));
        }
        const { data, response } = await api.POST("/api/v1/auth/token", { body: parsed.data });
        if (!data) {
          throw new Error(
            response.status === 429
              ? t("auth_rate_limit", "Too many attempts. Try again shortly.")
              : t("auth_error", "Email or password is incorrect."),
          );
        }
        signIn(data);
        toast.success(t("auth_welcome_back", "Welcome back!"));
        await afterSignIn();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth_auth_error", "An authentication error occurred."));
      setLoading(false);
    }
    // On success the form stays busy: the navigation above unmounts this page, and resetting
    // `loading` here would let the signed-in redirect to /dashboard win the race.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-16">
      <div className="rise-in w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-lift sm:p-10">
        <div className="flex flex-col items-center text-center">
          <span className="mb-6 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <h1 className="text-display text-3xl font-normal tracking-tight">
            {isSignUp
              ? t("auth_create_workspace", "Create your workspace")
              : t("auth_sovereignty", "Sovereignty awaits")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignUp
              ? t("auth_start_journey", "Start the journey to engineer your personal operating system.")
              : t("auth_enter_credentials", "Enter your credentials to access your daily dashboard.")}
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4" noValidate>
          {isSignUp ? (
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("auth_full_name", "Full Name")}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t("auth_name_placeholder", "Your full name")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="border-border bg-surface"
                autoComplete="name"
                required
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth_email", "Email address")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth_email_placeholder", "name@domain.com")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-border bg-surface"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth_password", "Password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("auth_password_placeholder", "••••••••")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-border bg-surface pr-10"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {isSignUp ? (
              <p className="text-xs text-muted-foreground">
                {t("auth_password_hint", "At least 10 characters")}
              </p>
            ) : null}
          </div>

          {isSignUp ? (
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>{t("auth_accept_terms", "I accept the terms and the privacy notice.")}</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                />
                <span>
                  {t(
                    "auth_analytics_optin",
                    "Optional: share anonymous product usage to help improve Alter Ego OS.",
                  )}
                </span>
              </label>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="mt-6 w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                {isSignUp
                  ? t("auth_begin_onboarding", "Begin onboarding")
                  : t("auth_access_os", "Access OS")}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp((v) => !v);
              setError(undefined);
            }}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {isSignUp
              ? t("auth_have_account", "Already have an account? Sign in")
              : t("auth_new_user", "New user? Create a profile")}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="size-3" />
          <span>{t("auth_secured", "Encrypted at rest · Your data stays yours")}</span>
        </div>
      </div>
    </div>
  );
}
