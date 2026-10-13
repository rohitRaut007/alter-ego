import type { CalendarStatus, SafetyNotice } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Globe, Loader2, Shield, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";

export function SettingsPage() {
  const { api, signOut } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/me");
      if (!data) throw new Error("Could not load your account.");
      return data;
    },
  });
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.GET("/api/v1/dashboard")).data ?? null,
  });
  const personality = useQuery({
    queryKey: ["personality", "result"],
    queryFn: async () => (await api.GET("/api/v1/personality")).data ?? null,
  });
  const calendar = useQuery({
    queryKey: ["calendar"],
    queryFn: async (): Promise<{ status: CalendarStatus | null; locked: boolean }> => {
      const { data, response } = await api.GET("/api/v1/calendar");
      if (response.status === 403) return { status: null, locked: true };
      return { status: data ?? null, locked: false };
    },
  });

  const [form, setForm] = useState({ display_name: "", alter_ego_name: "", identity_statement: "" });
  const [safety, setSafety] = useState<SafetyNotice | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calEmail, setCalEmail] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (me.data) {
      setForm({
        display_name: me.data.display_name ?? "",
        alter_ego_name: me.data.alter_ego_name ?? "",
        identity_statement: me.data.identity_statement ?? "",
      });
    }
  }, [me.data]);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["me"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["calendar"] }),
    ]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const name = await api.PATCH("/api/v1/me", { body: { display_name: form.display_name.trim() } });
      if (!name.data) throw new Error("save failed");
      if (me.data?.alter_ego_name !== undefined) {
        const res = await api.PATCH("/api/v1/me/identity", {
          body: {
            ...(form.alter_ego_name.trim() ? { alter_ego_name: form.alter_ego_name.trim() } : {}),
            ...(form.identity_statement.trim()
              ? { identity_statement: form.identity_statement.trim() }
              : {}),
          },
        });
        if (res.response.status === 409) throw new Error("identity");
        return res.data ?? null;
      }
      return null;
    },
    onSuccess: async (res) => {
      if (res?.safety) {
        setSafety(res.safety);
        return;
      }
      toast.success(t("settings_protocol_updated", "Profile updated."));
      await refresh();
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "identity"
          ? t("settings_identity_error", "That identity text is not allowed. Avoid promising outcomes.")
          : t("settings_save_error", "That did not save. Please try again."),
      ),
  });

  const prefs = useMutation({
    mutationFn: async (v: { mentor_nudges?: boolean; weekly_digest?: boolean }) => {
      const { data } = await api.PATCH("/api/v1/me", { body: v });
      if (!data) throw new Error("save failed");
    },
    onSuccess: refresh,
  });

  const analytics = useMutation({
    mutationFn: async (granted: boolean) => {
      const { response } = await api.POST("/api/v1/me/consents", {
        body: { purpose: "analytics", version: "2026-10", granted },
      });
      if (!response.ok) throw new Error("save failed");
    },
    onSuccess: refresh,
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { data } = await api.POST("/api/v1/calendar", { body: { account_email: calEmail.trim() } });
      if (!data) throw new Error("connect failed");
      await api.POST("/api/v1/calendar/sync");
    },
    onSuccess: async () => {
      setCalOpen(false);
      setCalEmail("");
      toast.success(t("settings_calendar_connected_msg", "Calendar connected in demo mode."));
      await refresh();
    },
    onError: () => toast.error(t("settings_calendar_error", "Could not connect the calendar.")),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await api.DELETE("/api/v1/calendar");
    },
    onSuccess: async () => {
      toast.success(t("settings_calendar_disconnected_msg", "Calendar disconnected."));
      await refresh();
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { response } = await api.POST("/api/v1/me/reset", { body: { confirm: true } });
      if (!response.ok) throw new Error("reset failed");
    },
    onSuccess: async () => {
      setResetOpen(false);
      qc.clear();
      toast.success(t("settings_reset_success", "Protocol reset. You can start the interview again."));
      void navigate("/onboarding");
    },
    onError: () => toast.error(t("settings_reset_error", "Could not reset the protocol.")),
  });

  async function exportData() {
    try {
      const blob = await api.fetchBlob("/api/v1/me/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "alter-ego-export.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settings_export_ready", "Your data export has downloaded."));
    } catch {
      toast.error(t("settings_export_error", "The export failed. Please try again."));
    }
  }

  if (me.isPending) {
    return (
      <AppShell>
        <div role="status" className="py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
          {t("loading", "Loading")}…
        </div>
      </AppShell>
    );
  }
  if (me.isError) {
    return (
      <AppShell>
        <div className="card-surface p-6">
          <p role="alert" className="text-sm text-destructive">
            {t("settings_load_error", "We could not load your settings.")}
          </p>
        </div>
      </AppShell>
    );
  }

  const user = me.data;
  const link = calendar.data?.status?.link;
  const d = dash.data;

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("settings_account", "Account")}
        title={t("profile_settings", "Profile & Settings")}
        description={user.email}
      />

      {safety ? (
        <div className="mb-5">
          <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <User className="size-4 text-accent" />
              <p className="label-eyebrow">{t("settings_personal_protocol", "Personal protocol")}</p>
            </div>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("settings_name", "Name")}</Label>
                <Input
                  id="name"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder={t("settings_name_placeholder", "Your full name")}
                />
              </div>
              {user.alter_ego_name ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ego">{t("settings_alter_ego", "Alter ego")}</Label>
                    <Input
                      id="ego"
                      value={form.alter_ego_name}
                      onChange={(e) => setForm({ ...form, alter_ego_name: e.target.value })}
                      placeholder={t("settings_alter_ego_placeholder", "e.g. The Quiet Architect")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="statement">
                      {t("settings_identity_statement", "Identity statement")}
                    </Label>
                    <Textarea
                      id="statement"
                      rows={3}
                      value={form.identity_statement}
                      onChange={(e) => setForm({ ...form, identity_statement: e.target.value })}
                      placeholder={t("settings_identity_placeholder", "I build systems that…")}
                    />
                  </div>
                </>
              ) : null}
              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                {saveProfile.isPending
                  ? t("settings_saving", "Saving…")
                  : t("settings_save_protocol", "Save")}
              </Button>
            </div>
          </section>

          {personality.data ? (
            <section className="card-surface p-6">
              <div className="flex items-center gap-2">
                <span className="text-accent">◈</span>
                <p className="label-eyebrow">{t("settings_personality", "Personality profile (Big Five)")}</p>
              </div>
              <div className="mt-5 space-y-3">
                {Object.entries(personality.data.scores).map(([trait, score]) => (
                  <div key={trait}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">
                        {trait === "stability" ? "Emotional stability" : trait}
                      </span>
                      <span className="font-mono text-muted-foreground">{score}%</span>
                    </div>
                    <Progress value={score} className="mt-1.5 h-1" />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-accent" />
              <p className="label-eyebrow">
                {t("settings_language_localization", "Language & localization")}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("settings_interface_language", "Interface language")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("settings_language_description", "Select your preferred language.")}
                </p>
              </div>
              <LanguageSelector />
            </div>
          </section>

          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-accent" />
              <p className="label-eyebrow">{t("settings_privacy_data", "Privacy & data")}</p>
            </div>
            <div className="mt-5 space-y-4">
              {[
                {
                  id: "mentor_nudges",
                  label: t("settings_mentor_nudges", "Mentor nudges"),
                  desc: t("settings_mentor_nudges_desc", "Let the mentor message you when momentum drops or a ritual opens."),
                  checked: user.mentor_nudges ?? true,
                  onChange: (v: boolean) => prefs.mutate({ mentor_nudges: v }),
                },
                {
                  id: "analytics",
                  label: t("settings_usage_analytics", "Usage analytics"),
                  desc: t("settings_analytics_desc", "Anonymous product analytics to improve the protocol engine."),
                  checked: user.analytics_opt_in,
                  onChange: (v: boolean) => analytics.mutate(v),
                },
                {
                  id: "weekly_digest",
                  label: t("settings_weekly_digest", "Weekly digest"),
                  desc: t("settings_digest_desc", "A Sunday summary of adherence, streaks and sprint pace."),
                  checked: user.weekly_digest ?? true,
                  onChange: (v: boolean) => prefs.mutate({ weekly_digest: v }),
                },
              ].map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.desc}</p>
                  </div>
                  <Switch
                    aria-label={row.label}
                    checked={row.checked}
                    onCheckedChange={(v) => row.onChange(v)}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              <Button variant="outline" onClick={() => void exportData()}>
                {t("settings_export_data", "Export my data")}
              </Button>
              <Button variant="outline" onClick={() => setResetOpen(true)}>
                <Trash2 className="size-4" /> {t("settings_reset_protocol", "Reset protocol")}
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {d ? (
            <section className="card-surface p-5">
              <p className="label-eyebrow">{t("settings_progress", "Progress")}</p>
              <p className="mt-3 font-display text-3xl">
                {t("dashboard_day_info", "Day")} {d.day_number}
                <span className="text-lg text-muted-foreground">/{d.total_days}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {d.total_days - d.day_number} {t("settings_days_remaining", "days remaining in sprint")}
              </p>
              <div className="mt-4 space-y-3">
                {d.layers.map((l) => (
                  <div key={l.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span>{l.name}</span>
                      <span className="text-muted-foreground">{l.progress}%</span>
                    </div>
                    <Progress value={l.progress} className="mt-1.5 h-1" />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              <p className="label-eyebrow">{t("settings_calendar", "Calendar")}</p>
            </div>
            {calendar.data?.locked ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("settings_calendar_locked", "Calendar sync is part of the Full plan.")}
              </p>
            ) : (
              <>
                {link ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2">
                    <Check className="size-3.5 text-success" />
                    <span className="text-xs text-success">{link.account_email}</span>
                  </div>
                ) : null}
                <p className="mt-3 text-sm text-muted-foreground">
                  {link
                    ? calendar.data?.status?.demo_notice
                    : t("settings_calendar_not_connected", "Not connected. Connect to schedule deep work blocks and tasks.")}
                </p>
                <Button
                  variant={link ? "outline" : "default"}
                  className="mt-4 w-full"
                  disabled={disconnect.isPending}
                  onClick={() => (link ? disconnect.mutate() : setCalOpen(true))}
                >
                  {link ? t("settings_disconnect", "Disconnect") : t("settings_connect_calendar", "Connect calendar")}
                </Button>
              </>
            )}
          </section>

          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("settings_account", "Account")}</p>
            <p className="mt-3 text-sm font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              {t("settings_member_since", "Member since")} {new Date(user.created_at).toLocaleDateString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings_plan", "Plan")}: {user.tier}
            </p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => void signOut()}>
              {t("settings_sign_out", "Sign out")}
            </Button>
          </section>
        </div>
      </div>

      <Dialog open={calOpen} onOpenChange={setCalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              {t("settings_connect_calendar", "Connect calendar")}
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              {t(
                "settings_calendar_modal_desc",
                "Demo mode: your deep work blocks and tasks are scheduled inside Alter Ego OS. They are not written to Google Calendar until OAuth credentials are configured.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cal-email">{t("settings_google_account", "Google account email")}</Label>
            <Input
              id="cal-email"
              type="email"
              placeholder="you@gmail.com"
              value={calEmail}
              onChange={(e) => setCalEmail(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCalOpen(false)}>
              {t("settings_cancel", "Cancel")}
            </Button>
            <Button
              className="flex-1"
              disabled={!calEmail.trim() || connect.isPending}
              onClick={() => connect.mutate()}
            >
              {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : t("settings_authorize_connect", "Connect")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              {t("settings_reset_title", "Reset your protocol?")}
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              {t(
                "settings_reset_desc",
                "This deletes your protocol, plan, traits, reading list and milestones so you can start the interview again. Your reflections, mentor conversations and notes are kept.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setResetOpen(false)}>
              {t("settings_cancel", "Cancel")}
            </Button>
            <Button className="flex-1" disabled={reset.isPending} onClick={() => reset.mutate()}>
              {t("settings_reset_confirm", "Reset protocol")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
