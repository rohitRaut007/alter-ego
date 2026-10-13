import type { Milestone, SafetyNotice, Timeline } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flag, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HORIZONS = [
  { id: "2y", key: "horizon_2_year", label: "2-year" },
  { id: "5y", key: "horizon_5_year", label: "5-year" },
  { id: "life", key: "horizon_lifetime", label: "Lifetime" },
] as const;

type HorizonId = (typeof HORIZONS)[number]["id"];

export function LegacyPage() {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<HorizonId>("2y");
  const [safety, setSafety] = useState<SafetyNotice | null>(null);
  const [review, setReview] = useState({ on_track: "", change: "" });

  const timeline = useQuery({
    queryKey: ["legacy", "timeline"],
    queryFn: async (): Promise<{ data: Timeline | null; locked: boolean }> => {
      const { data, response } = await api.GET("/api/v1/legacy/timeline");
      if (response.status === 403) return { data: null, locked: true };
      if (response.status === 404) return { data: null, locked: false };
      if (!data) throw new Error("Could not load the timeline.");
      return { data, locked: false };
    },
  });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["legacy"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);

  const update = useMutation({
    mutationFn: async (v: { id: string; done?: boolean; progress?: number }) => {
      const { id, ...body } = v;
      const { data } = await api.PATCH("/api/v1/legacy/milestones/{id}", {
        params: { path: { id } },
        body,
      });
      if (!data) throw new Error("save failed");
    },
    onSuccess: refresh,
    onError: () => toast.error(t("legacy_save_error", "That did not save. Please try again.")),
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data } = await api.POST("/api/v1/legacy/milestones", {
        body: { title: title.trim(), horizon, detail: "", due_label: "" },
      });
      if (!data) throw new Error("save failed");
      return data;
    },
    onSuccess: async (res) => {
      if (res.safety) {
        setSafety(res.safety);
        return;
      }
      setTitle("");
      toast.success(t("legacy_added", "Milestone added to your timeline."));
      await refresh();
    },
    onError: () => toast.error(t("legacy_save_error", "That did not save. Please try again.")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { response } = await api.DELETE("/api/v1/legacy/milestones/{id}", {
        params: { path: { id } },
      });
      if (!response.ok) throw new Error("not allowed");
    },
    onSuccess: refresh,
    onError: () => toast.error(t("legacy_delete_error", "Milestones from your protocol cannot be deleted.")),
  });

  const schedule = useMutation({
    mutationFn: async () => {
      const { data } = await api.POST("/api/v1/legacy/reviews", { body: {} });
      if (!data) throw new Error("schedule failed");
      return data;
    },
    onSuccess: async (r) => {
      toast.success(`${t("legacy_review_scheduled", "Quarterly review set for")} ${r.scheduled_for}.`);
      await refresh();
    },
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.POST("/api/v1/legacy/reviews/{id}/complete", {
        params: { path: { id } },
        body: review,
      });
      if (!data) throw new Error("save failed");
      return data;
    },
    onSuccess: async (res) => {
      if (res.safety) {
        setSafety(res.safety);
        return;
      }
      setReview({ on_track: "", change: "" });
      toast.success(t("legacy_review_done", "Quarterly review recorded."));
      await refresh();
    },
  });

  if (timeline.isPending) {
    return (
      <AppShell>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
      </AppShell>
    );
  }
  if (timeline.isError) {
    return (
      <AppShell>
        <div className="card-surface p-6">
          <p role="alert" className="text-sm text-destructive">
            {t("legacy_load_error", "We could not load your timeline.")}
          </p>
          <Button className="mt-4" onClick={() => void timeline.refetch()}>
            {t("retry", "Retry")}
          </Button>
        </div>
      </AppShell>
    );
  }
  if (timeline.data.locked) {
    return (
      <AppShell>
        <PageHeader eyebrow={t("legacy_layer", "Layer 07")} title={t("legacy_title", "Legacy Timeline")} />
        <div className="card-surface p-6">
          <p className="text-sm">
            {t("legacy_locked", "The Legacy Timeline is part of the Full plan and is not included in yours.")}
          </p>
        </div>
      </AppShell>
    );
  }
  if (timeline.data.data === null) {
    return (
      <AppShell>
        <PageHeader eyebrow={t("legacy_layer", "Layer 07")} title={t("legacy_title", "Legacy Timeline")} />
        <div className="card-surface p-6">
          <p className="text-sm text-muted-foreground">
            {t("legacy_no_protocol", "Your timeline is built from your protocol after the interview.")}
          </p>
          <Button asChild className="mt-4">
            <Link to="/onboarding">{t("home_start_interview", "Start the interview")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const tl = timeline.data.data;
  const nextReview = tl.next_review;

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("legacy_layer", "Layer 07")}
        title={t("legacy_title", "Legacy Timeline")}
        description={t("legacy_description", "The arc your daily protocol is calibrated to. Reviewed every quarter.")}
        action={
          <Button
            variant="outline"
            disabled={schedule.isPending || Boolean(nextReview)}
            onClick={() => schedule.mutate()}
          >
            {nextReview
              ? `${t("legacy_review_on", "Review on")} ${nextReview.scheduled_for}`
              : t("legacy_schedule_review", "Schedule quarterly review")}
          </Button>
        }
      />

      {safety ? (
        <div className="mb-5">
          <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />
        </div>
      ) : null}

      <div className="card-surface rise-in mb-6 grid gap-6 p-6 sm:grid-cols-3">
        {[
          [t("legacy_milestones_mapped", "Milestones mapped"), tl.summary.total],
          [t("legacy_completed", "Completed"), tl.summary.done],
          [t("legacy_average_progress", "Average progress"), `${tl.summary.average_progress}%`],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl">{value}</p>
          </div>
        ))}
      </div>

      {nextReview ? (
        <section className="card-surface mb-6 p-5">
          <p className="label-eyebrow">
            {t("legacy_review", "Quarterly review")} · {nextReview.scheduled_for}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Textarea
              rows={3}
              aria-label="Are you on track?"
              placeholder={t("legacy_review_on_track", "Are you on track? What changed?")}
              value={review.on_track}
              onChange={(e) => setReview({ ...review, on_track: e.target.value })}
            />
            <Textarea
              rows={3}
              aria-label="What needs to change?"
              placeholder={t("legacy_review_change", "What needs to change?")}
              value={review.change}
              onChange={(e) => setReview({ ...review, change: e.target.value })}
            />
          </div>
          <Button
            className="mt-3"
            disabled={!review.on_track.trim() || complete.isPending}
            onClick={() => complete.mutate(nextReview.id)}
          >
            {t("legacy_complete_review", "Complete review")}
          </Button>
        </section>
      ) : null}

      <Tabs defaultValue="2y">
        <TabsList>
          {HORIZONS.map((h) => (
            <TabsTrigger key={h.id} value={h.id}>
              {t(h.key, h.label)}
            </TabsTrigger>
          ))}
        </TabsList>

        {HORIZONS.map((h) => {
          const list = tl.milestones.filter((m: Milestone) => m.horizon === h.id);
          return (
            <TabsContent key={h.id} value={h.id} className="mt-5">
              {list.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
                  {t("legacy_no_milestones", "No milestones on this horizon yet. Add the first one below.")}
                </div>
              ) : (
                <ol className="relative space-y-3 border-l border-border pl-6">
                  {list.map((m) => (
                    <li key={m.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[31px] top-5 flex size-4 items-center justify-center rounded-full border-2 border-background",
                          m.done ? "bg-success" : "bg-accent",
                        )}
                      />
                      <div className="card-surface p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className={cn("text-lg", m.done && "text-muted-foreground line-through")}>
                              {m.title}
                            </h2>
                            {m.detail ? (
                              <p className="mt-1 text-sm text-muted-foreground">{m.detail}</p>
                            ) : null}
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {m.due_label}
                          </span>
                        </div>
                        <Progress value={m.progress} className="mt-4 h-1" />
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{m.progress}%</span>
                          <div className="flex gap-1">
                            {m.origin === "user" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label="Delete milestone"
                                onClick={() => remove.mutate(m.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={update.isPending}
                              onClick={() => update.mutate({ id: m.id, done: !m.done })}
                            >
                              <Check className="size-3.5" />
                              {m.done ? t("legacy_reopen", "Reopen") : t("legacy_mark_complete", "Mark complete")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <section className="card-surface mt-6 p-5">
        <div className="flex items-center gap-2">
          <Flag className="size-4 text-accent" />
          <p className="label-eyebrow">{t("legacy_add_milestone", "Add milestone")}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Milestone"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("legacy_placeholder", "What must be true?")}
          />
          <div className="flex gap-2">
            {HORIZONS.map((h) => (
              <Button
                key={h.id}
                variant={horizon === h.id ? "default" : "outline"}
                aria-pressed={horizon === h.id}
                onClick={() => setHorizon(h.id)}
              >
                {t(h.key, h.label)}
              </Button>
            ))}
            <Button
              variant="secondary"
              aria-label="Add milestone"
              disabled={add.isPending}
              onClick={() => {
                if (!title.trim()) {
                  toast.error(t("legacy_name_required", "Give the milestone a name."));
                  return;
                }
                add.mutate();
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
