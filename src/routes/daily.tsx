import { createFileRoute } from "@tanstack/react-router";
import { Check, Pause, Play, RotateCcw, Sparkles, Sunrise, Moon, CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/daily")({
  head: () => ({
    meta: [
      { title: "Daily OS — Alter Ego OS" },
      {
        name: "description",
        content:
          "Morning brief, today's tasks, a deep work timer, practice completion and the end-of-day reflection loop.",
      },
      { property: "og:title", content: "Daily OS — Alter Ego OS" },
      {
        property: "og:description",
        content: "Run the day: brief, deep work, practices and reflection.",
      },
    ],
  }),
  component: DailyOS,
});

const blocks = [
  { id: "morning", labelKey: "daily_block_morning" },
  { id: "deep-work", labelKey: "deep_work" },
  { id: "evening", labelKey: "daily_block_evening" },
] as const;

function DeepWorkTimer() {
  const { addDeepWorkMinutes, deepWorkMinutes } = useAppState();
  const { t } = useLanguage();
  const [seconds, setSeconds] = useState(90 * 60);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setRunning(false);
            addDeepWorkMinutes(90);
            toast.success(t("daily_block_complete", "Block complete — 90 minutes logged."));
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running, addDeepWorkMinutes]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const pct = 100 - (seconds / (90 * 60)) * 100;

  return (
    <section className="card-surface p-6">
      <p className="label-eyebrow">{t("deep_work", "Deep work")}</p>
      <p className="mt-4 font-mono text-5xl tabular-nums tracking-tight">
        {mm}:{ss}
      </p>
      <Progress value={pct} className="mt-4 h-1" />
      <div className="mt-5 flex gap-2">
        <Button onClick={() => setRunning((r) => !r)} className="flex-1">
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          {running ? t("pause", "Pause") : t("daily_timer_start", "Start block")}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("daily_timer_reset_label", "Reset timer")}
          onClick={() => {
            setRunning(false);
            setSeconds(90 * 60);
          }}
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {Math.floor(deepWorkMinutes / 60)}{t("daily_hour_logged", "h")} {deepWorkMinutes % 60}{t("daily_minutes_logged", "m")} {t("daily_logged_this_week_timer", "logged this week · target 20h")}
      </p>
    </section>
  );
}

