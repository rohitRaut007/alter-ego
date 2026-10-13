import type { SafetyNotice } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button, Card, cn, Eyebrow, Spinner, Textarea } from "@/components/ui";
import { useAuth } from "@/lib/auth";

type Answers = { compounded: string; leaked: string; tomorrow: string };
const EMPTY: Answers = { compounded: "", leaked: "", tomorrow: "" };

export function ReflectionPage() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [rating, setRating] = useState<number | null>(null);
  const [safety, setSafety] = useState<SafetyNotice | null>(null);
  const [saved, setSaved] = useState(false);

  const existing = useQuery({
    queryKey: ["reflection"],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/reflections");
      if (!data) throw new Error("Could not load your reflection.");
      return data;
    },
  });

  const prompts = existing.data?.prompts ?? [];
  useEffect(() => {
    const row = existing.data?.reflection;
    if (row) {
      setAnswers({
        compounded: row.answers.compounded,
        leaked: row.answers.leaked ?? "",
        tomorrow: row.answers.tomorrow ?? "",
      });
      setRating(row.rating ?? null);
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data, response } = await api.POST("/api/v1/reflections", {
        body: { answers, ...(rating ? { rating } : {}) },
      });
      if (!data) {
        throw new Error(
          response.status === 400
            ? "Write at least one line on what compounded today."
            : "We could not save your reflection. Please try again.",
        );
      }
      return data;
    },
    onSuccess: async (result) => {
      if (result.safety) {
        setSafety(result.safety);
        return;
      }
      setSaved(true);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["reflection"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
      ]);
    },
  });

  if (existing.isPending) {
    return (
      <AppShell>
        <Spinner label="Loading" />
      </AppShell>
    );
  }
  if (existing.isError) {
    return (
      <AppShell>
        <Card>
          <p role="alert" className="text-sm text-destructive">
            We could not load your reflection.
          </p>
        </Card>
      </AppShell>
    );
  }

  const field = (key: keyof Answers, label: string) => (
    <div key={key}>
      <label htmlFor={`r-${key}`} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={`r-${key}`}
        className="mt-2"
        rows={3}
        maxLength={2000}
        value={answers[key]}
        onChange={(e) => {
          setSaved(false);
          setAnswers((a) => ({ ...a, [key]: e.target.value }));
        }}
      />
    </div>
  );

  return (
    <AppShell>
      <Eyebrow>End of day · about five minutes</Eyebrow>
      <h1 className="mt-2 font-display text-3xl">Evening reflection</h1>

      {safety ? (
        <div className="mt-6">
          <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />
          <p className="mt-3 text-xs text-muted-foreground">
            That reflection was not saved or used for coaching.
          </p>
        </div>
      ) : (
        <Card className="mt-6 space-y-5">
          {prompts.map((p) => field(p.key as keyof Answers, p.question))}
          <div>
            <p className="text-sm font-medium">How did the day go overall?</p>
            <div className="mt-2 flex gap-2" role="group" aria-label="Day rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={rating === n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className={cn(
                    "size-10 rounded-lg border text-sm transition",
                    rating === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-border-strong",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {save.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {save.error.message}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="flex items-center gap-2 text-sm text-success">
              <Check className="size-4" /> Saved.{" "}
              <Link to="/today" className="font-medium underline">
                Back to today
              </Link>
            </p>
          ) : null}
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save reflection
          </Button>
        </Card>
      )}
    </AppShell>
  );
}
