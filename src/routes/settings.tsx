import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Check, Globe, Loader2, Shield, Trash2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import { layers } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — Alter Ego OS" },
      {
        name: "description",
        content:
          "Your personal protocol, progress, calendar integration, privacy controls and account settings.",
      },
      { property: "og:title", content: "Profile & Settings — Alter Ego OS" },
      {
        property: "og:description",
        content: "Manage your protocol, integrations and data controls.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, updateSettings, resetProtocol, user, connectCalendar, disconnectCalendar, personalityScores } = useAppState();
  const { t } = useLanguage();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [mockCalendarEmail, setMockCalendarEmail] = useState("");

  // Keep form in sync with settings loaded from Supabase
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    updateSettings(form);
    setSaving(false);
    toast.success(t("settings_protocol_updated", "Protocol updated."));
  }

  async function handleCalendarConnect() {
    if (settings.calendarConnected) {
      disconnectCalendar();
      toast.success(t("settings_calendar_disconnected_msg", "Calendar disconnected."));
      return;
    }
    // Show mock OAuth flow modal
    setShowCalendarModal(true);
  }

  async function confirmCalendarConnect() {
    if (!mockCalendarEmail.trim()) {
      toast.error(t("settings_calendar_email_required", "Please enter your Google account email."));
      return;
    }
    setCalendarLoading(true);
    // Simulate OAuth flow delay
    await new Promise((r) => setTimeout(r, 1500));
    connectCalendar(mockCalendarEmail.trim());
    setCalendarLoading(false);
    setShowCalendarModal(false);
    setMockCalendarEmail("");
    toast.success(t("settings_calendar_connected_msg", "Calendar connected. Tasks will sync automatically."));
  }

  const sprintDay = settings.sprintDay || 1;
  const sprintTotal = settings.sprintTotal || 90;

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("settings_account", "Account")}
        title={t("profile_settings", "Profile & Settings")}
        description={settings.email || user?.email || ""}
      />

      {/* Calendar Connect Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-5">
          <div className="rise-in w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft">
                  <CalendarDays className="size-4 text-accent" />
                </span>
                <h2 className="font-semibold">{t("settings_connect_calendar", "Connect calendar")}</h2>
              </div>
              <button
                onClick={() => setShowCalendarModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("settings_calendar_modal_desc", "Enter your Google account email to authorize calendar sync. Your deep work blocks and tasks will be added to your Google Calendar automatically.")}
            </p>
            <div className="mt-5 space-y-3">
              <Label htmlFor="cal-email">{t("settings_google_account", "Google account email")}</Label>
              <Input
                id="cal-email"
                type="email"
                placeholder="you@gmail.com"
                value={mockCalendarEmail}
                onChange={(e) => setMockCalendarEmail(e.target.value)}
                className="bg-surface"
              />
              <p className="text-xs text-muted-foreground">
                {t("settings_calendar_note", "Add your Google OAuth credentials to enable full sync. Currently uses demo mode.")}
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCalendarModal(false)}>
                {t("settings_cancel", "Cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => void confirmCalendarConnect()}
                disabled={calendarLoading || !mockCalendarEmail.trim()}
              >
                {calendarLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>{t("settings_authorize_connect", "Authorize & Connect")}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Personal Protocol */}
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
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder={t("settings_name_placeholder", "Your full name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ego">{t("settings_alter_ego", "Alter ego")}</Label>
                <Input
                  id="ego"
                  value={form.alterEgo}
                  onChange={(e) => setForm({ ...form, alterEgo: e.target.value })}
                  placeholder={t("settings_alter_ego_placeholder", "e.g. The Quiet Architect")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statement">{t("settings_identity_statement", "Identity statement")}</Label>
                <Textarea
                  id="statement"
                  rows={3}
                  value={form.identityStatement}
                  onChange={(e) => setForm({ ...form, identityStatement: e.target.value })}
                  placeholder={t("settings_identity_placeholder", "I build systems that...")}
                />
              </div>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? t("settings_saving", "Saving…") : t("settings_save_protocol", "Save protocol")}
              </Button>
            </div>
          </section>

          {/* Personality Scores */}
          {personalityScores && (
            <section className="card-surface p-6">
              <div className="flex items-center gap-2">
                <span className="text-accent">◈</span>
                <p className="label-eyebrow">{t("settings_personality", "Personality profile (OCEAN)")}</p>
              </div>
              <div className="mt-5 space-y-3">
                {Object.entries(personalityScores).map(([trait, score]) => (
                  <div key={trait}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{trait === "neuroticism" ? "Emotional Stability" : trait}</span>
                      <span className="font-mono text-muted-foreground">{score}%</span>
                    </div>
                    <Progress value={score} className="mt-1.5 h-1" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Language */}
          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-accent" />
              <p className="label-eyebrow">
                {t("settings_language_localization", "Language & Localization")}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {t("settings_interface_language", "Interface Language")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings_language_description", "Select your preferred system language.")}
                </p>
              </div>
              <LanguageSelector />
            </div>
          </section>

          {/* Privacy & Data */}
          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-accent" />
              <p className="label-eyebrow">{t("settings_privacy_data", "Privacy & data")}</p>
            </div>
            <div className="mt-5 space-y-4">
              {(
                [
                  [
                    "mentorNudges",
                    t("settings_mentor_nudges", "Mentor nudges"),
                    t(
                      "settings_mentor_nudges_desc",
                      "Let the mentor message you when a streak is at risk.",
                    ),
                  ],
                  [
                    "analyticsOptIn",
                    t("settings_usage_analytics", "Usage analytics"),
                    t(
                      "settings_analytics_desc",
                      "Anonymous product analytics to improve the protocol engine.",
                    ),
                  ],
                  [
                    "weeklyDigest",
                    t("settings_weekly_digest", "Weekly digest"),
                    t("settings_digest_desc", "A Sunday summary of adherence, streaks and sprint pace."),
                  ],
                ] as const
              ).map(([key, label, desc]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={settings[key]}
                    onCheckedChange={(v) => {
                      updateSettings({ [key]: v });
                      toast.success(
                        `${label} ${v ? t("settings_enabled", "enabled") : t("settings_disabled", "disabled")}.`,
                      );
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              <Button
                variant="outline"
                onClick={() =>
                  toast.success(t("settings_export_preparing", "Your data export is being prepared."))
                }
              >
                {t("settings_export_data", "Export my data")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetProtocol();
                  toast.success(t("settings_reset_success", "Protocol reset to a fresh state."));
                }}
              >
                <Trash2 className="size-4" /> {t("settings_reset_protocol", "Reset protocol")}
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {/* Sprint Progress */}
          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("settings_progress", "Progress")}</p>
            <p className="mt-3 font-display text-3xl">
              {t("dashboard_day_info", "Day")} {sprintDay}
              <span className="text-lg text-muted-foreground">/{sprintTotal}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sprintTotal - sprintDay} {t("settings_days_remaining", "days remaining in sprint")}
            </p>
            <div className="mt-4 space-y-3">
              {layers.map((l) => (
                <div key={l.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{t(`layer_${l.id.replace("-", "_")}_name`, l.name)}</span>
                    <span className="text-muted-foreground">{l.progress}%</span>
                  </div>
                  <Progress value={l.progress} className="mt-1.5 h-1" />
                </div>
              ))}
            </div>
          </section>

          {/* Calendar Integration */}
          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              <p className="label-eyebrow">{t("settings_calendar", "Calendar")}</p>
            </div>
            {settings.calendarConnected && settings.calendarAccount ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2">
                <Check className="size-3.5 text-success" />
                <span className="text-xs text-success">{settings.calendarAccount}</span>
              </div>
            ) : null}
            <p className="mt-3 text-sm text-muted-foreground">
              {settings.calendarConnected
                ? t(
                    "settings_calendar_connected",
                    "Connected. Deep work blocks are written to your calendar each morning.",
                  )
                : t(
                    "settings_calendar_not_connected",
                    "Not connected. Connect to sync deep work blocks and the weekly review.",
                  )}
            </p>
            <Button
              variant={settings.calendarConnected ? "outline" : "default"}
              className="mt-4 w-full"
              onClick={() => void handleCalendarConnect()}
            >
              {settings.calendarConnected
                ? t("settings_disconnect", "Disconnect")
                : t("settings_connect_calendar", "Connect Google Calendar")}
            </Button>
          </section>

          {/* Account */}
          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("settings_account", "Account")}</p>
            <p className="mt-3 text-sm font-medium">{settings.email || user?.email}</p>
            {settings.memberSince && (
              <p className="text-xs text-muted-foreground">
                {t("settings_member_since", "Member since")} {settings.memberSince}
              </p>
            )}
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success(t("settings_sign_out_msg", "Signed out of this device."));
              }}
            >
              {t("settings_sign_out", "Sign out")}
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
