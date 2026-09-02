import { createFileRoute } from "@tanstack/react-router";
import { Check, Flame, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import { challenges, traits } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/character")({
  head: () => ({
    meta: [
      { title: "Character Builder — Alter Ego OS" },
      {
        name: "description",
        content:
          "Engineer traits through daily practice: streaks, reflection prompts and AI-generated challenges for your character stack.",
      },
      { property: "og:title", content: "Character Builder — Alter Ego OS" },
      {
        property: "og:description",
        content: "Traits, practices, streaks and challenges — character as compound interest.",
      },
    ],
  }),
  component: Character,
});

function Character() {
  const { habits, toggleHabit } = useAppState();
  const { t } = useLanguage();
  const [reflection, setReflection] = useState("");
  const [savedPrompt, setSavedPrompt] = useState<string | null>(null);

  const prompts = [
    t("character_prompt_1", "Where did you act like the old version of yourself today?"),
    t("character_prompt_2", "Which trait did today's schedule actually build?"),
    t("character_prompt_3", "What would The Quiet Architect have refused this week?"),
  ];


  return (
    <AppShell>
      <PageHeader
        eyebrow={t("character_layer", "Layer 02")}
        title={t("character_title", "Character Stack")}
        description={t("character_description", "Traits are not chosen, they are practised. These are the five you are compounding.")}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          {traits.map((tr) => (
            <div key={tr.id} className="card-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl">{t(`trait_${tr.id}_name`, tr.name)}</h2>
                  <p className="mt-1 font-display text-lg leading-snug text-muted-foreground">
                    “{t(`trait_${tr.id}_statement`, tr.statement)}”
                  </p>
                </div>
                <span className="font-display text-3xl">{tr.level}</span>
              </div>
              <Progress value={tr.level} className="mt-4 h-1" />
              <div className="mt-4 flex flex-wrap gap-2">
                {tr.practices.map((p, idx) => (
                  <span
                    key={p}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground"
                  >
                    {t(`trait_${tr.id}_p${idx + 1}`, p)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("character_streaks", "Streaks")}</p>
            <div className="mt-4 space-y-4">
              {habits.map((h) => (
                <div key={h.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t(`habit_${h.id}_name`, h.name)}</span>
                    <span className="flex items-center gap-1 text-xs text-accent">
                      <Flame className="size-3" /> {h.streak}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {h.history.map((hit, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-5 flex-1 rounded-sm",
                          hit ? "bg-accent/70" : "bg-secondary",
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {t(`cadence_${h.cadence.toLowerCase()}`, h.cadence)} · {t("character_best", "best")} {h.best}
                    </span>
                    <button
                      onClick={() => {
                        toggleHabit(h.id);
                        toast.success(h.completedToday ? t("character_undone", "Undone") : t("character_logged_today", "Logged for today"));
                      }}
                      className="flex items-center gap-1 font-medium transition-colors hover:text-foreground"
                    >
                      <Check className="size-3" />
                      {h.completedToday ? t("character_done_today", "Done today") : t("character_mark_done", "Mark done")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-accent" />
              <p className="label-eyebrow">{t("character_ai_challenges", "AI challenges")}</p>
            </div>
            <div className="mt-4 space-y-3">
              {challenges.slice(0, 2).map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-sm font-medium leading-snug">{t(`challenge_${c.id}_title`, c.title)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`challenge_${c.id}_detail`, c.detail)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => toast.success(t("character_challenge_added", "Challenge added to this week."))}
                  >
                    {t("character_take_challenge", "Take it on")}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <p className="label-eyebrow">{t("character_reflection_prompt", "Reflection prompt")}</p>
            </div>
            <div className="mt-3 space-y-2">
              {[
                t("character_prompt_1", "Where did you act like the old version of yourself today?"),
                t("character_prompt_2", "Which trait did today's schedule actually build?"),
                t("character_prompt_3", "What would The Quiet Architect have refused this week?"),
              ].map((pText) => (
                <button
                  key={pText}
                  onClick={() => setSavedPrompt(pText)}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                    savedPrompt === pText
                      ? "border-accent bg-accent-soft"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  {pText}
                </button>
              ))}
            </div>
            <Textarea
              className="mt-3"
              rows={3}
              placeholder={t("character_write_answer", "Write your answer…")}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
            <Button
              className="mt-3 w-full"
              onClick={() => {
                if (!reflection.trim()) {
                  toast.error(t("character_nothing_to_save", "Nothing to save yet."));
                  return;
                }
                setReflection("");
                toast.success(t("character_reflection_saved", "Reflection saved to your character log."));
              }}
            >
              {t("character_save_reflection", "Save reflection")}
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
