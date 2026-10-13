import type { Brief, CalendarEvent, SafetyNotice, Task } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Flame, Sunrise, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { DeepWorkTimer } from "@/features/today/DeepWorkTimer";
import { ReflectionForm } from "@/features/reflection/ReflectionForm";

const BLOCKS = [
  { id: "morning", key: "block_morning", label: "Morning" },
  { id: "deep_work", key: "block_deep_work", label: "Deep work" },
  { id: "evening", key: "block_evening", label: "Evening" },
] as const;

const LAYER_LABEL: Record<string, string> = {
  identity: "Identity", character: "Character", knowledge: "Knowledge", mission: "Mission",
  daily_os: "Daily OS", presence: "Presence", legacy: "Legacy",
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DailyPage() {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [safety, setSafety] = useState<SafetyNotice | null>(null);

  const brief = useQuery({
    queryKey: ["brief"],
    queryFn: async (): Promise<Brief | null> => {
      const { data, response } = await api.GET("/api/v1/daily/brief");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load today.");
      return data;
    },
  });

  const calendar = useQuery({
    queryKey: ["calendar", "today"],
    enabled: brief.data != null,
    queryFn: async (): Promise<{ events: CalendarEvent[]; connected: boolean; locked: boolean }> => {
      const status = await api.GET("/api/v1/calendar");
      if (status.response.status === 403) return { events: [], connected: false, locked: true };
      if (!status.data?.connected) return { events: [], connected: false, locked: false };
      const today = new Date().toISOString().slice(0, 10);
      const ev = await api.GET("/api/v1/calendar/events", { params: { query: { from: today, to: today } } });
      return { events: ev.data ?? [], connected: true, locked: false };
    },
  });

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["brief"] }),
      qc.invalidateQueries({ queryKey: ["sprint"] }),
      qc.invalidateQueries({ queryKey: ["traits"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);

  const toggleTask = useMutation({
    mutationFn: async (v: { id: string; done: boolean }) => {
      const { response } = await api.PATCH("/api/v1/tasks/{id}", {
        params: { path: { id: v.id } },
        body: { done: v.done },
      });
      if (!response.ok) throw new Error("save failed");
    },
    onSuccess: invalidate,
    onError: () => toast.error(t("daily_save_error", "That did not save. Please try again.")),
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const { data } = await api.POST("/api/v1/tasks/new", {
        body: { title, detail: "", minutes: 30, block: "deep_work", layer: "mission" },
      });
      if (!data) throw new Error("save failed");
      return data;
    },
    onSuccess: async (res) => {
      if (res.safety) {
        setSafety(res.safety);
        return;
      }
      setNewTask("");
      toast.success(t("daily_task_added", "Task added to today."));
      await invalidate();
    },
    onError: () => toast.error(t("daily_save_error", "That did not save. Please try again.")),
  });

  const removeTask = useMutation({
    mutationFn: async (id: string) => {
      await api.DELETE("/api/v1/tasks/{id}", { params: { path: { id } } });
    },
    onSuccess: invalidate,
  });

  const togglePractice = useMutation({
    mutationFn: async (v: { id: string; done: boolean }) => {
      const { response } = await api.POST("/api/v1/practices/{id}/logs", {
        params: { path: { id: v.id } },
        body: { done: v.done },
      });
      if (!response.ok) throw new Error("save failed");
    },
    onSuccess: invalidate,
    onError: () => toast.error(t("daily_save_error", "That did not save. Please try again.")),
  });

  if (brief.isPending) {
    return (
      <AppShell>
        <div className="space-y-5" aria-busy="true">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }
  if (brief.isError) {
    return (
      <AppShell>
        <div className="card-surface p-6">
          <p role="alert" className="text-sm text-destructive">
            {t("daily_load_error", "We could not load today. Please try again.")}
          </p>
          <Button className="mt-4" onClick={() => void brief.refetch()}>
            {t("retry", "Retry")}
          </Button>
        </div>
      </AppShell>
    );
  }
  if (brief.data === null) {
    return (
      <AppShell>
        <PageHeader eyebrow={t("daily_os", "Daily OS")} title={t("daily_title", "Daily Operating System")} />
        <div className="card-surface p-6">
          <h2 className="text-lg font-semibold">
            {t("daily_no_protocol_title", "Your day starts with a protocol")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("daily_no_protocol", "Complete the interview and your daily system is built from your answers.")}
          </p>
          <Button asChild className="mt-4">
            <Link to="/onboarding">{t("home_start_interview", "Start the interview")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const b = brief.data;
  const open: Task[] = b.due_tasks;
  const done: Task[] = b.completed_today;
  const all = [...open, ...done];
  const total = all.length;
  const completeCount = done.length;

  const renderTask = (task: Task) => (
    <div key={task.id} className="flex items-stretch gap-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        disabled={toggleTask.isPending}
        onClick={() => toggleTask.mutate({ id: task.id, done: !task.done })}
        className={cn(
          "flex flex-1 items-start gap-3 rounded-xl border border-border p-4 text-left transition-all duration-200 hover:border-border-strong hover:shadow-soft disabled:opacity-60",
          task.done ? "bg-surface opacity-70" : "bg-card",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            task.done ? "border-success bg-success text-success-foreground" : "border-border-strong",
          )}
        >
          {task.done ? <Check className="size-3" /> : null}
        </span>
        <span className="flex-1">
          <span className={cn("block text-sm font-medium", task.done && "line-through decoration-muted-foreground")}>
            {task.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {LAYER_LABEL[task.layer] ?? task.layer}
            {task.detail ? ` · ${task.detail}` : ""}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{task.minutes}m</span>
      </button>
      {task.source === "user" ? (
        <button
          type="button"
          aria-label="Delete task"
          onClick={() => removeTask.mutate(task.id)}
          className="rounded-xl border border-border px-3 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${t("dashboard_day_info", "Day")} ${b.day_number} ${t("dashboard_of", "of")} ${b.total_days}`}
        title={t("daily_title", "Daily Operating System")}
        description={t("daily_description", "Run the protocol one day at a time. Brief, blocks, practices, reflection.")}
      />

      <div className="card-surface rise-in mb-5 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Sunrise className="size-5" />
        </span>
        <div>
          <p className="label-eyebrow">
            {t("morning_brief", "Morning brief")} · {b.alter_ego_name}
          </p>
          <p className="mt-1.5 font-display text-xl leading-snug">{b.headline}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
          {b.insight ? <p className="mt-2 text-sm leading-relaxed">{b.insight}</p> : null}
        </div>
      </div>

      {b.ritual.due ? (
        <div className="card-surface mb-5 flex items-center justify-between gap-4 border-accent/40 p-5">
          <div>
            <p className="text-sm font-semibold">{t("ritual_title", "Weekly output ritual")}</p>
            <p className="text-sm text-muted-foreground">
              {t("ritual_prompt", "Close the week in five minutes.")}
            </p>
          </div>
          <Button asChild>
            <Link to="/ritual">{t("ritual_begin", "Begin")}</Link>
          </Button>
        </div>
      ) : null}

      {safety ? (
        <div className="mb-5">
          <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-eyebrow">{t("today", "Today")}</p>
                <h2 className="mt-1 text-xl">
                  {completeCount} {t("daily_of_complete_prefix", "of")} {total}{" "}
                  {t("daily_complete_suffix", "complete")}
                </h2>
              </div>
              <div className="w-28">
                <Progress value={total ? (completeCount / total) * 100 : 0} className="h-1.5" />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {t("daily_week", "Week")} {b.week.week}: {b.week.done}/{b.week.total}
                </p>
              </div>
            </div>

            <Tabs defaultValue="deep_work" className="mt-6">
              <TabsList>
                {BLOCKS.map((blk) => (
                  <TabsTrigger key={blk.id} value={blk.id}>
                    {t(blk.key, blk.label)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {BLOCKS.map((blk) => {
                const list = all.filter((x) => x.block === blk.id);
                return (
                  <TabsContent key={blk.id} value={blk.id} className="mt-4 space-y-2">
                    {list.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                        {t("daily_nothing_scheduled", "Nothing scheduled in this block. Protect the space or add one task.")}
                      </div>
                    ) : (
                      list.map(renderTask)
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>

            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const title = newTask.trim();
                if (title) addTask.mutate(title);
              }}
            >
              <Input
                aria-label="Add a task"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder={t("daily_add_task_placeholder", "Add a task to today")}
                maxLength={200}
              />
              <Button type="submit" variant="outline" disabled={!newTask.trim() || addTask.isPending}>
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
                {b.practices.filter((p) => p.done_today).length}/{b.practices.length}{" "}
                {t("daily_today_label", "today")}
                {b.practice_streak > 0 ? ` · ${b.practice_streak}-day streak` : ""}
              </span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {b.practices.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="checkbox"
                  aria-checked={p.done_today}
                  disabled={togglePractice.isPending}
                  onClick={() => togglePractice.mutate({ id: p.id, done: !p.done_today })}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-soft disabled:opacity-60",
                    p.done_today ? "border-success/40 bg-success/5" : "border-border bg-card hover:border-border-strong",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      p.done_today ? "border-success bg-success text-success-foreground" : "border-border-strong",
                    )}
                  >
                    {p.done_today ? <Check className="size-3" /> : null}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{p.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.trait_name} · {p.minutes} min · {p.cadence}
                    </span>
                  </span>
                  {p.streak > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-accent">
                      <Flame className="size-3" aria-hidden /> {p.streak}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          <section className="card-surface p-6">
            <p className="label-eyebrow">{t("reflection_eyebrow", "Evening reflection")}</p>
            <h2 className="mt-1 text-xl">{t("daily_reflection_title", "Close the day")}</h2>
            <div className="mt-5">
              <ReflectionForm />
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <DeepWorkTimer minutesToday={b.deep_work_minutes_today} target={b.deep_work_target_minutes} />

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              <p className="label-eyebrow">{t("daily_schedule", "Schedule")}</p>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {b.schedule.map((blk) => (
                <li key={`${blk.start}-${blk.label}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                    {blk.start}–{blk.end}
                  </span>
                  <span className="flex-1">{blk.label}</span>
                </li>
              ))}
            </ul>
            {calendar.data?.connected ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("daily_calendar_events", "On your calendar today")}
                </p>
                {calendar.data.events.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("daily_calendar_empty", "Nothing synced for today yet.")}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {calendar.data.events.slice(0, 4).map((e) => (
                      <li key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-2.5 text-xs">
                        <span className="font-medium">{e.title}</span>
                        <span className="text-muted-foreground">{fmtTime(e.start)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : calendar.data && !calendar.data.locked ? (
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link to="/settings">{t("daily_connect_calendar", "Connect a calendar")}</Link>
              </Button>
            ) : null}
          </section>

          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("daily_checklist", "30-day checklist")}</p>
            <p className="mt-2 text-sm">
              {b.checklist.done} {t("daily_of_complete_prefix", "of")} {b.checklist.total}
              {b.checklist.overdue > 0 ? ` · ${b.checklist.overdue} ${t("daily_overdue", "overdue")}` : ""}
            </p>
            <Progress
              value={b.checklist.total ? (b.checklist.done / b.checklist.total) * 100 : 0}
              className="mt-3 h-1"
            />
            <Link to="/plan" className="mt-4 inline-block text-sm font-medium underline">
              {t("daily_open_plan", "Open the plan")}
            </Link>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
