import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SprintPlan, FallbackTask, FallbackPatchPayload } from "@/lib/api-types";
import { mockSprintWithMilestonesAndFallbacks } from "@/test/fixtures";

export interface PlanPageProps {
  initialSprint?: SprintPlan;
  onFallbackToggle?: (taskId: string, payload: FallbackPatchPayload) => Promise<void>;
  onPlanNextTwoWeeks?: () => Promise<void>;
}

export function PlanPage({
  initialSprint = mockSprintWithMilestonesAndFallbacks,
  onFallbackToggle,
  onPlanNextTwoWeeks,
}: PlanPageProps) {
  const { t } = useLanguage();
  const [sprint, setSprint] = React.useState<SprintPlan>(initialSprint);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [planningNextTwoWeeks, setPlanningNextTwoWeeks] = React.useState<boolean>(false);
  const [togglingTaskId, setTogglingTaskId] = React.useState<string | null>(null);

  // Filter tasks for next two weeks (Week 1 and Week 2)
  const twoWeekTasks = React.useMemo(() => {
    return sprint.tasks.filter((task) => task.week_number <= 2);
  }, [sprint.tasks]);

  // Handle fallback PATCH toggle
  const handleToggle15Min = async (task: FallbackTask) => {
    const nextVal = !task.did_15_min_version;
    setTogglingTaskId(task.id);
    setError(null);

    const payload: FallbackPatchPayload = {
      did_15_min_version: nextVal,
    };

    try {
      if (onFallbackToggle) {
        await onFallbackToggle(task.id, payload);
      }
      // Optimistic update
      setSprint((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === task.id ? { ...t, did_15_min_version: nextVal } : t,
        ),
      }));
    } catch (err: any) {
      setError(err?.message || t("fallback_toggle_error", "Failed to update 15-minute fallback state."));
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handlePlanNextTwoWeeks = async () => {
    setPlanningNextTwoWeeks(true);
    setError(null);
    try {
      if (onPlanNextTwoWeeks) {
        await onPlanNextTwoWeeks();
      }
      setSprint((prev) => ({ ...prev, needs_review: false }));
    } catch (err: any) {
      setError(err?.message || t("plan_rebuild_error", "Failed to plan next two weeks."));
    } finally {
      setPlanningNextTwoWeeks(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-44 w-full rounded-3xl" />
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("plan_eyebrow", "Strategic Execution")}
        title={t("plan_title", "Sprint & Horizon Plan")}
        description={t(
          "plan_description",
          "Your 90-day milestone timeline, two-week task horizon, and if-then fallback contingencies.",
        )}
      />

      <div className="space-y-8 mt-6">
        {/* Error alert */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setError(null)}
              className="text-xs h-7 px-2"
            >
              {t("dismiss", "Dismiss")}
            </Button>
          </div>
        )}

        {/* Needs Review Rebuild Banner */}
        {sprint.needs_review && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
                <Sparkles className="size-4" />
                <span>{t("plan_needs_review_title", "Two-Week Sprint Review Due")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "plan_needs_review_desc",
                  "Your current execution cycle has reached its milestone review boundary. Calibrate and generate the next two weeks.",
                )}
              </p>
            </div>
            <Button
              onClick={handlePlanNextTwoWeeks}
              disabled={planningNextTwoWeeks}
              className="rounded-xl px-5 gap-2 shrink-0 font-medium"
            >
              <RefreshCw className={cn("size-3.5", planningNextTwoWeeks && "animate-spin")} />
              <span>{t("plan_next_two_weeks_btn", "Plan the next two weeks")}</span>
            </Button>
          </div>
        )}

        {/* 1. Milestone Timeline ending at target date */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-eyebrow">{t("plan_milestones_eyebrow", "Horizon Architecture")}</p>
              <h3 className="text-xl font-semibold tracking-tight">{t("milestone_timeline", "Milestone Timeline")}</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Calendar className="size-3.5" />
              <span>{t("target_date_label", "Target:")} {sprint.target_date}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {sprint.milestones.map((m, idx) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all space-y-2",
                  m.status === "completed"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">0{idx + 1}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      m.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug">{m.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{m.target_date}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Tasks for the Next Two Weeks with Milestone and Fallback Plan */}
        <section className="space-y-4">
          <div>
            <p className="label-eyebrow">{t("plan_twoweek_eyebrow", "Immediate Focus")}</p>
            <h3 className="text-xl font-semibold tracking-tight">{t("plan_twoweek_title", "Next Two Weeks Tasks")}</h3>
          </div>

          {twoWeekTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-xs text-muted-foreground">
              {t("no_tasks_two_weeks", "No active tasks in this 14-day window.")}
            </div>
          ) : (
            <div className="space-y-3">
              {twoWeekTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-border bg-card p-5 space-y-3 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                          Week {task.week_number}
                        </span>
                        {task.milestone_title && (
                          <span className="text-xs font-medium text-primary">
                            ↳ {task.milestone_title}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-semibold text-foreground">{task.title}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">
                        {task.estimated_minutes} min
                      </span>
                    </div>
                  </div>

                  {/* If-Then Fallback Plan and 15-Minute Version Toggle */}
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground/80 uppercase tracking-wide text-[10px]">
                        {t("if_then_fallback_label", "If-Then Fallback:")}
                      </span>
                      <p className="text-muted-foreground">{task.fallback_plan}</p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={task.did_15_min_version}
                      aria-label="Did 15-minute version"
                      disabled={togglingTaskId === task.id}
                      onClick={() => handleToggle15Min(task)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-medium transition-all cursor-pointer shrink-0",
                        task.did_15_min_version
                          ? "border-primary bg-primary/10 text-primary shadow-2xs"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {task.did_15_min_version ? (
                        <ToggleRight className="size-4 text-primary" />
                      ) : (
                        <ToggleLeft className="size-4" />
                      )}
                      <span>{t("did_15_min_version", "Did 15-min version")}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. Later Weeks: Theme and Expected Outcome Only (No invented detailed tasks) */}
        {sprint.later_weeks && sprint.later_weeks.length > 0 && (
          <section className="space-y-4">
            <div>
              <p className="label-eyebrow">{t("plan_later_weeks_eyebrow", "Downstream Horizons")}</p>
              <h3 className="text-xl font-semibold tracking-tight">{t("plan_later_weeks_title", "Later Weeks Roadmap")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "plan_later_weeks_subtitle",
                  "Later cycles show high-level themes and outcomes. Detailed tasks are calibrated every 14 days.",
                )}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {sprint.later_weeks.map((lw) => (
                <div
                  key={lw.week_number}
                  className="rounded-2xl border border-dashed border-border bg-card/60 p-5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-muted-foreground">
                      Week {lw.week_number}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                      Theme
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{lw.theme}</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <span className="font-medium text-foreground/80">{t("expected_outcome", "Expected Outcome:")} </span>
                    <span>{lw.expected_outcome}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

export default PlanPage;

