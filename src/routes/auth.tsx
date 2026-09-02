import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shield, Sparkles, Loader2, ArrowRight } from "lucide-react";
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

  useEffect(() => {
    // If user is already logged in, send them to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || email.split("@")[0],
            },
          },
        });
        if (error) throw error;
        if (data.user) {
          toast.success(t("auth_success", "Account created successfully!"));
          // Wait for trigger to create profile
          await new Promise((r) => setTimeout(r, 1000));
          navigate({ to: "/onboarding" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success(t("auth_welcome_back", "Welcome back to your system."));

        // Fetch onboarding status from profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("onboarding_completed, protocol_generated")
          .single();

        if (profileData?.protocol_generated) {
          navigate({ to: "/dashboard" });
        } else if (profileData?.onboarding_completed) {
          navigate({ to: "/protocol" });
        } else {
          navigate({ to: "/onboarding" });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("auth_auth_error", "An authentication error occurred.");
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
            {isSignUp ? t("auth_create_workspace", "Create your workspace") : t("auth_sovereignty", "Sovereignty awaits")}
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
                placeholder={t("auth_name_placeholder", "Arjun Mehta")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-surface border-border"
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
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth_password", "Password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth_password_placeholder", "••••••••")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-surface border-border"
              required
            />
          </div>

          <Button type="submit" className="w-full mt-6" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                {isSignUp ? t("auth_begin_onboarding", "Begin onboarding") : t("auth_access_os", "Access OS")}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp ? t("auth_have_account", "Already have an account? Sign in") : t("auth_new_user", "New user? Create a profile")}
          </button>
        </div>
      </div>
    </div>
  );
}
