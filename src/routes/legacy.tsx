import { createFileRoute } from "@tanstack/react-router";
import { Check, Flag, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import type { Milestone } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/legacy")({
  head: () => ({
    meta: [
      { title: "Legacy Timeline — Alter Ego OS" },
      {
        name: "description",
        content:
          "Two-year, five-year and lifetime milestones with progress tracking and quarterly review.",
      },
      { property: "og:title", content: "Legacy Timeline — Alter Ego OS" },
      {
        property: "og:description",
        content: "Long-horizon milestones that keep the daily protocol pointed somewhere.",
      },
    ],
  }),
  component: Legacy,
});

const horizons: Milestone["horizon"][] = ["2-year", "5-year", "lifetime"];

function Legacy() {
  const { milestones, toggleMilestone, addMilestone } = useAppState();
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<Milestone["horizon"]>("2-year");
  const complete = milestones.filter((m) => m.done).length;

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("legacy_layer", "Layer 07")}
        title={t("legacy_title", "Legacy Timeline")}
        description={t("legacy_description", "The arc your daily protocol is calibrated to. Reviewed every quarter.")}
        action={
          <Button
            variant="outline"
            onClick={() => toast.success(t("legacy_review_scheduled", "Quarterly review set for 30 Sep."))}
          >
            {t("legacy_schedule_review", "Schedule quarterly review")}
          </Button>
        }
      />

      <div className="card-surface rise-in mb-6 grid gap-6 p-6 sm:grid-cols-3">
        {[
          [t("legacy_milestones_mapped", "Milestones mapped"), milestones.length],
          [t("legacy_completed", "Completed"), complete],
          [
            t("legacy_average_progress", "Average progress"),
            `${Math.round(milestones.reduce((a, m) => a + m.progress, 0) / milestones.length)}%`,
          ],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl">{value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="2-year">
        <TabsList>
          {horizons.map((h) => (
            <TabsTrigger key={h} value={h} className="capitalize">
              {t(`horizon_${h.replace("-", "_")}`, h)}
            </TabsTrigger>
          ))}
        </TabsList>

        {horizons.map((h) => {
          const list = milestones.filter((m) => m.horizon === h);
          return (
            <TabsContent key={h} value={h} className="mt-5">
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
                            <h2
                              className={cn(
                                "text-lg",
                                m.done && "text-muted-foreground line-through",
                              )}
                            >
                              {t(`milestone_${m.id}_title`, m.title)}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">{t(`milestone_${m.id}_detail`, m.detail)}</p>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {t(`milestone_${m.id}_due`, m.due)}
                          </span>
                        </div>
                        <Progress value={m.progress} className="mt-4 h-1" />
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{m.progress}%</span>
                          <Button size="sm" variant="ghost" onClick={() => toggleMilestone(m.id)}>
                            <Check className="size-3.5" />
                            {m.done ? t("legacy_reopen", "Reopen") : t("legacy_mark_complete", "Mark complete")}
                          </Button>
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("legacy_placeholder", "What must be true?")}
          />
          <div className="flex gap-2">
            {horizons.map((h) => (
              <Button
                key={h}
                variant={horizon === h ? "default" : "outline"}
                onClick={() => setHorizon(h)}
                className="capitalize"
              >
                {t(`horizon_${h.replace("-", "_")}`, h)}
              </Button>
            ))}
            <Button
              variant="secondary"
              onClick={() => {
                if (!title.trim()) {
                  toast.error(t("legacy_name_required", "Give the milestone a name."));
                  return;
                }
                addMilestone({
                  title: title.trim(),
                  detail: "Added manually",
                  due: "TBD",
                  horizon,
                });
                setTitle("");
                toast.success(t("legacy_added", "Milestone added to your timeline."));
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
