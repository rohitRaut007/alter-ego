import type { Sprint, Task } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { Button, Card, cn, Eyebrow, Progress, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

function fmt(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function TaskLine({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-surface"
      >
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border",
            task.done ? "border-success bg-success text-card" : "border-border-strong",
          )}
        >
          {task.done ? <Check className="size-3" /> : null}
        </span>
        <span className={cn("flex-1", task.done && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{fmt(task.due_date)}</span>
      </button>
    </li>
  );
}

export function PlanPage() {
  const { api } = useAuth();
  const qc = useQueryClient();

  const sprint = useQuery({
    queryKey: ["sprint"],
    queryFn: async (): Promise<Sprint | null> => {
      const { data, response } = await api.GET("/api/v1/sprints/current");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load the plan.");
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async (t: { id: string; done: boolean }) => {
      const { response } = await api.PATCH("/api/v1/tasks/{id}", {
        params: { path: { id: t.id } },
        body: { done: t.done },
      });
      if (!response.ok) throw new Error("Could not update the task.");
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["sprint"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
      ]),
  });

  if (sprint.isPending) {
    return (
      <AppShell>
        <Spinner label="Loading the plan" />
      </AppShell>
    );
  }
  if (sprint.isError) {
    return (
      <AppShell>
        <Card>
          <p role="alert" className="text-sm text-destructive">
            We could not load the plan.
          </p>
          <Button className="mt-4 w-auto" onClick={() => void sprint.refetch()}>
            Retry
          </Button>
        </Card>
      </AppShell>
    );
  }
  if (sprint.data === null) {
    return (
      <AppShell>
        <Card>
          <p className="text-sm">Your plan appears once your protocol is ready.</p>
          <Link to="/onboarding" className="mt-4 inline-block">
            <Button className="w-auto">Start the interview</Button>
          </Link>
        </Card>
      </AppShell>
    );
  }

  const s = sprint.data;
  const total = s.weeks.reduce((n, w) => n + w.total, 0);
  const done = s.weeks.reduce((n, w) => n + w.done, 0);
  const checklistDone = s.checklist.filter((t) => t.done).length;

  return (
    <AppShell>
      <Eyebrow>
        {fmt(s.starts_on)} to {fmt(s.ends_on)} · Day {s.day_number} of {s.total_days}
      </Eyebrow>
      <h1 className="mt-2 font-display text-3xl">The plan</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{s.goal}</p>

      <Card className="mt-6">
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow>90-day sprint</Eyebrow>
            <p className="mt-1 text-lg font-semibold">
              {done} of {total} tasks done
            </p>
          </div>
          <div className="w-40">
            <Progress value={total ? done / total : 0} />
          </div>
        </div>
      </Card>

      {toggle.isError ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          That did not save. Please try again.
        </p>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold">30-day checklist</h2>
      <Card className="mt-3">
        <p className="text-xs text-muted-foreground">
          {checklistDone} of {s.checklist.length} done
        </p>
        <ul className="mt-2">
          {s.checklist.map((t) => (
            <TaskLine
              key={t.id}
              task={t}
              onToggle={() => toggle.mutate({ id: t.id, done: !t.done })}
            />
          ))}
        </ul>
      </Card>

      <h2 className="mt-8 text-lg font-semibold">Weeks</h2>
      <div className="mt-3 space-y-3">
        {s.weeks.map((w) => (
          <details
            key={w.index}
            open={w.is_current}
            className="rounded-xl border border-border bg-card shadow-soft"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold">
              <span>
                Week {w.index}
                {w.is_current ? (
                  <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium">
                    this week
                  </span>
                ) : null}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {w.done}/{w.total}
              </span>
            </summary>
            <ul className="border-t border-border px-3 py-2">
              {w.tasks.map((t) => (
                <TaskLine
                  key={t.id}
                  task={t}
                  onToggle={() => toggle.mutate({ id: t.id, done: !t.done })}
                />
              ))}
            </ul>
          </details>
        ))}
      </div>
    </AppShell>
  );
}
