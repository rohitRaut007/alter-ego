import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Shield, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/lib/app-state";
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
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    updateSettings(form);
    setSaving(false);
    toast.success("Protocol updated.");
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Account" title="Profile & Settings" description={profile.email} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <User className="size-4 text-accent" />
              <p className="label-eyebrow">Personal protocol</p>
            </div>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ego">Alter ego</Label>
                <Input
                  id="ego"
                  value={form.alterEgo}
                  onChange={(e) => setForm({ ...form, alterEgo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statement">Identity statement</Label>
                <Textarea
                  id="statement"
                  rows={3}
                  value={form.identityStatement}
                  onChange={(e) => setForm({ ...form, identityStatement: e.target.value })}
                />
              </div>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save protocol"}
              </Button>
            </div>
          </section>

          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-accent" />
              <p className="label-eyebrow">Privacy & data</p>
            </div>
            <div className="mt-5 space-y-4">
              {([
                ["mentorNudges", "Mentor nudges", "Let the mentor message you when a streak is at risk."],
                ["analyticsOptIn", "Usage analytics", "Anonymous product analytics to improve the protocol engine."],
                ["weeklyDigest", "Weekly digest", "A Sunday summary of adherence, streaks and sprint pace."],
              ] as const).map(([key, label, desc]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={settings[key]}
                    onCheckedChange={(v) => {
                      updateSettings({ [key]: v });
                      toast.success(`${label} ${v ? "enabled" : "disabled"}.`);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              <Button
                variant="outline"
                onClick={() => toast.success("Your data export is being prepared.")}
              >
                Export my data
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetProtocol();
                  toast.success("Protocol reset to a fresh state.");
                }}
              >
                <Trash2 className="size-4" /> Reset protocol
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <p className="label-eyebrow">Progress</p>
            <p className="mt-3 font-display text-3xl">
              Day {sprint.day}
              <span className="text-lg text-muted-foreground">/{sprint.total}</span>
            </p>
            <div className="mt-4 space-y-3">
              {layers.map((l) => (
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

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              <p className="label-eyebrow">Calendar</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {settings.calendarConnected
                ? "Connected. Deep work blocks are written to your calendar each morning."
                : "Not connected. Connect to sync deep work blocks and the weekly review."}
            </p>
            <Button
              variant={settings.calendarConnected ? "outline" : "default"}
              className="mt-4 w-full"
              onClick={() => {
                updateSettings({ calendarConnected: !settings.calendarConnected });
                toast.success(
                  settings.calendarConnected ? "Calendar disconnected." : "Calendar connected.",
                );
              }}
            >
              {settings.calendarConnected ? "Disconnect" : "Connect calendar"}
            </Button>
          </section>

          <section className="card-surface p-5">
            <p className="label-eyebrow">Account</p>
            <p className="mt-3 text-sm">{profile.email}</p>
            <p className="text-xs text-muted-foreground">Member since {profile.joined}</p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success("Signed out of this device.");
              }}
            >
              Sign out
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