function DailyOS() {
  const { tasks, habits, toggleTask, toggleHabit, addTask, saveReflection, reflections, settings, onboardingAnswers, calendarEvents } =
    useAppState();
  const { t } = useLanguage();
  const [newTask, setNewTask] = useState("");
  const [form, setForm] = useState({ compounded: "", leaked: "", tomorrow: "" });
  const [saving, setSaving] = useState(false);
  const done = tasks.filter((t) => t.done).length;

  const sprintDay = settings.sprintDay || 1;
  const sprintTotal = settings.sprintTotal || 90;

  const getAnswer = (key: string): string => {
    const val = onboardingAnswers[key];
    if (Array.isArray(val)) return val.join(", ");
    return val || "";
  };

  const userGoal = getAnswer("q9") || getAnswer("q1");
  const userFears = getAnswer("q8");

  const dynamicBriefHeadline = userGoal
    ? `Today's Focus: ${userGoal.slice(0, 60)}${userGoal.length > 60 ? "..." : ""}`
    : "Today is a shipping day, not a planning day.";

  const dynamicBriefBody = userFears
    ? `Override your friction pattern ("${userFears.slice(0, 80)}") with your morning deep work block.`
    : "Run the protocol. Brief, blocks, practices, reflection. The day is already designed.";

  async function submitReflection() {
    if (!form.compounded.trim()) {
      toast.error(t("daily_compounded_error", "Write at least one line on what compounded today."));
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    saveReflection({ ...form, rating: 4 });
    setForm({ compounded: "", leaked: "", tomorrow: "" });
    setSaving(false);
    toast.success(t("daily_reflection_saved", "Reflection saved. The mentor will use it in Sunday's review."));
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${t("dashboard_day_info", "Day")} ${sprintDay} ${t("dashboard_of", "of")} ${sprintTotal}`}
        title={t("daily_title", "Daily Operating System")}
        description={t("daily_description", "Run the protocol one day at a time. Brief, blocks, practices, reflection.")}
      />

      <div className="card-surface rise-in mb-5 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Sunrise className="size-5" />
        </span>
        <div>
          <p className="label-eyebrow">{t("morning_brief", "Morning brief")}</p>
          <p className="mt-1.5 font-display text-xl leading-snug">{dynamicBriefHeadline}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{dynamicBriefBody}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-eyebrow">{t("today", "Today")}</p>
                <h2 className="mt-1 text-xl">
                  {done} {t("daily_of_complete", "of ... complete").replace("...", tasks.length.toString())}
                </h2>
              </div>
              <Progress value={(done / tasks.length) * 100} className="h-1.5 w-28" />
            </div>

            <Tabs defaultValue="morning" className="mt-6">
              <TabsList>
                {blocks.map((b) => (
                  <TabsTrigger key={b.id} value={b.id}>
                    {t(b.labelKey, b.labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {blocks.map((b) => {
                const list = tasks.filter((t) => t.block === b.id);
                return (
                  <TabsContent key={b.id} value={b.id} className="mt-4 space-y-2">
                    {list.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                        {t("daily_nothing_scheduled", "Nothing scheduled in this block. Protect the space or add one task.")}
                      </div>
                    )}
                    {list.map((taskItem) => (
                      <button
                        key={taskItem.id}
                        onClick={() => toggleTask(taskItem.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-all duration-200 hover:border-border-strong hover:shadow-soft",
                          taskItem.done ? "bg-surface opacity-70" : "bg-card",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            taskItem.done
                              ? "border-success bg-success text-success-foreground"
                              : "border-border-strong",
                          )}
                        >
                          {taskItem.done && <Check className="size-3" />}
                        </span>
                        <span className="flex-1">
                          <span
                            className={cn(
                              "block text-sm font-medium",
                              taskItem.done && "line-through decoration-muted-foreground",
                            )}
                          >
                            {t(`task_${taskItem.id}_title`, taskItem.title)}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {t(`task_${taskItem.id}_detail`, taskItem.detail)}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {taskItem.minutes}m
                        </span>
                      </button>
                    ))}
                  </TabsContent>
                );
              })}
            </Tabs>

            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTask.trim()) return;
                addTask(newTask.trim(), 30);
                setNewTask("");
                toast.success(t("daily_task_added", "Task added to your deep work block."));
              }}
            >
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder={t("daily_add_task_placeholder", "Add a task to today's protocol")}
              />
              <Button type="submit" variant="outline">
                {t("daily_add_btn", "Add")}
              </Button>
            </form>
          </section>

          <section className="card-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-eyebrow">{t("daily_practices", "Practices")}</p>
                <h2 className="mt-1 text-xl">{t("daily_character_in_motion", "Character in motion")}</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {habits.filter((h) => h.completedToday).length}/{habits.length} {t("daily_today_label", "today")}
              </span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {habits.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    toggleHabit(h.id);
                    if (!h.completedToday) toast.success(`${t(`habit_${h.id}_name`, h.name)} — ${t("daily_streak", "Streak")} ${h.streak + 1}`);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-soft",
                    h.completedToday
                      ? "border-success/40 bg-success/5"
                      : "border-border bg-card hover:border-border-strong",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      h.completedToday
                        ? "border-success bg-success text-success-foreground"
                        : "border-border-strong",
                    )}
                  >
                    {h.completedToday && <Check className="size-3" />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{t(`habit_${h.id}_name`, h.name)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`trait_${h.id}_name`, h.trait)} · {h.streak} {t("daily_day_streak", "day streak")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <DeepWorkTimer />

          {/* Google Calendar Synced Events */}
          <section className="card-surface p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-accent" />
                <p className="label-eyebrow">{t("settings_calendar", "Google Calendar")}</p>
              </div>
              {settings.calendarConnected && (
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                  Synced
                </span>
              )}
            </div>

            {settings.calendarConnected ? (
              <div className="mt-4 space-y-2.5">
                {calendarEvents.length > 0 ? (
                  calendarEvents.slice(0, 4).map((evt) => (
                    <div key={evt.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs">
                      <div>
                        <p className="font-medium text-foreground">{evt.title}</p>
                        <p className="text-[11px] text-muted-foreground">{evt.start} – {evt.end}</p>
                      </div>
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent capitalize">
                        {evt.category || "sync"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("daily_calendar_sync_empty", "Calendar connected. Tasks sync automatically.")}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 text-center">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("settings_calendar_not_connected", "Not connected. Connect to sync deep work blocks and the weekly review.")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => toast.info(t("settings_connect_calendar_hint", "Go to Profile & Settings to connect Google Calendar."))}
                >
                  <CalendarDays className="size-3.5" />
                  {t("settings_connect_calendar", "Connect Calendar")}
                </Button>
              </div>
            )}
          </section>

          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <Moon className="size-4 text-accent" />
              <p className="label-eyebrow">{t("daily_reflection", "End of day reflection")}</p>
            </div>
            <div className="mt-4 space-y-3">
              <Textarea
                rows={2}
                placeholder={t("daily_compounded_placeholder", "What compounded today?")}
                value={form.compounded}
                onChange={(e) => setForm({ ...form, compounded: e.target.value })}
              />
              <Textarea
                rows={2}
                placeholder={t("daily_leaked_placeholder", "What leaked?")}
                value={form.leaked}
                onChange={(e) => setForm({ ...form, leaked: e.target.value })}
              />
              <Textarea
                rows={2}
                placeholder={t("daily_tomorrow_placeholder", "Tomorrow's one thing")}
                value={form.tomorrow}
                onChange={(e) => setForm({ ...form, tomorrow: e.target.value })}
              />
              <Button className="w-full" onClick={() => void submitReflection()} disabled={saving}>
                {saving ? t("daily_saving", "Saving…") : t("daily_close_day", "Close the day")}
              </Button>
            </div>
            {reflections.length > 0 ? (
              <div className="mt-5 space-y-2 border-t border-border pt-4">
                <p className="label-eyebrow">{t("daily_recent", "Recent")}</p>
                {reflections.slice(0, 2).map((r) => (
                  <div key={r.id} className="rounded-xl bg-surface p-3">
                    <p className="text-xs text-muted-foreground">{r.date}</p>
                    <p className="mt-1 text-sm">{r.compounded}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                {t("daily_no_reflections", "No reflections logged yet. Three lines is enough.")}
              </p>
            )}
          </section>

          <section className="card-surface p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <p className="label-eyebrow">{t("daily_weekly_review", "Weekly review")}</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("daily_weekly_review_desc", "Sunday, 18:00. Your mentor will recompile the sprint against this week's adherence and rewrite next week's blocks.")}
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => toast.success(t("daily_review_scheduled", "Weekly review scheduled for Sunday 18:00."))}
            >
              {t("daily_schedule_review", "Schedule review")}
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
