import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Flame, MessageSquare, Target } from "lucide-react";
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

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import { layers, morningBrief, profile, sprint, weeklyMomentum } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Alter Ego OS" },
      {
        name: "description",
        content:
          "Your daily command centre: today's priority, the live 90-day sprint, character streaks and knowledge progress.",
      },
      { property: "og:title", content: "Dashboard — Alter Ego OS" },
      {
        property: "og:description",
        content:
          "Today's priority, your 90-day sprint and every layer of your protocol at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function getGreetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "greeting_morning";
  if (h < 18) return "greeting_afternoon";
  return "greeting_evening";
}

function Dashboard() {
  const { tasks, habits, books, toggleTask, hydrated, settings } = useAppState();
  const { t } = useLanguage();
  const priority = tasks.find((t) => t.priority) ?? tasks[0];
  const doneCount = tasks.filter((t) => t.done).length;
  const habitsDone = habits.filter((h) => h.completedToday).length;
  const readingProgress = Math.round(
    books.reduce((a, b) => a + b.progress, 0) / Math.max(books.length, 1),
  );
  const bestStreak = habits.reduce((a, h) => Math.max(a, h.streak), 0);

  if (!hydrated) {
    return (
      <AppShell>
        <div className="space-y-6">
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

  const greetingText = t(getGreetingKey(), "Good day");

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${t("dashboard_day_info", "Day")} ${sprint.day} ${t("dashboard_of", "of")} ${sprint.total}`}
        title={`${greetingText}, ${settings.displayName.split(" ")[0]}.`}
        description={t("profile_identity_statement_val", settings.identityStatement)}
        action={
          <Button asChild>
            <Link to="/mentor">
              <MessageSquare className="size-4" /> {t("ask_your_mentor", "Ask your mentor")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card-surface rise-in p-6 lg:col-span-2">
          <p className="label-eyebrow">{t("todays_priority", "Today's priority")}</p>
          <h2 className="mt-3 text-2xl leading-snug sm:text-3xl">
            {priority ? t(`task_${priority.id}_title`, priority.title) : ""}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {priority ? t(`task_${priority.id}_detail`, priority.detail) : ""}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant={priority?.done ? "secondary" : "default"}
              onClick={() => {
                if (!priority) return;
                toggleTask(priority.id);
                toast.success(
                  priority.done ? t("dashboard_marked_not_done", "Marked as not done") : t("dashboard_priority_complete", "Priority complete — that's the day won."),
                );
              }}
            >
              <Check className="size-4" />
              {priority?.done ? t("completed", "Completed") : t("mark_complete", "Mark complete")}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/daily">
                {t("open_daily_os", "Open Daily OS")} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              {priority?.minutes} min · {t("dashboard_deep_work_block", "deep work block")}
            </span>
          </div>
        </section>

        <section className="card-surface rise-in p-6">
          <p className="label-eyebrow">{t("morning_brief", "Morning brief")}</p>
          <p className="mt-3 font-display text-xl leading-snug">{t("brief_headline", morningBrief.headline)}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("brief_body", morningBrief.body)}</p>
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">{t("brief_weather", morningBrief.weather)}</p>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card-surface p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-eyebrow">{t("current_sprint", "Current sprint")}</p>
              <h3 className="mt-2 text-xl">{t("sprint_title_val", sprint.title)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("sprint_focus_val", sprint.focus)}</p>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              {Math.round((sprint.day / sprint.total) * 100)}%
            </span>
          </div>
          <Progress value={(sprint.day / sprint.total) * 100} className="mt-5 h-1.5" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {sprint.keyResults.map((kr) => (
              <div key={kr.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted-foreground">{t(`sprint_kr_${kr.id}_label`, kr.label)}</p>
                <p className="mt-2 font-display text-2xl">
                  {kr.value}
                  <span className="text-base text-muted-foreground">/{kr.target}</span>
                </p>
                <Progress value={(kr.value / kr.target) * 100} className="mt-3 h-1" />
              </div>
            ))}
          </div>
        </section>

        <section className="card-surface p-6">
          <p className="label-eyebrow">{t("dashboard_this_week", "This week")}</p>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyMomentum} margin={{ left: -28, right: 4, top: 4 }}>
                <defs>
                  <linearGradient id="dw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} h`, t("dashboard_deep_work_label", "Deep work")]}
                />
                <Area
                  type="monotone"
                  dataKey="deepWork"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#dw)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            22.2 {t("daily_hour_logged", "h")} {t("daily_logged_this_week", "logged this week · target 20h")} · 8% {t("dashboard_above_average", "above your four-week average")}.
          </p>
        </section>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: t("tasks_today", "Tasks today"),
            value: `${doneCount}/${tasks.length}`,
            icon: Check,
            to: "/daily",
          },
          {
            label: t("practices_done", "Practices done"),
            value: `${habitsDone}/${habits.length}`,
            icon: Target,
            to: "/character",
          },
          { label: t("longest_streak", "Longest streak"), value: `${bestStreak} ${t("dashboard_days", "days")}`, icon: Flame, to: "/character" },
          {
            label: t("reading_progress", "Reading progress"),
            value: `${readingProgress}%`,
            icon: ArrowRight,
            to: "/knowledge",
          },
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
          {layers.map((l) => (
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
                    l.status === "locked-in"
                      ? "bg-success/10 text-success"
                      : l.status === "active"
                        ? "bg-accent-soft text-accent"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {t(`status_${l.status.replace("-", "_")}`, l.status)}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold">{t(`layer_${l.id.replace("-", "_")}_name`, l.name)}</p>
              <Progress value={l.progress} className="mt-3 h-1" />
              <p className="mt-2 text-xs text-muted-foreground">{l.progress}% {t("dashboard_percent_built", "built")}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
