import type { Brief, PracticeState, Task } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flame, Sunrise } from "lucide-react";
import { Link } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { Button, Card, cn, Eyebrow, Progress, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

import { DeepWorkTimer } from "./DeepWorkTimer";

const LAYER_LABEL: Record<string, string> = {
  identity: "Identity",
  character: "Character",
  knowledge: "Knowledge",
  mission: "Mission",
  daily_os: "Daily OS",
  presence: "Presence",
  legacy: "Legacy",
};

function TaskRow({ task, onToggle, busy }: { task: Task; onToggle: () => void; busy: boolean }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        disabled={busy}
        onClick={onToggle}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition hover:border-border-strong hover:shadow-soft disabled:opacity-60",
          task.done ? "bg-surface opacity-70" : "bg-card",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
            task.done ? "border-success bg-success text-card" : "border-border-strong",
          )}
        >
          {task.done ? <Check className="size-3" /> : null}
        </span>
        <span className="flex-1">
          <span className={cn("block text-sm font-medium", task.done && "line-through")}>
            {task.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {LAYER_LABEL[task.layer] ?? task.layer} · {task.detail}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{task.minutes}m</span>
      </button>
    </li>
  );
}

function PracticeRow({
  practice,
  onToggle,
  busy,
}: {
  practice: PracticeState;
  onToggle: () => void;
  busy: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={practice.done_today}
        disabled={busy}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:shadow-soft disabled:opacity-60",
          practice.done_today ? "border-success/40 bg-success/5" : "border-border bg-card",
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border",
            practice.done_today ? "border-success bg-success text-card" : "border-border-strong",
          )}
        >
          {practice.done_today ? <Check className="size-3" /> : null}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium">{practice.description}</span>
          <span className="text-xs text-muted-foreground">
            {practice.trait_name} · {practice.minutes} min · {practice.cadence}
          </span>
        </span>
        {practice.streak > 0 ? (
          <span className="flex items-center gap-1 text-xs text-accent" aria-label={`${practice.streak} streak`}>
            <Flame className="size-3" aria-hidden /> {practice.streak}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function TodayPage() {
  const { api } = useAuth();
  const qc = useQueryClient();

  const brief = useQuery({
    queryKey: ["brief"],
    queryFn: async (): Promise<Brief | null> => {
      const { data, response } = await api.GET("/api/v1/daily/brief");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load today.");
      return data;
    },
  });

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["brief"] }),
      qc.invalidateQueries({ queryKey: ["sprint"] }),
      qc.invalidateQueries({ queryKey: ["traits"] }),
    ]);

  const toggleTask = useMutation({
    mutationFn: async (t: { id: string; done: boolean }) => {
      const { response } = await api.PATCH("/api/v1/tasks/{id}", {
        params: { path: { id: t.id } },
        body: { done: t.done },
      });
      if (!response.ok) throw new Error("Could not update the task.");
    },
    onSuccess: invalidate,
  });

  const togglePractice = useMutation({
    mutationFn: async (p: { id: string; done: boolean }) => {
      const { response } = await api.POST("/api/v1/practices/{id}/logs", {
        params: { path: { id: p.id } },
        body: { done: p.done },
      });
      if (!response.ok) throw new Error("Could not log the practice.");
    },
    onSuccess: invalidate,
  });

  if (brief.isPending) {
    return (
      <AppShell>
        <Spinner label="Preparing your day" />
      </AppShell>
    );
  }
  if (brief.isError) {
    return (
      <AppShell>
        <Card>
          <p role="alert" className="text-sm text-destructive">
            We could not load today. Please try again.
          </p>
          <Button className="mt-4 w-auto" onClick={() => void brief.refetch()}>
            Retry
          </Button>
        </Card>
      </AppShell>
    );
  }
  if (brief.data === null) {
    return (
      <AppShell>
        <Card>
          <h1 className="text-lg font-semibold">Your day starts with a protocol</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete the interview and your daily system is built from your answers.
          </p>
          <Link to="/onboarding" className="mt-4 inline-block">
            <Button className="w-auto">Start the interview</Button>
          </Link>
        </Card>
      </AppShell>
    );
  }

  const b = brief.data;
  const open = b.due_tasks;
  const doneCount = b.completed_today.length;
  const mutationError = toggleTask.isError || togglePractice.isError;

  return (
    <AppShell>
      <Eyebrow>
        Day {b.day_number} of {b.total_days}
      </Eyebrow>
      <h1 className="mt-2 font-display text-3xl">Today</h1>

      <Card className="mt-6 flex gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Sunrise className="size-5" aria-hidden />
        </span>
        <div>
          <Eyebrow>Morning brief · {b.alter_ego_name}</Eyebrow>
          <p className="mt-1.5 font-display text-xl leading-snug">{b.headline}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
          {b.insight ? <p className="mt-3 text-sm leading-relaxed">{b.insight}</p> : null}
        </div>
      </Card>

      {b.ritual.due ? (
        <Card className="mt-4 flex items-center justify-between gap-4 border-accent/40">
          <div>
            <p className="text-sm font-semibold">Weekly output ritual</p>
            <p className="text-sm text-muted-foreground">Close the week in five minutes.</p>
          </div>
          <Link to="/ritual">
            <Button className="w-auto">Begin</Button>
          </Link>
        </Card>
      ) : null}

      {mutationError ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          That did not save. Please try again.
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow>Priorities</Eyebrow>
                <h2 className="mt-1 text-lg font-semibold">
                  {open.length === 0 ? "Nothing due. Protect the space." : `${open.length} to do`}
                </h2>
              </div>
              <div className="w-28">
                <Progress value={b.week.total ? b.week.done / b.week.total : 0} />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  Week {b.week.week}: {b.week.done}/{b.week.total}
                </p>
              </div>
            </div>
            {open.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {open.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    busy={toggleTask.isPending}
                    onToggle={() => toggleTask.mutate({ id: t.id, done: true })}
                  />
                ))}
              </ul>
            ) : null}
            {doneCount > 0 ? (
              <>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Done today
                </p>
                <ul className="mt-2 space-y-2">
                  {b.completed_today.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      busy={toggleTask.isPending}
                      onToggle={() => toggleTask.mutate({ id: t.id, done: false })}
                    />
                  ))}
                </ul>
              </>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow>Practices</Eyebrow>
                <h2 className="mt-1 text-lg font-semibold">Character in motion</h2>
              </div>
              {b.practice_streak > 0 ? (
                <span className="flex items-center gap-1 text-sm text-accent">
                  <Flame className="size-4" aria-hidden /> {b.practice_streak}-day streak
                </span>
              ) : null}
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {b.practices.map((p) => (
                <PracticeRow
                  key={p.id}
                  practice={p}
                  busy={togglePractice.isPending}
                  onToggle={() => togglePractice.mutate({ id: p.id, done: !p.done_today })}
                />
              ))}
            </ul>
          </Card>

          <Card>
            <Eyebrow>Schedule</Eyebrow>
            <ul className="mt-3 divide-y divide-border">
              {b.schedule.map((blk) => (
                <li key={`${blk.start}-${blk.label}`} className="flex items-center gap-4 py-2.5 text-sm">
                  <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                    {blk.start}–{blk.end}
                  </span>
                  <span className="flex-1">{blk.label}</span>
                  <span className="text-xs text-muted-foreground">{LAYER_LABEL[blk.layer]}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <DeepWorkTimer
            minutesToday={b.deep_work_minutes_today}
            target={b.deep_work_target_minutes}
          />
          <Card>
            <Eyebrow>Evening reflection</Eyebrow>
            <p className="mt-2 text-sm text-muted-foreground">
              {b.reflection_done
                ? "Done for today. You can edit it any time before midnight."
                : "Three questions, five minutes."}
            </p>
            <Link to="/reflection" className="mt-4 inline-block">
              <Button variant={b.reflection_done ? "outline" : "primary"} className="w-auto">
                {b.reflection_done ? "Edit reflection" : "Reflect on today"}
              </Button>
            </Link>
          </Card>
          <Card>
            <Eyebrow>30-day checklist</Eyebrow>
            <p className="mt-2 text-sm">
              {b.checklist.done} of {b.checklist.total} done
              {b.checklist.overdue > 0 ? ` · ${b.checklist.overdue} overdue` : ""}
            </p>
            <div className="mt-3">
              <Progress value={b.checklist.total ? b.checklist.done / b.checklist.total : 0} />
            </div>
            <Link to="/plan" className="mt-4 inline-block text-sm font-medium underline">
              Open the plan
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
