import type { SafetyNotice } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button, Card, Eyebrow, Spinner, Textarea } from "@/components/primitives";
import { useAuth } from "@/lib/auth";

type Answers = { shipped: string; slipped: string; next_outcome: string };

const LAYER_LABEL: Record<string, string> = {
  identity: "Identity", character: "Character", knowledge: "Knowledge", mission: "Mission",
  daily_os: "Daily OS", presence: "Presence", legacy: "Legacy",
};

export function RitualPage() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Answers>({ shipped: "", slipped: "", next_outcome: "" });
  const [safety, setSafety] = useState<SafetyNotice | null>(null);

  const ritual = useQuery({
    queryKey: ["ritual"],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/weekly-ritual");
      if (!data) throw new Error("Could not load the weekly ritual.");
      return data;
    },
  });

  useEffect(() => {
    const a = ritual.data?.answers;
    if (a) setAnswers({ shipped: a.shipped, slipped: a.slipped ?? "", next_outcome: a.next_outcome });
  }, [ritual.data]);

  const submit = useMutation({
    mutationFn: async () => {
      const { data, response } = await api.POST("/api/v1/weekly-ritual", { body: answers });
      if (!data) {
        throw new Error(
          response.status === 409
            ? "The weekly ritual opens on Sunday evening."
            : "Write what you shipped and next week's outcome, then try again.",
        );
      }
      return data;
    },
    onSuccess: async (result) => {
      if (result.safety) {
        setSafety(result.safety);
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ritual"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
      ]);
    },
  });

  if (ritual.isPending) {
    return (
      <AppShell>
        <Spinner label="Loading" />
      </AppShell>
    );
  }
  if (ritual.isError) {
    return (
      <AppShell>
        <Card>
          <p role="alert" className="text-sm text-destructive">
            We could not load the weekly ritual.
          </p>
        </Card>
      </AppShell>
    );
  }

  const { state, stats, prompts } = ritual.data;
  const missed = stats ? Object.entries(stats.missed_by_layer) : [];

  return (
    <AppShell>
      <Eyebrow>Sunday evening</Eyebrow>
      <h1 className="mt-2 font-display text-3xl">Weekly output ritual</h1>

      {!state.available ? (
        <Card className="mt-6">
          <p className="text-sm">
            The ritual opens on Sunday at 5pm and stays open through Wednesday. Come back then to
            close the week.
          </p>
        </Card>
      ) : safety ? (
        <div className="mt-6">
          <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />
          <p className="mt-3 text-xs text-muted-foreground">
            Those answers were not saved or used for coaching.
          </p>
        </div>
      ) : (
        <>
          {stats ? (
            <Card className="mt-6">
              <Eyebrow>This week in numbers</Eyebrow>
              <dl className="mt-3 grid grid-cols-3 gap-4 text-center">
                <div>
                  <dd className="font-display text-2xl">
                    {stats.tasks_done}/{stats.tasks_due}
                  </dd>
                  <dt className="text-xs text-muted-foreground">tasks done</dt>
                </div>
                <div>
                  <dd className="font-display text-2xl">{stats.practice_days}</dd>
                  <dt className="text-xs text-muted-foreground">practice days</dt>
                </div>
                <div>
                  <dd className="font-display text-2xl">{stats.deep_work_minutes}</dd>
                  <dt className="text-xs text-muted-foreground">deep work min</dt>
                </div>
              </dl>
              {missed.length > 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Not done:{" "}
                  {missed.map(([k, n]) => `${n} in ${LAYER_LABEL[k] ?? k}`).join(", ")}.
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card className="mt-5 space-y-5">
            {prompts.map((p) => (
              <div key={p.key}>
                <label htmlFor={`rit-${p.key}`} className="text-sm font-medium">
                  {p.question}
                </label>
                <Textarea
                  id={`rit-${p.key}`}
                  className="mt-2"
                  rows={3}
                  maxLength={2000}
                  value={answers[p.key as keyof Answers]}
                  onChange={(e) => setAnswers((a) => ({ ...a, [p.key]: e.target.value }))}
                />
              </div>
            ))}
            {submit.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {submit.error.message}
              </p>
            ) : null}
            {state.completed ? (
              <p role="status" className="flex items-center gap-2 text-sm text-success">
                <Check className="size-4" /> Completed for this week. You can still edit it.
              </p>
            ) : null}
            <Button
              loading={submit.isPending}
              disabled={!answers.shipped.trim() || !answers.next_outcome.trim()}
              onClick={() => submit.mutate()}
            >
              {state.completed ? "Update ritual" : "Close the week"}
            </Button>
          </Card>
        </>
      )}
    </AppShell>
  );
}
