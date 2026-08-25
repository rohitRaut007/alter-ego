import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAppState } from "@/lib/app-state";
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
        content: "Answer six questions and receive a personalised seven-layer transformation protocol.",
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

function Onboarding() {
  const navigate = useNavigate();
  const { setOnboardingAnswer, completeOnboarding, onboarded } = useAppState();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: "intro",
      role: "mentor",
      content:
        "I'm going to ask you six questions. Answer them the way you'd answer at 2am, not the way you'd answer on a podcast. Your protocol is only as honest as this conversation.",
    },
    { id: "q0", role: "mentor", content: onboardingQuestions[0]!.question },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onboarded) {
      void navigate({ to: "/dashboard" });
    }
  }, [onboarded, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, thinking, generating]);

  const current = onboardingQuestions[step];
  const progress = Math.round((step / onboardingQuestions.length) * 100);

  async function submit(value: string) {
    const answer = value.trim();
    if (!answer || thinking || !current) return;
    setDraft("");
    setBubbles((b) => [...b, { id: `a${step}`, role: "user", content: answer }]);
    setOnboardingAnswer(current.id, answer);
    setThinking(true);
    await new Promise((r) => setTimeout(r, 850));
    setBubbles((b) => [
      ...b,
      { id: `r${step}`, role: "mentor", content: mentorReplies[step] ?? mentorReplies[0]! },
    ]);
    setThinking(false);

    const next = step + 1;
    if (next < onboardingQuestions.length) {
      await new Promise((r) => setTimeout(r, 400));
      setBubbles((b) => [
        ...b,
        { id: `q${next}`, role: "mentor", content: onboardingQuestions[next]!.question },
      ]);
      setStep(next);
    } else {
      setStep(next);
      setGenerating(true);
      const success = await completeOnboarding();
      setGenerating(false);
      if (success) {
        void navigate({ to: "/dashboard" });
      }
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-16">
        <div className="rise-in w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-lift sm:p-12">
          <span className="flex size-11 items-center justify-center rounded-xl bg-success text-success-foreground">
            <Check className="size-5" />
          </span>
          <p className="label-eyebrow mt-6">Protocol generated</p>
          <h1 className="text-display mt-3 text-3xl sm:text-4xl">
            Your alter ego is The Quiet Architect.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Seven layers have been compiled from your answers, with a 90-day sprint and a daily
            operating system ready to run tomorrow morning.
          </p>
          <ul className="mt-8 grid gap-2 sm:grid-cols-2">
            {layers.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm"
              >
                <Check className="size-3.5 text-accent" />
                {l.name}
              </li>
            ))}
          </ul>
          <Button size="lg" className="mt-8 w-full" onClick={() => navigate({ to: "/dashboard" })}>
            Enter my dashboard <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
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
                {current ? current.stage : "Compiling"}
              </span>
              <span className="text-muted-foreground">
                {Math.min(step + 1, onboardingQuestions.length)} of {onboardingQuestions.length}
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
              <Loader2 className="size-3.5 animate-spin" /> Mentor is thinking…
            </div>
          )}
          {generating && (
            <div className="rise-in rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Loader2 className="size-4 animate-spin text-accent" />
                Compiling your seven-layer protocol
              </div>
              <div className="mt-4 space-y-2">
                {layers.map((l, i) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <span className="size-1.5 rounded-full bg-accent" />
                    {l.name}
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
            <div className="mb-3 flex flex-wrap gap-2">
              {current.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setDraft(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={current.placeholder}
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
                aria-label="Send answer"
              >
                {thinking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
