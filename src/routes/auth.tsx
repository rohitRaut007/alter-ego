import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shield, Sparkles, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sovereignty Awaits — Alter Ego OS" },
      {
        name: "description",
        content: "Authenticate to access your personal transformation operating system.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // If user is already logged in, send them to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  async function ensureProfileExists(userId: string, name: string, email: string) {
    // Try to upsert the profile to ensure it exists with correct data
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        full_name: name,
        email: email,
        onboarding_completed: false,
        protocol_generated: false,
        personality_test_completed: false,
      },
      { onConflict: "user_id", ignoreDuplicates: false },
    );
    if (error) {
      console.warn("Profile upsert warning:", error);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    if (isSignUp && !fullName.trim()) {
      toast.error(t("auth_name_required", "Please enter your full name."));
      return;
    }

    if (password.length < 6) {
      toast.error(t("auth_password_too_short", "Password must be at least 6 characters."));
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const name = fullName.trim() || email.split("@")[0]!;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) {
          if (error.message.includes("User already registered")) {
            // User exists, try signing in with password
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (signInError) {
              toast.error(t("auth_already_registered", "An account with this email already exists. Incorrect password."));
              return;
            }
            if (signInData.user) {
              toast.success(t("auth_welcome_back", "Welcome back!"));
              void navigate({ to: "/onboarding" });
              return;
            }
          }
          throw error;
        }

        if (data.user) {
          await ensureProfileExists(data.user.id, name, email);

          // If auto-confirm is enabled, session exists
          if (data.session) {
            toast.success(t("auth_success", "Account created successfully!"));
            await new Promise((r) => setTimeout(r, 600));
            void navigate({ to: "/onboarding" });
          } else {
            // Attempt auto signInWithPassword
            const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (!signInErr && signInData.session) {
              toast.success(t("auth_success", "Account created & logged in!"));
              void navigate({ to: "/onboarding" });
            } else {
              toast.info(t("auth_email_confirm_sent", "Account created! If email confirmation is enabled, check your inbox to activate, or sign in below."));
              setIsSignUp(false);
            }
          }
        }
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        toast.success(t("auth_welcome_back", "Welcome back to your system."));

        if (!signInData.user) {
          void navigate({ to: "/onboarding" });
          return;
        }

        // Fetch onboarding status from profile using user_id filter
        const { data: profileData } = await supabase
          .from("profiles")
          .select("onboarding_completed, protocol_generated, personality_test_completed")
          .eq("user_id", signInData.user.id)
          .maybeSingle();

        if (!profileData) {
          await ensureProfileExists(
            signInData.user.id,
            (signInData.user.user_metadata as Record<string, string> | undefined)?.[
              "full_name"
            ] || email.split("@")[0]!,
            email,
          );
          void navigate({ to: "/onboarding" });
          return;
        }

        if (profileData.protocol_generated) {
          void navigate({ to: "/dashboard" });
        } else if (profileData.onboarding_completed) {
          void navigate({ to: "/personality" });
        } else {
          void navigate({ to: "/onboarding" });
        }
      }
    } catch (err: unknown) {
      let message = t("auth_auth_error", "An authentication error occurred.");
      if (err instanceof Error) {
        if (err.message.includes("Invalid login credentials")) {
          message = t("auth_error", "Email or password is incorrect. Check your credentials or confirm your email.");
        } else if (err.message.includes("Email not confirmed")) {
          message = t("auth_email_not_confirmed", "Please check your email inbox and confirm your account.");
        } else if (err.message.includes("User already registered")) {
          message = t("auth_already_registered", "An account with this email already exists. Switched to Sign In.");
          setIsSignUp(false);
        } else if (err.message.includes("rate limit") || err.message.includes("429") || err.message.includes("Too Many Requests")) {
          message = t("auth_rate_limit", "Supabase signup limit reached (too many attempts). Switched to Sign In or use Instant Demo below.");
          setIsSignUp(false);
        } else {
          message = err.message;
        }
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-16">
      <div className="rise-in w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-lift sm:p-10">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-6">
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
              : t("auth_enter_credentials", "Enter your key credentials to access your daily dashboard.")}
          </p>
        </div>

        <form onSubmit={handleAuth} className="mt-8 space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("auth_full_name", "Full Name")}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t("auth_name_placeholder", "Your full name")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-surface border-border"
                autoComplete="name"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth_email", "Email address")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth_email_placeholder", "name@domain.com")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surface border-border"
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
                className="bg-surface border-border pr-10"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {isSignUp && (
              <p className="text-xs text-muted-foreground">
                {t("auth_password_hint", "Minimum 6 characters")}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full mt-6" disabled={loading}>
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

        <div className="mt-4 flex flex-col gap-3 text-center border-t border-border pt-4">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setEmail("");
              setPassword("");
              setFullName("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp
              ? t("auth_have_account", "Already have an account? Sign in")
              : t("auth_new_user", "New user? Create a profile")}
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full mt-1 border-dashed"
            onClick={() => {
              toast.success("Entering Instant Demo Mode...");
              void navigate({ to: "/onboarding" });
            }}
          >
            <Sparkles className="size-3.5 mr-1.5 text-accent" />
            {t("auth_instant_demo", "Instant Demo Access (Skip Auth)")}
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="size-3" />
          <span>{t("auth_secured", "Secured by Supabase · Your data stays yours")}</span>
        </div>
      </div>
    </div>
  );
}
