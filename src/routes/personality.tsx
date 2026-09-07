import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Brain, Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAppState } from "@/lib/app-state";
import type { PersonalityScores } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/personality")({
  head: () => ({
    meta: [
      { title: "Personality Assessment — Alter Ego OS" },
      {
        name: "description",
        content:
          "A scientifically validated Big Five personality assessment to personalize your AI Mentor and protocol.",
      },
    ],
  }),
  component: PersonalityTest,
});

interface Question {
  id: string;
  text: string;
  trait: keyof PersonalityScores;
  reversed: boolean;
}

const personalityQuestions: Question[] = [
  // Openness
  { id: "p1", text: "I enjoy exploring new ideas and abstract thinking.", trait: "openness", reversed: false },
  { id: "p2", text: "I prefer routine and familiar activities over novelty.", trait: "openness", reversed: true },
  { id: "p3", text: "I have a vivid imagination and enjoy creative work.", trait: "openness", reversed: false },
  { id: "p4", text: "I like to try new approaches rather than following established methods.", trait: "openness", reversed: false },

  // Conscientiousness
  { id: "p5", text: "I always complete tasks thoroughly and on time.", trait: "conscientiousness", reversed: false },
  { id: "p6", text: "I find it easy to stay organized and plan ahead.", trait: "conscientiousness", reversed: false },
  { id: "p7", text: "I often procrastinate and leave things to the last minute.", trait: "conscientiousness", reversed: true },
  { id: "p8", text: "I pay attention to detail and take pride in my work quality.", trait: "conscientiousness", reversed: false },
  { id: "p9", text: "I set ambitious goals and systematically work toward them.", trait: "conscientiousness", reversed: false },

  // Extraversion
  { id: "p10", text: "I feel energized after spending time with people.", trait: "extraversion", reversed: false },
  { id: "p11", text: "I prefer working alone and find social interaction draining.", trait: "extraversion", reversed: true },
  { id: "p12", text: "I'm comfortable speaking up in groups and taking leadership.", trait: "extraversion", reversed: false },
  { id: "p13", text: "I recharge by spending time in solitude and reflection.", trait: "extraversion", reversed: true },

  // Agreeableness
  { id: "p14", text: "I go out of my way to help others, even at cost to myself.", trait: "agreeableness", reversed: false },
  { id: "p15", text: "I tend to be competitive rather than cooperative.", trait: "agreeableness", reversed: true },
  { id: "p16", text: "I trust people's good intentions and give them benefit of the doubt.", trait: "agreeableness", reversed: false },
  { id: "p17", text: "I can be critical and demanding in my standards for others.", trait: "agreeableness", reversed: true },

  // Neuroticism
  { id: "p18", text: "I remain calm and stable even under significant pressure.", trait: "neuroticism", reversed: true },
  { id: "p19", text: "I experience mood swings and emotional ups and downs.", trait: "neuroticism", reversed: false },
  { id: "p20", text: "I worry often about things that could go wrong.", trait: "neuroticism", reversed: false },
];

const likertOptions = [
  { value: 1, label: "Strongly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly Agree" },
];

const traitDescriptions: Record<keyof PersonalityScores, { name: string; high: string; low: string; color: string }> = {
  openness: {
    name: "Openness",
    high: "Highly curious, creative, and open to new experiences. You thrive on novelty, abstract thinking, and unconventional approaches.",
    low: "Practical, conventional, and focused. You prefer proven methods and clear, concrete goals over abstract experimentation.",
    color: "text-purple-400",
  },
  conscientiousness: {
    name: "Conscientiousness",
    high: "Highly organized, disciplined, and goal-driven. Your protocol will emphasize systems, structure, and accountability.",
    low: "Flexible and spontaneous. Your protocol will focus on building structure gradually without rigid constraints.",
    color: "text-blue-400",
  },
  extraversion: {
    name: "Extraversion",
    high: "Energized by social interaction and external stimulation. Your presence layer will emphasize public work and collaboration.",
    low: "Energized by solitude and deep focus. Your protocol will protect deep work blocks and limit social obligation.",
    color: "text-amber-400",
  },
  agreeableness: {
    name: "Agreeableness",
    high: "Cooperative, empathetic, and relationship-focused. Your mission layer will align individual goals with collective impact.",
    low: "Direct, results-focused, and independent. Your protocol will prioritize personal sovereignty and competitive advantage.",
    color: "text-green-400",
  },
  neuroticism: {
    name: "Emotional Stability",
    high: "Emotionally stable and resilient under pressure. Your protocol trusts your consistency.",
    low: "Emotionally sensitive and reactive to stress. Your daily OS will include recovery protocols and emotional regulation practices.",
    color: "text-rose-400",
  },
};

