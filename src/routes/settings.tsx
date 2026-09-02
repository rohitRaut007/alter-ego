import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Globe, Shield, Trash2, User } from "lucide-react";
import { useState } from "react";
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
import { layers, profile, sprint } from "@/lib/mock-data";

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
  const { settings, updateSettings, resetProtocol } = useAppState();
  const { t } = useLanguage();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    updateSettings(form);
    setSaving(false);
    toast.success(t("settings_protocol_updated", "Protocol updated."));
  }

  return (
    <AppShell>
      <PageHeader eyebrow={t("settings_account", "Account")} title={t("profile_settings", "Profile & Settings")} description={profile.email} />

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
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ego">{t("settings_alter_ego", "Alter ego")}</Label>
                <Input
                  id="ego"
                  value={form.alterEgo}
                  onChange={(e) => setForm({ ...form, alterEgo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statement">{t("settings_identity_statement", "Identity statement")}</Label>
                <Textarea
                  id="statement"
                  rows={3}
                  value={form.identityStatement}
                  onChange={(e) => setForm({ ...form, identityStatement: e.target.value })}
                />
              </div>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? t("settings_saving", "Saving…") : t("settings_save_protocol", "Save protocol")}
              </Button>
            </div>
          </section>

          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-accent" />
              <p className="label-eyebrow">{t("settings_language_localization", "Language & Localization")}</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("settings_interface_language", "Interface Language")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("settings_language_description", "Select your preferred system language.")}
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
              {(
                [
                  [
                    "mentorNudges",
                    t("settings_mentor_nudges", "Mentor nudges"),
                    t("settings_mentor_nudges_desc", "Let the mentor message you when a streak is at risk."),
                  ],
                  [
                    "analyticsOptIn",
                    t("settings_usage_analytics", "Usage analytics"),
                    t("settings_analytics_desc", "Anonymous product analytics to improve the protocol engine."),
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
                      toast.success(`${label} ${v ? t("settings_enabled", "enabled") : t("settings_disabled", "disabled")}.`);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              <Button
                variant="outline"
                onClick={() => toast.success(t("settings_export_preparing", "Your data export is being prepared."))}
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
          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("settings_progress", "Progress")}</p>
            <p className="mt-3 font-display text-3xl">
              {t("dashboard_day_info", "Day")} {sprint.day}
              <span className="text-lg text-muted-foreground">/{sprint.total}</span>
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

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              <p className="label-eyebrow">{t("settings_calendar", "Calendar")}</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {settings.calendarConnected
                ? t("settings_calendar_connected", "Connected. Deep work blocks are written to your calendar each morning.")
                : t("settings_calendar_not_connected", "Not connected. Connect to sync deep work blocks and the weekly review.")}
            </p>
            <Button
              variant={settings.calendarConnected ? "outline" : "default"}
              className="mt-4 w-full"
              onClick={() => {
                updateSettings({ calendarConnected: !settings.calendarConnected });
                toast.success(
                  settings.calendarConnected ? t("settings_calendar_disconnected_msg", "Calendar disconnected.") : t("settings_calendar_connected_msg", "Calendar connected."),
                );
              }}
            >
              {settings.calendarConnected ? t("settings_disconnect", "Disconnect") : t("settings_connect_calendar", "Connect calendar")}
            </Button>
          </section>

          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("settings_account", "Account")}</p>
            <p className="mt-3 text-sm">{profile.email}</p>
            <p className="text-xs text-muted-foreground">{t("settings_member_since", "Member since")} {profile.joined}</p>
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
