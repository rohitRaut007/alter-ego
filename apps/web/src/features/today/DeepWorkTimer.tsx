import type { DeepWorkSession } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card, Eyebrow, Progress } from "@/components/primitives";
import { useAuth } from "@/lib/auth";

const PRESETS = [25, 50, 90];

const TIPS = [
  "Put your phone in another room.",
  "Close messaging apps and email before you start.",
  "Write the one outcome of this block on paper first.",
];

function format(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function Running({ session, onEnd }: { session: DeepWorkSession; onEnd: () => void }) {
  const total = session.planned_minutes * 60;
  const startedMs = new Date(session.started_at).getTime();
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedMs) / 1000));

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedMs) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedMs]);

  const remaining = total - elapsed;
  return (
    <>
      <p
        className="mt-4 font-mono text-5xl tabular-nums tracking-tight"
        aria-live="off"
        aria-label={remaining > 0 ? `${format(remaining)} remaining` : "Block complete"}
      >
        {remaining > 0 ? format(remaining) : "00:00"}
      </p>
      <div className="mt-4">
        <Progress value={elapsed / total} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {remaining > 0
          ? `${session.planned_minutes} minute block in progress.`
          : "Time is up. End the block to log it."}
      </p>
      <Button className="mt-4" variant={remaining > 0 ? "outline" : "primary"} onClick={onEnd}>
        <Pause className="size-4" /> {remaining > 0 ? "End block early" : "End and log block"}
      </Button>
    </>
  );
}

export function DeepWorkTimer({ minutesToday, target }: { minutesToday: number; target: number }) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [minutes, setMinutes] = useState(PRESETS[2]!);
  const [error, setError] = useState<string>();

  const active = useQuery({
    queryKey: ["deep-work", "active"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/deep-work/sessions/active");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load the timer.");
      return data;
    },
  });

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["deep-work"] }),
      qc.invalidateQueries({ queryKey: ["brief"] }),
    ]);
  };

  const start = useMutation({
    mutationFn: async () => {
      const { data, response } = await api.POST("/api/v1/deep-work/sessions", {
        body: { planned_minutes: minutes },
      });
      if (!data) {
        throw new Error(
          response.status === 409
            ? "A block is already running."
            : "Could not start the block. Please try again.",
        );
      }
    },
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });

  const end = useMutation({
    mutationFn: async (id: string) => {
      const { response } = await api.PATCH("/api/v1/deep-work/sessions/{id}", {
        params: { path: { id } },
        body: { action: "end" },
      });
      if (!response.ok) throw new Error("Could not end the block.");
    },
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });

  const session = active.data;
  return (
    <Card>
      <Eyebrow>Deep work</Eyebrow>
      {session ? (
        <Running session={session} onEnd={() => end.mutate(session.id)} />
      ) : (
        <>
          <p className="mt-4 font-mono text-5xl tabular-nums tracking-tight">{format(minutes * 60)}</p>
          <div className="mt-4 flex gap-2" role="group" aria-label="Block length">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                  minutes === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-border-strong"
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
          <Button className="mt-4" loading={start.isPending} onClick={() => start.mutate()}>
            <Play className="size-4" /> Start block
          </Button>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            {TIPS.map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">
        {minutesToday} of {target} minutes logged today.
      </p>
    </Card>
  );
}
