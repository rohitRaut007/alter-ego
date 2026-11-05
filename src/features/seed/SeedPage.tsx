import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, AlertCircle, Sparkles, Clock, ShieldAlert, RefreshCw } from "lucide-react";
import { format, addMonths, addYears, addDays, isAfter, isBefore, startOfToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChoiceChips } from "@/components/ChoiceChips";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import type { FirstTask, SeedPayload } from "@/lib/api-types";

export type Situation = "know_goal" | "direction" | "change";

const SAFETY_KEYWORDS = ["burnout", "hopeless", "can't go on", "harm", "giving up", "collapse", "starve"];

export interface SeedPageProps {
  onNavigate?: (opts: { to: string }) => void;
}

export function SeedPage({ onNavigate }: SeedPageProps = {}) {
  let routerNavigate: any = null;
  try {
    routerNavigate = useNavigate();
  } catch {
    // In unit test environment without RouterProvider
  }
  const navigate = onNavigate || routerNavigate || (({ to }: { to: string }) => {});
  const { t } = useLanguage();
  const { completeOnboarding, setOnboardingAnswer } = useAppState();

  const [step, setStep] = React.useState<number>(1);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [safetyNotice, setSafetyNotice] = React.useState<string | null>(null);
  const [firstTask, setFirstTask] = React.useState<FirstTask | null>(null);

  // Form State
  const [situation, setSituation] = React.useState<Situation>("know_goal");
  const [targetStatement, setTargetStatement] = React.useState<string>("");
  const [targetDatePreset, setTargetDatePreset] = React.useState<string>("6_months");
  const [customDate, setCustomDate] = React.useState<string>("");
  const [dateError, setDateError] = React.useState<string | null>(null);

  // Explorer options
  const [explorerTrueChoice, setExplorerTrueChoice] = React.useState<string>("");

  // Time
  const [weekdayMinutes, setWeekdayMinutes] = React.useState<number>(60);
  const [weekendMinutes, setWeekendMinutes] = React.useState<number>(90);
  const [todayAvailability, setTodayAvailability] = React.useState<string>("Right now");

  const today = startOfToday();
  const minAllowedDate = addDays(today, 14);
  const maxAllowedDate = addDays(today, 730);

  // Computed target date
  const resolvedTargetDate = React.useMemo(() => {
    if (customDate) return customDate;
    if (targetDatePreset === "3_months") return format(addMonths(today, 3), "yyyy-MM-dd");
    if (targetDatePreset === "6_months") return format(addMonths(today, 6), "yyyy-MM-dd");
    if (targetDatePreset === "1_year") return format(addYears(today, 1), "yyyy-MM-dd");
    if (targetDatePreset === "2_years") return format(addYears(today, 2), "yyyy-MM-dd");
    return format(addMonths(today, 6), "yyyy-MM-dd");
  }, [customDate, targetDatePreset, today]);

  // Safety Boundary Checker
  const checkSafety = (text: string) => {
    const lower = text.toLowerCase();
    const hit = SAFETY_KEYWORDS.some((kw) => lower.includes(kw));
    if (hit) {
      setSafetyNotice(
        t(
          "safety_notice_pacing",
          "Pacing matters. Alter Ego OS emphasizes sustainable progression and healthy boundaries. Focus on steady compounding rather than destructive overwork.",
        ),
      );
    } else {
      setSafetyNotice(null);
    }
  };

  // Date validation
  const handleCustomDateChange = (val: string) => {
    setCustomDate(val);
    if (!val) {
      setDateError(null);
      return;
    }
    const parsed = new Date(val);
    if (isNaN(parsed.getTime())) {
      setDateError(t("seed_date_invalid", "Please enter a valid date."));
      return;
    }
    if (isBefore(parsed, minAllowedDate)) {
      setDateError(t("seed_date_min_error", "Target date must be at least 14 days from today."));
    } else if (isAfter(parsed, maxAllowedDate)) {
      setDateError(t("seed_date_max_error", "Target date cannot exceed 730 days (2 years)."));
    } else {
      setDateError(null);
    }
  };

  // Step 1: Situation validation
  const canProceedStep1 = Boolean(situation);

  // Step 2: Target statement validation
  const canProceedStep2 = React.useMemo(() => {
    if (dateError) return false;
    if (situation === "know_goal") {
      return targetStatement.trim().length >= 3;
    }
    // Explorer
    return Boolean(explorerTrueChoice || targetStatement.trim().length >= 3);
  }, [situation, targetStatement, explorerTrueChoice, dateError]);

  // Step 3: Time validation
  const canProceedStep3 = weekdayMinutes > 0 && weekendMinutes > 0;

  // Step 4: Today availability validation
  const canProceedStep4 = Boolean(todayAvailability);

  const handleSubmitSeed = async () => {
    setSubmitting(true);
    setError(null);

    const statement = situation === "know_goal" ? targetStatement.trim() : explorerTrueChoice || targetStatement.trim();

    const payload: SeedPayload = {
      situation,
      target_statement: statement,
      target_date: resolvedTargetDate,
      weekday_minutes: weekdayMinutes,
      weekend_minutes: weekendMinutes,
      today_minutes: 10,
      today_availability: todayAvailability,
    };

    try {
      // 1. Call real backend seed API
      const seedResult = await apiClient.seedGoal(payload);

      // 2. Synchronize local application state with server response
      setOnboardingAnswer("situation", situation);
      setOnboardingAnswer("target_statement", statement);
      setOnboardingAnswer("target_date", resolvedTargetDate);
      setOnboardingAnswer("weekday_minutes", String(weekdayMinutes));
      setOnboardingAnswer("weekend_minutes", String(weekendMinutes));
      setOnboardingAnswer("today_availability", todayAvailability);
      setOnboardingAnswer("today_minutes", "10");
      setOnboardingAnswer("q1", statement);
      setOnboardingAnswer("q9", statement);
      setOnboardingAnswer("goal", statement);

      await completeOnboarding();

      // 3. Set the first task returned from the authoritative server response
      setFirstTask(seedResult.first_task);
    } catch (err: any) {
      // Contract requirement: Handle HTTP 409 by navigating immediately to dashboard
      if (err?.status === 409 || err?.message?.includes("409") || err?.code === "GOAL_CONFLICT") {
        void navigate({ to: "/dashboard" });
        return;
      }
      // On genuine error: do not claim success, set retryable error
      setError(err?.message || t("seed_error_recoverable", "Unable to complete seed calibration. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    void navigate({ to: "/dashboard" });
  };

  // If first task is ready, show success screen with task before dashboard
  if (firstTask) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg space-y-6 rounded-3xl border border-border bg-card p-8 shadow-lift text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-7 stroke-[2]" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("seed_complete_eyebrow", "Seed calibrated")}
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("seed_first_task_ready_title", "Your initial trajectory is set")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("seed_first_task_ready_desc", "Here is your first high-leverage 10-minute action for today:")}
            </p>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Clock className="size-3.5" />
              <span>{firstTask.estimated_minutes} min · {firstTask.layer.toUpperCase()}</span>
            </div>
            <p className="text-base font-semibold text-foreground">
              {firstTask.title}
            </p>
          </div>

          <Button onClick={handleFinish} className="w-full h-11 rounded-xl text-base gap-2 font-medium">
            <span>{t("seed_go_to_dashboard", "Enter Dashboard")}</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  const progress = Math.round((step / 4) * 100);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Bar with Progress */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">Alter Ego OS</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
              Seed
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{t("step", "Step")} {step} / 4</span>
            <Progress value={progress} className="w-24 h-1.5" />
          </div>
        </div>
      </header>

      {/* Main Seed Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-xl space-y-6">
          {/* Recoverable Error Box */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{t("seed_error_title", "Calibration encountered an issue")}</p>
                <p className="mt-0.5 text-xs text-destructive/90">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubmitSeed}
                className="shrink-0 gap-1.5 text-xs"
              >
                <RefreshCw className="size-3.5" />
                {t("retry", "Retry")}
              </Button>
            </div>
          )}

          {/* Safety Notice Display (preserves current step) */}
          {safetyNotice && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300 transition-all"
            >
              <ShieldAlert className="size-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="flex-1 text-xs leading-relaxed">
                <p className="font-semibold">{t("safety_notice_title", "Health & Pacing Notice")}</p>
                <p className="mt-0.5">{safetyNotice}</p>
              </div>
            </div>
          )}

          {/* QUESTION 1: Current situation */}
          {step === 1 && (
            <div className="space-y-6 rise-in">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("seed_q1_eyebrow", "1. Current situation")}
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  {t("seed_q1_title", "Where are you with this?")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("seed_q1_subtitle", "Select the description that best captures your current position.")}
                </p>
              </div>

              <div className="space-y-3" role="radiogroup" aria-label="Current situation options">
                {[
                  {
                    id: "know_goal",
                    title: t("seed_situation_know_goal", "Know the goal"),
                    desc: t("seed_situation_know_goal_desc", "I have a specific target, milestone, or identity I am working toward."),
                  },
                  {
                    id: "direction",
                    title: t("seed_situation_direction", "Have a direction"),
                    desc: t("seed_situation_direction_desc", "I know the domain and feel the pull, but need help defining the concrete target."),
                  },
                  {
                    id: "change",
                    title: t("seed_situation_change", "Something needs to change"),
                    desc: t("seed_situation_change_desc", "Current routines are stagnating. I need a clear paradigm shift and daily structure."),
                  },
                ].map((opt) => {
                  const isSelected = situation === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSituation(opt.id as Situation)}
                      className={cn(
                        "w-full text-left rounded-2xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-foreground/20 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground text-base">{opt.title}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">{opt.desc}</p>
                        </div>
                        <div
                          className={cn(
                            "size-5 rounded-full border flex items-center justify-center shrink-0 ml-3",
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                          )}
                        >
                          {isSelected && <Check className="size-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="rounded-xl px-6 h-11 gap-2 font-medium"
                >
                  <span>{t("continue", "Continue")}</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* QUESTION 2: Target identity and date */}
          {step === 2 && (
            <div className="space-y-6 rise-in">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("seed_q2_eyebrow", "2. Target identity and horizon")}
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  {situation === "know_goal"
                    ? t("seed_q2_title_goal", "By [date], I want to be someone who...")
                    : t("seed_q2_title_explorer", "Which feels most true?")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {situation === "know_goal"
                    ? t("seed_q2_subtitle_goal", "Articulate who you are becoming and when this transformation solidifies.")
                    : t("seed_q2_subtitle_explorer", "Select the archetype that pulls you forward, or enter your own.")}
                </p>
              </div>

              {/* Defined Goal variant */}
              {situation === "know_goal" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="target-statement" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("seed_statement_label", "Identity Statement")}
                    </label>
                    <textarea
                      id="target-statement"
                      value={targetStatement}
                      onChange={(e) => {
                        setTargetStatement(e.target.value);
                        checkSafety(e.target.value);
                      }}
                      placeholder={t("seed_statement_placeholder", "e.g. ships scalable systems without friction, or writes 1,000 words of public essays every day.")}
                      rows={3}
                      className={cn(
                        "w-full rounded-2xl border border-border bg-card p-4 text-sm outline-none transition-all",
                        "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-1",
                      )}
                    />
                  </div>

                  {/* Preset Horizons */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("seed_horizon_label", "Time Horizon")}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "3_months", label: t("horizon_3m", "3 Months") },
                        { id: "6_months", label: t("horizon_6m", "6 Months") },
                        { id: "1_year", label: t("horizon_1y", "1 Year") },
                        { id: "2_years", label: t("horizon_2y", "2 Years") },
                      ].map((p) => {
                        const isSelected = !customDate && targetDatePreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setTargetDatePreset(p.id);
                              setCustomDate("");
                              setDateError(null);
                            }}
                            className={cn(
                              "rounded-xl border py-2.5 px-3 text-center text-xs font-medium transition-all cursor-pointer",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                : "border-border bg-card text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Date Input (14 - 730 days) */}
                  <div className="space-y-1.5">
                    <label htmlFor="custom-date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("seed_custom_date_label", "Or pick a specific target date (14 to 730 days from now)")}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          id="custom-date"
                          type="date"
                          value={customDate}
                          min={format(minAllowedDate, "yyyy-MM-dd")}
                          max={format(maxAllowedDate, "yyyy-MM-dd")}
                          onChange={(e) => handleCustomDateChange(e.target.value)}
                          className={cn(
                            "w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm outline-none transition-all",
                            "focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-1",
                            dateError && "border-destructive text-destructive",
                          )}
                        />
                      </div>
                    </div>
                    {dateError ? (
                      <p className="text-xs text-destructive">{dateError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("seed_target_date_selected", "Target date:")} {resolvedTargetDate}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Explorer variant: Which feels most true? */
                <div className="space-y-5">
                  <ChoiceChips
                    options={[
                      t("explorer_opt_1", "A builder who executes without waiting for permission"),
                      t("explorer_opt_2", "A craftsman with deep focus and calm boundaries"),
                      t("explorer_opt_3", "A strategist who ships and iterates in public"),
                      t("explorer_opt_4", "A disciplined operator who compounds daily habits"),
                    ]}
                    selected={explorerTrueChoice}
                    onChange={(val) => {
                      setExplorerTrueChoice(typeof val === "string" ? val : val[0] || "");
                      checkSafety(typeof val === "string" ? val : val.join(" "));
                    }}
                    variant="single"
                    allowCustom={true}
                    placeholder={t("seed_custom_explorer_placeholder", "Or describe who you want to be...")}
                    addLabel={t("add", "Add")}
                  />

                  {/* Time Horizon for Explorer */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("seed_horizon_label", "Time Horizon")}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "3_months", label: "3 Months" },
                        { id: "6_months", label: "6 Months" },
                        { id: "1_year", label: "1 Year" },
                        { id: "2_years", label: "2 Years" },
                      ].map((p) => {
                        const isSelected = targetDatePreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setTargetDatePreset(p.id)}
                            className={cn(
                              "rounded-xl border py-2.5 px-3 text-center text-xs font-medium transition-all cursor-pointer",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                : "border-border bg-card text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl px-4 gap-2">
                  <ArrowLeft className="size-4" />
                  <span>{t("back", "Back")}</span>
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="rounded-xl px-6 h-11 gap-2 font-medium"
                >
                  <span>{t("continue", "Continue")}</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* QUESTION 3: Available time */}
          {step === 3 && (
            <div className="space-y-6 rise-in">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("seed_q3_eyebrow", "3. Available time")}
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  {t("seed_q3_title", "What is your realistic daily capacity?")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("seed_q3_subtitle", "Set realistic boundaries. Alter Ego OS relies on consistent minutes over sporadic sprints.")}
                </p>
              </div>

              {/* Weekday Minutes */}
              <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{t("seed_weekday_title", "Normal Weekday")}</p>
                    <p className="text-xs text-muted-foreground">{t("seed_weekday_desc", "Minutes dedicated to goal blocks Monday–Friday")}</p>
                  </div>
                  <span className="font-mono text-lg font-bold text-primary">{weekdayMinutes} min</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[30, 45, 60, 90, 120].map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={weekdayMinutes === m}
                      onClick={() => setWeekdayMinutes(m)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                        weekdayMinutes === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekend Minutes */}
              <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{t("seed_weekend_title", "Normal Weekend Day")}</p>
                    <p className="text-xs text-muted-foreground">{t("seed_weekend_desc", "Minutes available Saturday and Sunday")}</p>
                  </div>
                  <span className="font-mono text-lg font-bold text-primary">{weekendMinutes} min</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[45, 60, 90, 120, 180].map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={weekendMinutes === m}
                      onClick={() => setWeekendMinutes(m)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                        weekendMinutes === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl px-4 gap-2">
                  <ArrowLeft className="size-4" />
                  <span>{t("back", "Back")}</span>
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!canProceedStep3}
                  className="rounded-xl px-6 h-11 gap-2 font-medium"
                >
                  <span>{t("continue", "Continue")}</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* QUESTION 4: Today's availability */}
          {step === 4 && (
            <div className="space-y-6 rise-in">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("seed_q4_eyebrow", "4. Today's availability")}
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  {t("seed_q4_title", "When can you invest 10 minutes today?")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("seed_q4_subtitle", "Momentum begins in the first 24 hours. Pick a window for your day 1 sprint kickoff.")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Today availability slots">
                {[
                  { id: "Right now", label: t("slot_now", "Right now"), sub: t("slot_now_sub", "Immediately after this calibration") },
                  { id: "Lunch break", label: t("slot_lunch", "During lunch"), sub: t("slot_lunch_sub", "Midday reset block") },
                  { id: "This afternoon", label: t("slot_afternoon", "This afternoon"), sub: t("slot_afternoon_sub", "Post-work transition") },
                  { id: "Tonight before sleep", label: t("slot_tonight", "Tonight before sleep"), sub: t("slot_tonight_sub", "Quiet evening winddown") },
                ].map((slot) => {
                  const isSelected = todayAvailability === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setTodayAvailability(slot.id)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-foreground/20 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{slot.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{slot.sub}</p>
                        </div>
                        <div
                          className={cn(
                            "size-4 rounded-full border flex items-center justify-center shrink-0",
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                          )}
                        >
                          {isSelected && <Check className="size-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)} className="rounded-xl px-4 gap-2">
                  <ArrowLeft className="size-4" />
                  <span>{t("back", "Back")}</span>
                </Button>
                <Button
                  onClick={handleSubmitSeed}
                  disabled={!canProceedStep4 || submitting}
                  className="rounded-xl px-8 h-11 gap-2 font-medium"
                >
                  {submitting ? (
                    <span>{t("seed_calibrating", "Calibrating...")}</span>
                  ) : (
                    <>
                      <span>{t("seed_complete_action", "Complete Seed")}</span>
                      <Sparkles className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default SeedPage;
