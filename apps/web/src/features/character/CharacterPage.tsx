import type { Challenge, PracticeState, SafetyNotice, Trait } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flame, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SCALE = ["Rarely", "Sometimes", "Often", "Usually", "Reliably"];

function CheckIn({ trait }: { trait: Trait }) {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [safety, setSafety] = useState<SafetyNotice | null>(null);
  const offset = trait.rating_due_offset;

  const rate = useMutation({
    mutationFn: async (score: number) => {
      const { data, response } = await api.POST("/api/v1/traits/{id}/ratings", {
        params: { path: { id: trait.id } },
        body: { day_offset: offset as 0 | 14 | 30, score, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      if (!data) throw new Error(response.status === 409 ? "Already recorded." : "Could not save.");
      return data;
    },
    onSuccess: async (result) => {
      if (result.safety) setSafety(result.safety);
      await qc.invalidateQueries({ queryKey: ["traits"] });
    },
  });

  if (safety) return <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />;
  if (offset === null) return null;
  return (
    <div className="mt-4 rounded-xl border border-border-strong bg-surface p-4">
      <p className="text-sm font-semibold">
        {offset === 0
          ? t("character_checkin_start", "Where are you starting?")
          : `${t("character_checkin_day", "Day")} ${offset} ${t("character_checkin", "check-in")}`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("character_checkin_prompt", "How reliably do you live")} “{trait.statement}”{" "}
        {t("character_checkin_now", "right now?")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SCALE.map((label, i) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            disabled={rate.isPending}
            onClick={() => rate.mutate(i + 1)}
          >
            {i + 1} · {label}
          </Button>
        ))}
      </div>
      <label htmlFor={`note-${trait.id}`} className="mt-3 block text-xs text-muted-foreground">
        {t("character_optional_note", "Optional note")}
      </label>
      <Textarea
        id={`note-${trait.id}`}
        rows={2}
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {rate.isError ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {rate.error.message}
        </p>
      ) : null}
    </div>
  );
}

function MonthlyReflection({ trait }: { trait: Trait }) {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [safety, setSafety] = useState<SafetyNotice | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.POST("/api/v1/traits/{id}/reflections", {
        params: { path: { id: trait.id } },
        body: { text: text.trim() },
      });
      if (!data) throw new Error("Could not save your reflection.");
      return data;
    },
    onSuccess: async (result) => {
      if (result.safety) {
        setSafety(result.safety);
        return;
      }
      setText("");
      toast.success(t("character_reflection_saved", "Reflection saved to your character log."));
      await qc.invalidateQueries({ queryKey: ["traits"] });
    },
  });

  if (safety) return <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />;
  if (trait.reflection_done_this_month) {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        {t("character_monthly_done", "Monthly reflection done.")}
      </p>
    );
  }
  return (
    <div className="mt-4">
      <label htmlFor={`refl-${trait.id}`} className="text-sm font-medium">
        {trait.reflection_prompt}
      </label>
      <Textarea
        id={`refl-${trait.id}`}
        className="mt-2"
        rows={3}
        maxLength={3000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {save.isError ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {save.error.message}
        </p>
      ) : null}
      <Button
        className="mt-2"
        variant="outline"
        size="sm"
        disabled={!text.trim() || save.isPending}
        onClick={() => save.mutate()}
      >
        {t("character_save_reflection", "Save reflection")}
      </Button>
    </div>
  );
}

