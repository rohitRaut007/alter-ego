import type { Dashboard } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Brain, Check, Flame, MessageSquare, Target } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "greeting_morning";
  if (h < 18) return "greeting_afternoon";
  return "greeting_evening";
}

const STATUS_CLASS = {
  locked_in: "bg-success/10 text-success",
  active: "bg-accent-soft text-accent",
  calibrating: "bg-secondary text-muted-foreground",
} as const;

export function DashboardPage() {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<Dashboard | null> => {
      const { data, response } = await api.GET("/api/v1/dashboard");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load the dashboard.");
      return data;
    },
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.GET("/api/v1/me")).data ?? null,
  });

  const toggle = useMutation({
    mutationFn: async (v: { id: string; done: boolean }) => {
      const { response } = await api.PATCH("/api/v1/tasks/{id}", {
        params: { path: { id: v.id } },
        body: { done: v.done },
      });
      if (!response.ok) throw new Error("save failed");
    },
    onSuccess: async () => {
      toast.success(t("dashboard_priority_complete", "Priority complete. That is the day won."));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
      ]);
    },
    onError: () => toast.error(t("dashboard_save_error", "That did not save. Please try again.")),
  });

  if (dash.isPending) {
    return (
      <AppShell>
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (dash.isError) {
    return (
      <AppShell>
        <div className="card-surface p-6">
          <p role="alert" className="text-sm text-destructive">
            {t("dashboard_load_error", "We could not load your dashboard.")}
          </p>
          <Button className="mt-4" onClick={() => void dash.refetch()}>
            {t("retry", "Retry")}
          </Button>
        </div>
      </AppShell>
    );
  }

  if (dash.data === null) {
    return (
      <AppShell>
        <PageHeader
          eyebrow={t("app_name", "Alter Ego OS")}
          title={`${t(greetingKey(), "Good day")}, ${me.data?.display_name?.split(" ")[0] || "Builder"}.`}
        />
        <section className="card-surface p-6">
          <h2 className="text-xl">{t("home_begin_interview", "Begin the interview")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t(
              "home_interview_desc",
              "A conversation about your ambition, position, working style and the patterns you want to design around. Set aside 15 to 25 minutes.",
            )}
          </p>
          <Button asChild className="mt-5">
            <Link to="/onboarding">
              {t("home_start_interview", "Start the interview")} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </AppShell>
    );
  }

  const d = dash.data;
  const first = me.data?.display_name?.split(" ")[0] || "Builder";
  const priority = d.priority_task;

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${t("dashboard_day_info", "Day")} ${d.day_number} ${t("dashboard_of", "of")} ${d.total_days}`}
        title={`${t(greetingKey(), "Good day")}, ${first}.`}
        description={d.identity_statement}
        action={
          <Button asChild>
            <Link to="/mentor">
              <MessageSquare className="size-4" /> {t("ask_your_mentor", "Ask your mentor")}
              {d.unread_nudges > 0 ? (
                <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] text-accent-foreground">
                  {d.unread_nudges}
                </span>
              ) : null}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card-surface rise-in p-6 lg:col-span-2">
          <p className="label-eyebrow">{t("todays_priority", "Today's priority")}</p>
          {priority ? (
            <>
              <h2 className="mt-3 text-2xl leading-snug sm:text-3xl">{priority.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{priority.detail}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  variant={priority.done ? "secondary" : "default"}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: priority.id, done: !priority.done })}
                >
                  <Check className="size-4" />
                  {priority.done ? t("completed", "Completed") : t("mark_complete", "Mark complete")}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/daily">
                    {t("open_daily_os", "Open Daily OS")} <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">{priority.minutes} min</span>
              </div>
            </>
          ) : (
            <div className="mt-6 text-muted-foreground">
              <p className="text-lg">{t("dashboard_all_done", "All tasks complete.")}</p>
              <p className="mt-2 text-sm">
                {t("dashboard_all_done_desc", "Reflect and plan tomorrow.")}
              </p>
            </div>
          )}
        </section>

        <section className="card-surface rise-in p-6">
          <p className="label-eyebrow">{t("morning_brief", "Morning brief")}</p>
          <p className="mt-3 font-display text-xl leading-snug">{d.headline}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{d.body}</p>
          {d.insight ? <p className="mt-3 text-sm leading-relaxed">{d.insight}</p> : null}
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            {t("dashboard_day_info", "Day")} {d.day_number} {t("dashboard_of", "of")} {d.total_days} ·{" "}
            {d.total_days - d.day_number} {t("settings_days_remaining", "days remaining")}
          </p>
        </section>
      </div>

      <section className="card-surface rise-in mt-5 border border-accent/20 bg-accent/5 p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Brain className="size-5" />
            </span>
            <div>
              <p className="label-eyebrow text-accent">
                {t("personality_assessment", "Personality assessment")}
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                {d.personality_completed
                  ? t("dashboard_personality_completed_title", "Your mentor is calibrated to your Big Five profile.")
                  : t("dashboard_personality_pending_title", "Calibrate your mentor with the Big Five assessment")}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {d.personality_completed
                  ? t("dashboard_personality_completed_desc", "You can retake it any time as you change.")
                  : t("dashboard_personality_pending_desc", "Twenty quick questions tune the mentor's coaching style.")}
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/personality">
              <Brain className="size-4" />
              {d.personality_completed
                ? t("personality_view_results", "View assessment")
                : t("personality_take_test", "Take assessment")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card-surface p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-eyebrow">{t("current_sprint", "Current sprint")}</p>
              <h3 className="mt-2 text-xl">
                {t("dashboard_sprint", "Sprint")} · {t("dashboard_day_info", "Day")} {d.day_number}{" "}
                {t("dashboard_of", "of")} {d.total_days}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.sprint_goal}</p>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              {d.sprint_percent}%
            </span>
          </div>
          <Progress value={d.sprint_percent} className="mt-5 h-1.5" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {d.key_results.map((kr) => (
              <div key={kr.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted-foreground">{kr.label}</p>
                <p className="mt-2 font-display text-2xl">
                  {kr.value}
                  {kr.suffix}
                  <span className="text-base text-muted-foreground">
                    /{kr.target}
                    {kr.suffix}
                  </span>
                </p>
                <Progress value={(kr.value / Math.max(kr.target, 1)) * 100} className="mt-3 h-1" />
              </div>
            ))}
          </div>
        </section>

        <section className="card-surface p-6">
          <p className="label-eyebrow">{t("dashboard_this_week", "This week")}</p>
          <div className="mt-4 h-40" role="img" aria-label="Deep work hours for the last seven days">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.weekly_momentum} margin={{ left: -28, right: 4, top: 4 }}>
                <defs>
                  <linearGradient id="dw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false}
                       tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false}
                       tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)",
                                  background: "var(--card)", fontSize: 12 }}
                  formatter={(v) => [`${v} h`, t("dashboard_deep_work_label", "Deep work")]}
                />
                <Area type="monotone" dataKey="deep_work_hours" stroke="var(--accent)"
                      strokeWidth={2} fill="url(#dw)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("tasks_today", "Tasks today"),
            value: `${d.stats.tasks_done_today}/${d.stats.tasks_due_today}`, icon: Check, to: "/daily" },
          { label: t("practices_done", "Practices done"),
            value: `${d.stats.practices_done}/${d.stats.practices_total}`, icon: Target, to: "/character" },
          { label: t("longest_streak", "Longest streak"),
            value: `${d.stats.longest_streak} ${t("dashboard_days", "days")}`, icon: Flame, to: "/character" },
          { label: t("reading_progress", "Reading progress"),
            value: `${d.stats.reading_progress}%`, icon: ArrowRight, to: "/knowledge" },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="card-surface group p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <s.icon className="size-4 text-accent" />
            </div>
            <p className="mt-3 font-display text-3xl">{s.value}</p>
          </Link>
        ))}
      </div>

      <section className="mt-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="label-eyebrow">{t("dashboard_protocol", "Protocol")}</p>
            <h3 className="mt-1 text-xl">{t("seven_layers", "Seven layers")}</h3>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/protocol">
              {t("view_all", "View all")} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.layers.map((l) => (
            <Link
              key={l.id}
              to="/protocol"
              className="card-surface group p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">0{l.index}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    STATUS_CLASS[l.status],
                  )}
                >
                  {t(`status_${l.status}`, l.status.replace("_", " "))}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold">{l.name}</p>
              <Progress value={l.progress} className="mt-3 h-1" />
              <p className="mt-2 text-xs text-muted-foreground">
                {l.progress}% {t("dashboard_percent_built", "built")}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
