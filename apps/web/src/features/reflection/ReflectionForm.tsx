import type { SafetyNotice } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Answers = { compounded: string; leaked: string; tomorrow: string };
const EMPTY: Answers = { compounded: "", leaked: "", tomorrow: "" };

/** The three-question evening reflection. Used on the Daily page and on its own page. */
export function ReflectionForm({ onSaved }: { onSaved?: () => void }) {
  const { api } = useAuth();
  const { t } = useLanguage();
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
            ? t("daily_compounded_error", "Write at least one line on what compounded today.")
            : t("daily_reflection_error", "We could not save your reflection. Please try again."),
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
      onSaved?.();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["reflection"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
      ]);
    },
  });

  if (existing.isPending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("loading", "Loading")}…
      </p>
    );
  }
  if (safety) {
    return (
      <div>
        <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />
        <p className="mt-3 text-xs text-muted-foreground">
          {t("reflection_not_saved", "That reflection was not saved or used for coaching.")}
        </p>
      </div>
    );
  }

  const prompts = existing.data?.prompts ?? [];
  return (
    <div className="space-y-5">
      {prompts.map((p) => {
        const key = p.key as keyof Answers;
        return (
          <div key={p.key}>
            <label htmlFor={`r-${p.key}`} className="text-sm font-medium">
              {p.question}
            </label>
            <Textarea
              id={`r-${p.key}`}
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
      })}
      <div>
        <p className="text-sm font-medium">{t("reflection_rating", "How did the day go overall?")}</p>
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
          <Check className="size-4" /> {t("daily_reflection_saved", "Saved.")}
        </p>
      ) : null}
      <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
        {t("character_save_reflection", "Save reflection")}
      </Button>
    </div>
  );
}