function computeScores(answers: Record<string, number>): PersonalityScores {
  const traitAnswers: Record<keyof PersonalityScores, number[]> = {
    openness: [],
    conscientiousness: [],
    extraversion: [],
    agreeableness: [],
    neuroticism: [],
  };

  for (const q of personalityQuestions) {
    const raw = answers[q.id];
    if (raw === undefined) continue;
    const score = q.reversed ? 6 - raw : raw;
    traitAnswers[q.trait].push(score);
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? 50 : Math.round(((arr.reduce((a, b) => a + b, 0) / arr.length - 1) / 4) * 100);

  return {
    openness: avg(traitAnswers.openness),
    conscientiousness: avg(traitAnswers.conscientiousness),
    extraversion: avg(traitAnswers.extraversion),
    agreeableness: avg(traitAnswers.agreeableness),
    // Invert neuroticism for display (higher = more stable)
    neuroticism: 100 - avg(traitAnswers.neuroticism),
  };
}

function PersonalityTest() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { savePersonalityScores, settings } = useAppState();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<PersonalityScores | null>(null);

  const progress = Math.round((currentQ / personalityQuestions.length) * 100);
  const q = personalityQuestions[currentQ];
  const allAnswered = Object.keys(answers).length === personalityQuestions.length;

  function selectAnswer(questionId: string, value: number) {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    // Auto-advance to next question after a short delay
    setTimeout(() => {
      if (currentQ < personalityQuestions.length - 1) {
        setCurrentQ((prev) => prev + 1);
      }
    }, 300);
  }

  async function submitTest() {
    setSaving(true);
    const filledAnswers = { ...answers };
    for (const qItem of personalityQuestions) {
      if (filledAnswers[qItem.id] === undefined) {
        filledAnswers[qItem.id] = 3;
      }
    }
    const scores = computeScores(filledAnswers);
    await savePersonalityScores(scores);
    setResults(scores);
    setSaving(false);
  }

  function skipToDashboard() {
    const scores = computeScores(answers);
    void savePersonalityScores(scores);
    void navigate({ to: "/dashboard" });
  }

  if (results) {
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
                "Your AI Mentor and daily protocol are now calibrated to your personality profile. These scores will evolve as you grow.",
              )}
            </p>

            <div className="mt-8 space-y-5">
              {(Object.keys(results) as (keyof PersonalityScores)[]).map((trait) => {
                const score = results[trait];
                const desc = traitDescriptions[trait];
                return (
                  <div key={trait}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm font-semibold", desc.color)}>{desc.name}</span>
                      <span className="font-mono text-sm">{score}%</span>
                    </div>
                    <Progress value={score} className="mt-2 h-2" />
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {score >= 60 ? desc.high : desc.low}
                    </p>
                  </div>
                );
              })}
            </div>

            <Button
              size="lg"
              className="mt-8 w-full"
              onClick={() => void navigate({ to: "/dashboard" })}
            >
              {t("personality_enter_dashboard", "Enter my dashboard")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-5 py-4 sm:px-8">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Brain className="size-4" />
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">
                {t("personality_assessment", "Personality Assessment")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {Math.min(currentQ + 1, personalityQuestions.length)} /{" "}
                  {personalityQuestions.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={skipToDashboard}
                >
                  {t("personality_skip", "Skip to Dashboard")} →
                </Button>
              </div>
            </div>
            <Progress value={progress} className="mt-2 h-1" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8">
        {/* Intro */}
        {currentQ === 0 && (
          <div className="mb-8 rise-in rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-accent" />
              <p className="text-sm font-semibold">{settings.displayName || "Welcome"}</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t(
                "personality_intro",
                "This 20-question Big Five assessment will help personalize your AI Mentor, daily protocol, and recommendations. Answer honestly — there are no right or wrong answers.",
              )}
            </p>
          </div>
        )}

        {/* Question navigation chips */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {personalityQuestions.map((pq, idx) => (
            <button
              key={pq.id}
              onClick={() => setCurrentQ(idx)}
              className={cn(
                "size-7 rounded-full text-[10px] font-semibold transition-all",
                answers[pq.id]
                  ? "bg-accent text-accent-foreground"
                  : idx === currentQ
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80",
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {/* Current question */}
        {q && (
          <div className="rise-in rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-1 flex items-center gap-2">
              <span className={cn("text-xs font-semibold uppercase tracking-wide", traitDescriptions[q.trait].color)}>
                {traitDescriptions[q.trait].name}
              </span>
              {answers[q.id] && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check className="size-3" /> Answered
                </span>
              )}
            </div>
            <h2 className="mt-3 text-lg leading-snug">{q.text}</h2>

            <div className="mt-6 space-y-2">
              {likertOptions.map((opt) => {
                const isSelected = answers[q.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => selectAnswer(q.id, opt.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface hover:border-border-strong hover:bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-primary-foreground bg-primary-foreground"
                          : "border-border-strong",
                      )}
                    >
                      {isSelected && <Check className={cn("size-3", "text-primary")} />}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ((p) => p - 1)}
              >
                ← {t("personality_prev", "Previous")}
              </Button>
              {currentQ < personalityQuestions.length - 1 ? (
                <Button
                  size="sm"
                  disabled={!answers[q.id]}
                  onClick={() => setCurrentQ((p) => p + 1)}
                >
                  {t("personality_next", "Next")} →
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => void submitTest()}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {t("personality_view_results", "View results")}
                      <ArrowRight className="size-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {allAnswered && currentQ === personalityQuestions.length - 1 && (
          <div className="mt-4 rise-in rounded-xl border border-success/30 bg-success/5 p-4 text-center">
            <p className="text-sm text-success">
              {t("personality_all_answered", "All questions answered! Click 'View results' to see your profile.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
