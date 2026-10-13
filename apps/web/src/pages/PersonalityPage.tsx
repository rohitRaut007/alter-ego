import type { PersonalityResult, Questionnaire } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Brain, Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LIKERT = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

const TRAIT_COLOR: Record<string, string> = {
  openness: "text-purple-500",
  conscientiousness: "text-blue-500",
  extraversion: "text-amber-500",
  agreeableness: "text-green-600",
  stability: "text-rose-500",
};

function Results({ result, q, onDone }: { result: PersonalityResult; q: Questionnaire; onDone: () => void }) {
  const { t } = useLanguage();
  const info = Object.fromEntries(q.traits.map((tr) => [tr.trait, tr]));
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-16">
      <div className="rise-in w-full max-w-2xl space-y-6">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lift sm:p-10">
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Brain className="size-5" />
          </span>
          <p className="label-eyebrow mt-6">
            {t("personality_results_eyebrow", "Your personality profile")}
          </p>
          <h1 className="text-display mt-2 text-3xl">
            {t("personality_results_title", "Assessment complete.")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t(
              "personality_results_desc",
              "Your mentor now uses this to tune its coaching. These are self-reported tendencies, not a diagnosis, and they can change as you do.",
            )}
          </p>
          <div className="mt-8 space-y-5">
            {Object.entries(result.scores).map(([trait, score]) => {
              const d = info[trait];
              return (
                <div key={trait}>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-semibold", TRAIT_COLOR[trait])}>
                      {d?.name ?? trait}
                    </span>
                    <span className="font-mono text-sm">{score}%</span>
                  </div>
                  <Progress value={score} className="mt-2 h-2" />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {d ? (score >= 60 ? d.high : d.low) : ""}
                  </p>
                </div>
              );
            })}
          </div>
          <Button size="lg" className="mt-8 w-full" onClick={onDone}>
            {t("personality_enter_dashboard", "Enter my dashboard")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PersonalityPage() {
  const { api } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<PersonalityResult | null>(null);

  const questionnaire = useQuery({
    queryKey: ["personality", "questions"],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/personality/questions");
      if (!data) throw new Error("Could not load the assessment.");
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { data } = await api.POST("/api/v1/personality", { body: { answers } });
      if (!data) throw new Error("Could not save your answers.");
      return data;
    },
    onSuccess: async (data) => {
      setResult(data);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["personality"] }),
      ]);
    },
  });

  if (questionnaire.isPending) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> {t("loading", "Loading")}…
      </div>
    );
  }
  if (questionnaire.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-destructive">
          {t("personality_load_error", "We could not load the assessment.")}
        </p>
      </div>
    );
  }

  const q = questionnaire.data;
  const total = q.questions.length;
  const answered = Object.keys(answers).length;
  const question = q.questions[current];

  if (result) {
    return <Results result={result} q={q} onDone={() => void navigate("/dashboard")} />;
  }

  function select(id: string, value: number) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setTimeout(() => setCurrent((c) => Math.min(c + 1, total - 1)), 250);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-5 py-4 sm:px-8">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Brain className="size-4" />
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">
                {t("personality_assessment", "Personality assessment")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {Math.min(current + 1, total)} / {total}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  disabled={answered === 0 || submit.isPending}
                  onClick={() => submit.mutate()}
                >
                  {t("personality_skip", "Finish now")} →
                </Button>
              </div>
            </div>
            <Progress value={(answered / total) * 100} className="mt-2 h-1" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8">
        {current === 0 && answered === 0 ? (
          <div className="rise-in mb-8 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-accent" />
              <p className="text-sm font-semibold">{t("personality_intro_title", "Before you begin")}</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t(
                "personality_intro",
                "Twenty statements about how you tend to be. Answer honestly; there are no right answers. This is a self-report, not a clinical test.",
              )}
            </p>
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="Question navigation">
          {q.questions.map((pq, idx) => (
            <button
              key={pq.id}
              type="button"
              onClick={() => setCurrent(idx)}
              aria-label={`Question ${idx + 1}`}
              className={cn(
                "size-7 rounded-full text-[10px] font-semibold transition-all",
                answers[pq.id]
                  ? "bg-accent text-accent-foreground"
                  : idx === current
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80",
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {question ? (
          <div className="rise-in rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  TRAIT_COLOR[question.trait],
                )}
              >
                {q.traits.find((tr) => tr.trait === question.trait)?.name}
              </span>
              {answers[question.id] ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check className="size-3" /> {t("personality_answered", "Answered")}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-lg leading-snug">{question.text}</h2>
            <div className="mt-6 space-y-2" role="radiogroup" aria-label={question.text}>
              {LIKERT.map((opt) => {
                const selected = answers[question.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => select(question.id, opt.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface hover:border-border-strong hover:bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-primary-foreground bg-primary-foreground" : "border-border-strong",
                      )}
                    >
                      {selected ? <Check className="size-3 text-primary" /> : null}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={current === 0}
                onClick={() => setCurrent((c) => c - 1)}
              >
                ← {t("personality_prev", "Previous")}
              </Button>
              {current < total - 1 ? (
                <Button size="sm" disabled={!answers[question.id]} onClick={() => setCurrent((c) => c + 1)}>
                  {t("personality_next", "Next")} →
                </Button>
              ) : (
                <Button size="sm" disabled={submit.isPending || answered === 0} onClick={() => submit.mutate()}>
                  {submit.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {t("personality_view_results", "View results")}
                      <ArrowRight className="ml-1 size-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {submit.isError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {t("personality_save_error", "We could not save your answers. Please try again.")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
