import type { PracticeState, SafetyNotice, Trait } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flame } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button, Card, cn, Eyebrow, Spinner, Textarea } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const SCALE = ["Rarely", "Sometimes", "Often", "Usually", "Reliably"];

function HistoryDots({ history }: { history: boolean[] }) {
  return (
    <div className="mt-2 flex gap-1" aria-hidden>
      {history.map((hit, i) => (
        <span key={i} className={cn("h-4 flex-1 rounded-sm", hit ? "bg-accent/70" : "bg-secondary")} />
      ))}
    </div>
  );
}

function PracticeLine({ practice, trait }: { practice: PracticeState; trait: Trait }) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async () => {
      const { response } = await api.POST("/api/v1/practices/{id}/logs", {
        params: { path: { id: practice.id } },
        body: { done: !practice.done_today },
      });
      if (!response.ok) throw new Error("Could not log the practice.");
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["traits"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
      ]),
  });
  return (
    <li className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{practice.description}</p>
          <p className="text-xs text-muted-foreground">
            {practice.cadence} · {practice.minutes} min · best {practice.best_streak}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {practice.streak > 0 ? (
            <span className="flex items-center gap-1 text-xs text-accent">
              <Flame className="size-3" aria-hidden /> {practice.streak}
            </span>
          ) : null}
          <Button
            variant={practice.done_today ? "outline" : "primary"}
            className="h-9 w-auto px-3 text-xs"
            loading={toggle.isPending}
            aria-label={`${practice.done_today ? "Undo" : "Log"} ${trait.name} practice`}
            onClick={() => toggle.mutate()}
          >
            {practice.done_today ? (
              <>
                <Check className="size-3" /> Done today
              </>
            ) : (
              "Mark done"
            )}
          </Button>
        </div>
      </div>
      <HistoryDots history={practice.history} />
    </li>
  );
}

function CheckIn({ trait }: { trait: Trait }) {
  const { api } = useAuth();
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
    <div className="mt-4 rounded-xl border border-border-strong bg-card p-4">
      <p className="text-sm font-semibold">
        {offset === 0 ? "Where are you starting?" : `Day ${offset} check-in`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        How reliably do you live “{trait.statement}” right now?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SCALE.map((label, i) => (
          <Button
            key={label}
            variant="outline"
            className="h-9 w-auto px-3 text-xs"
            disabled={rate.isPending}
            onClick={() => rate.mutate(i + 1)}
          >
            {i + 1} · {label}
          </Button>
        ))}
      </div>
      <label htmlFor={`note-${trait.id}`} className="mt-3 block text-xs text-muted-foreground">
        Optional note
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
      await qc.invalidateQueries({ queryKey: ["traits"] });
    },
  });

  if (safety) return <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />;
  if (trait.reflection_done_this_month) {
    return <p className="mt-4 text-xs text-muted-foreground">Monthly reflection done.</p>;
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
        className="mt-2 w-auto"
        variant="outline"
        disabled={!text.trim()}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        Save reflection
      </Button>
    </div>
  );
}

export function CharacterPage() {
  const { api } = useAuth();
  const traits = useQuery({
    queryKey: ["traits"],
    queryFn: async (): Promise<Trait[] | null> => {
      const { data, response } = await api.GET("/api/v1/traits");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load your character stack.");
      return data;
    },
  });

  if (traits.isPending) {
    return (
      <AppShell>
        <Spinner label="Loading your character stack" />
      </AppShell>
    );
  }
  if (traits.isError) {
    return (
      <AppShell>
        <Card>
          <p role="alert" className="text-sm text-destructive">
            We could not load your character stack.
          </p>
          <Button className="mt-4 w-auto" onClick={() => void traits.refetch()}>
            Retry
          </Button>
        </Card>
      </AppShell>
    );
  }
  if (traits.data === null) {
    return (
      <AppShell>
        <Card>
          <p className="text-sm">Your traits appear once your protocol is ready.</p>
          <Link to="/onboarding" className="mt-4 inline-block">
            <Button className="w-auto">Start the interview</Button>
          </Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Eyebrow>Layer 02</Eyebrow>
      <h1 className="mt-2 font-display text-3xl">Character stack</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Traits are not chosen, they are practised. Log the practice, and check in on how reliably you
        live each trait.
      </p>
      <div className="mt-8 space-y-5">
        {traits.data.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{t.name}</h2>
                <p className="mt-1 font-display text-lg leading-snug text-muted-foreground">
                  “{t.statement}”
                </p>
              </div>
              {t.streak > 0 ? (
                <span className="flex items-center gap-1 text-sm text-accent">
                  <Flame className="size-4" aria-hidden /> {t.streak}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t.rationale}</p>
            <p className="mt-2 text-xs text-muted-foreground">Failure mode: {t.failure_mode}</p>
            <ul className="mt-4 space-y-2">
              {t.practices.map((p) => (
                <PracticeLine key={p.id} practice={p} trait={t} />
              ))}
            </ul>
            {t.ratings.length > 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Check-ins:{" "}
                {t.ratings.map((r) => `day ${r.day_offset}: ${r.score}/5`).join(" · ")}
              </p>
            ) : null}
            <CheckIn trait={t} />
            <MonthlyReflection trait={t} />
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