function StreakRow({ practice, trait }: { practice: PracticeState; trait: string }) {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async () => {
      const { response } = await api.POST("/api/v1/practices/{id}/logs", {
        params: { path: { id: practice.id } },
        body: { done: !practice.done_today },
      });
      if (!response.ok) throw new Error("save failed");
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["traits"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
    onError: () => toast.error(t("character_save_error", "That did not save. Please try again.")),
  });
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{practice.description}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-accent">
          <Flame className="size-3" aria-hidden /> {practice.streak}
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {practice.history.map((hit, i) => (
          <span key={i} className={cn("h-5 flex-1 rounded-sm", hit ? "bg-accent/70" : "bg-secondary")} />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {trait} · {practice.cadence} · {t("character_best", "best")} {practice.best_streak}
        </span>
        <button
          type="button"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
          className="flex items-center gap-1 font-medium transition-colors hover:text-foreground disabled:opacity-60"
        >
          <Check className="size-3" />
          {practice.done_today ? t("character_done_today", "Done today") : t("character_mark_done", "Mark done")}
        </button>
      </div>
    </div>
  );
}

export function CharacterPage() {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const traits = useQuery({
    queryKey: ["traits"],
    queryFn: async (): Promise<Trait[] | null> => {
      const { data, response } = await api.GET("/api/v1/traits");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load your character stack.");
      return data;
    },
  });
  const challenges = useQuery({
    queryKey: ["mentor", "challenges"],
    enabled: traits.data != null,
    queryFn: async (): Promise<Challenge[]> => (await api.GET("/api/v1/mentor/challenges")).data ?? [],
  });

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { response } = await api.POST("/api/v1/mentor/challenges/{id}/accept", {
        params: { path: { id } },
      });
      if (!response.ok) throw new Error("save failed");
    },
    onSuccess: async () => {
      toast.success(t("character_challenge_added", "Challenge added to this week."));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mentor", "challenges"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
      ]);
    },
  });

  if (traits.isPending) {
    return (
      <AppShell>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </AppShell>
    );
  }
  if (traits.isError) {
    return (
      <AppShell>
        <div className="card-surface p-6">
          <p role="alert" className="text-sm text-destructive">
            {t("character_load_error", "We could not load your character stack.")}
          </p>
          <Button className="mt-4" onClick={() => void traits.refetch()}>
            {t("retry", "Retry")}
          </Button>
        </div>
      </AppShell>
    );
  }
  if (traits.data === null) {
    return (
      <AppShell>
        <PageHeader eyebrow={t("character_layer", "Layer 02")} title={t("character_title", "Character Stack")} />
        <div className="card-surface p-6">
          <p className="text-sm">
            {t("character_no_protocol", "Your traits appear once your protocol is ready.")}
          </p>
          <Button asChild className="mt-4">
            <Link to="/onboarding">{t("home_start_interview", "Start the interview")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const offered = (challenges.data ?? []).filter((c) => c.status === "offered");

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("character_layer", "Layer 02")}
        title={t("character_title", "Character Stack")}
        description={t(
          "character_description",
          "Traits are not chosen, they are practised. These are the ones you are compounding.",
        )}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          {traits.data.map((tr) => (
            <div key={tr.id} className="card-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl">{tr.name}</h2>
                  <p className="mt-1 font-display text-lg leading-snug text-muted-foreground">
                    “{tr.statement}”
                  </p>
                </div>
                {tr.streak > 0 ? (
                  <span className="flex items-center gap-1 text-sm text-accent">
                    <Flame className="size-4" aria-hidden /> {tr.streak}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{tr.rationale}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("character_failure_mode", "Failure mode")}: {tr.failure_mode}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {tr.practices.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground"
                  >
                    {p.description}
                  </span>
                ))}
              </div>
              {tr.ratings.length > 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("character_checkins", "Check-ins")}:{" "}
                  {tr.ratings.map((r) => `day ${r.day_offset}: ${r.score}/5`).join(" · ")}
                </p>
              ) : null}
              <CheckIn trait={tr} />
              <MonthlyReflection trait={tr} />
            </div>
          ))}
        </section>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("character_streaks", "Streaks")}</p>
            <div className="mt-4 space-y-4">
              {traits.data.flatMap((tr) =>
                tr.practices.map((p) => <StreakRow key={p.id} practice={p} trait={tr.name} />),
              )}
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-accent" />
              <p className="label-eyebrow">{t("character_ai_challenges", "Mentor challenges")}</p>
            </div>
            <div className="mt-4 space-y-3">
              {offered.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("mentor_no_challenges", "No open challenges this week.")}
                </p>
              ) : null}
              {offered.slice(0, 2).map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-sm font-medium leading-snug">{c.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate(c.id)}
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
            <p className="mt-3 text-sm text-muted-foreground">
              {t(
                "character_reflection_help",
                "Each trait has its own monthly reflection above. Write it once a month and it stays in your character log.",
              )}
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
