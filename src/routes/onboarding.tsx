import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import { layers, mentorReplies, onboardingQuestions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "The Interview — Alter Ego OS" },
      {
        name: "description",
        content:
          "A ten-minute conversation about your ambition, position, character, fears and horizon. Your seven-layer protocol is generated at the end.",
      },
      { property: "og:title", content: "The Interview — Alter Ego OS" },
      {
        property: "og:description",
        content:
          "Answer thirteen questions and receive a personalised seven-layer transformation protocol.",
      },
    ],
  }),
  component: Onboarding,
});

interface Bubble {
  id: string;
  role: "mentor" | "user";
  content: string;
}

function MultiSelectChips({
  suggestions,
  selected,
  onToggle,
  onCustom,
  placeholder,
}: {
  suggestions: string[];
  selected: string[];
  onToggle: (s: string) => void;
  onCustom: (val: string) => void;
  placeholder: string;
}) {
  const [custom, setCustom] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => {
          const isSelected = selected.includes(s);
          return (
            <button
              key={s}
              onClick={() => onToggle(s)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {isSelected && <Check className="size-3" />}
              {s}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface px-3 py-2">
          <span className="text-xs text-muted-foreground mr-1 self-center">Selected:</span>
          {selected.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {s}
              <button onClick={() => onToggle(s)} className="hover:text-primary/70">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) {
              onCustom(custom.trim());
              setCustom("");
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (custom.trim()) {
              onCustom(custom.trim());
              setCustom("");
            }
          }}
          disabled={!custom.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { setOnboardingAnswer, completeOnboarding, onboarded, personalityTestCompleted } = useAppState();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState("");
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: "intro",
      role: "mentor",
      content: t(
        "onboarding_intro",
        "I'm going to ask you thirteen questions. Answer them the way you'd answer at 2am, not the way you'd answer on a podcast. Your protocol is only as honest as this conversation.",
      ),
    },
    {
      id: "q0",
      role: "mentor",
      content: t(
        `onboarding_${onboardingQuestions[0]!.id}_question`,
        onboardingQuestions[0]!.question,
      ),
    },
  ]);

  useEffect(() => {
    if (onboarded && personalityTestCompleted) {
      void navigate({ to: "/dashboard" });
    } else if (onboarded && !personalityTestCompleted) {
      void navigate({ to: "/personality" });
    }
  }, [onboarded, personalityTestCompleted, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, thinking, generating]);

  const current = onboardingQuestions[step];
  const progress = Math.round((step / onboardingQuestions.length) * 100);
  const isMultiSelect = current?.multiSelect ?? false;

  function toggleChip(s: string) {
    setMultiSelected((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function addCustomChip(val: string) {
    if (!multiSelected.includes(val)) {
      setMultiSelected((prev) => [...prev, val]);
    }
  }

  async function submit(value: string | string[]) {
    const answerArr = Array.isArray(value) ? value : [value];
    const answerStr = Array.isArray(value) ? value.join(", ") : value.trim();
    if (!answerStr || thinking || !current) return;

    setDraft("");
    setMultiSelected([]);
    setBubbles((b) => [
      ...b,
      {
        id: `a${step}`,
        role: "user",
        content: Array.isArray(value) ? value.join(" · ") : value,
      },
    ]);
    setOnboardingAnswer(current.id, Array.isArray(value) ? answerArr : answerStr);
    setThinking(true);
    await new Promise((r) => setTimeout(r, 850));
    setBubbles((b) => [
      ...b,
      {
        id: `r${step}`,
        role: "mentor",
        content: t(`mentor_reply_${step}`, mentorReplies[step] ?? mentorReplies[0]!),
      },
    ]);
    setThinking(false);

    const next = step + 1;
    if (next < onboardingQuestions.length) {
      await new Promise((r) => setTimeout(r, 400));
      setBubbles((b) => [
        ...b,
        {
          id: `q${next}`,
          role: "mentor",
          content: t(
            `onboarding_${onboardingQuestions[next]!.id}_question`,
            onboardingQuestions[next]!.question,
          ),
        },
      ]);
      setStep(next);
    } else {
      setStep(next);
      setGenerating(true);
      await completeOnboarding();
      setGenerating(false);
      void navigate({ to: "/personality" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-4 sm:px-8">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">
                {current
                  ? t(`onboarding_${current.id}_stage`, current.stage)
                  : t("onboarding_compiling", "Compiling")}
              </span>
              <span className="text-muted-foreground">
                {Math.min(step + 1, onboardingQuestions.length)}{" "}
                {t("onboarding_of_total", "of")} {onboardingQuestions.length}
              </span>
            </div>
            <Progress value={progress} className="mt-2 h-1" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="space-y-5">
          {bubbles.map((b) => (
            <div
              key={b.id}
              className={cn(
                "rise-in max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[78%]",
                b.role === "mentor"
                  ? "border border-border bg-card shadow-soft"
                  : "ml-auto bg-primary text-primary-foreground",
              )}
            >
              {b.content}
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> {t("mentor_thinking", "Mentor is thinking…")}
            </div>
          )}
          {generating && (
            <div className="rise-in rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Loader2 className="size-4 animate-spin text-accent" />
                {t("onboarding_compiling_protocol", "Compiling your seven-layer protocol")}
              </div>
              <div className="mt-4 space-y-2">
                {layers.map((l, i) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <span className="size-1.5 rounded-full bg-accent" />
                    {t(`layer_${l.id.replace("-", "_")}_name`, l.name)}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {current && (
        <div className="sticky bottom-0 border-t border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-5 py-4 sm:px-8">
            {isMultiSelect ? (
              <>
                <MultiSelectChips
                  suggestions={current.suggestions}
                  selected={multiSelected}
                  onToggle={toggleChip}
                  onCustom={addCustomChip}
                  placeholder={t(
                    `onboarding_${current.id}_placeholder`,
                    current.placeholder,
                  )}
                />
                <Button
                  className="mt-3 w-full"
                  disabled={multiSelected.length === 0 || thinking}
                  onClick={() => void submit(multiSelected)}
                >
                  {thinking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {t("onboarding_confirm_selection", "Confirm selection")} ({multiSelected.length})
                      <ArrowRight className="size-4 ml-1" />
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  {current.suggestions.map((s, idx) => {
                    const translatedSugg = t(`onboarding_${current.id}_sugg${idx + 1}`, s);
                    return (
                      <button
                        key={s}
                        onClick={() => setDraft(translatedSugg)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                      >
                        {translatedSugg}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t(`onboarding_${current.id}_placeholder`, current.placeholder)}
                    rows={2}
                    className="resize-none bg-card"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submit(draft);
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="size-11 shrink-0"
                    disabled={!draft.trim() || thinking}
                    onClick={() => void submit(draft)}
                    aria-label={t("onboarding_send_answer", "Send answer")}
                  >
                    {thinking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
