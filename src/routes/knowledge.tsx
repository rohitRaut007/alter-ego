import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge System — Alter Ego OS" },
      {
        name: "description",
        content:
          "A personalised reading roadmap, notes and a collision notebook, recompiled weekly by your AI mentor.",
      },
      { property: "og:title", content: "Knowledge System — Alter Ego OS" },
      {
        property: "og:description",
        content: "A reading and thinking pipeline, not a to-read pile.",
      },
    ],
  }),
  component: Knowledge,
});

function Knowledge() {
  const { books, notes, updateBookProgress, addNote } = useAppState();
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ title: "", source: "", body: "" });

  const roadmap = [
    { phase: "Now", focus: "Systems & leverage", books: 3 },
    { phase: "Next 90 days", focus: "Presence & communication", books: 2 },
    { phase: "This year", focus: "Epistemics & long horizons", books: 4 },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("knowledge_layer", "Layer 03")}
        title={t("knowledge_title", "Knowledge System")}
        description={t("knowledge_description", "What you read shapes what you can build. This pipeline is curated against your protocol.")}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tabs defaultValue="reading">
            <TabsList>
              <TabsTrigger value="reading">{t("knowledge_reading_list", "Reading list")}</TabsTrigger>
              <TabsTrigger value="notes">{t("knowledge_notes", "Notes")}</TabsTrigger>
              <TabsTrigger value="collision">{t("knowledge_collision_notebook", "Collision notebook")}</TabsTrigger>
            </TabsList>

            <TabsContent value="reading" className="mt-4 space-y-3">
              {books.map((b) => (
                <div key={b.id} className="card-surface p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg">{t(`book_${b.id}_title`, b.title)}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t(`book_${b.id}_author`, b.author)} · {t(`book_cat_${b.category.toLowerCase()}`, b.category)}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(`book_status_${b.status}`, b.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`book_${b.id}_why`, b.why)}</p>
                  <Progress value={b.progress} className="mt-4 h-1" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{b.progress}% {t("knowledge_percent_read", "read")}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          updateBookProgress(b.id, Math.min(100, b.progress + 10));
                          toast.success(t("knowledge_progress_logged", "Progress logged."));
                        }}
                      >
                        {t("knowledge_progress_btn", "+10%")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateBookProgress(b.id, 100)}
                      >
                        {t("knowledge_finish", "Finish")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-3">
              {notes.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center text-sm text-muted-foreground">
                  {t("knowledge_no_notes", "No notes yet. Capture one idea per reading session.")}
                </div>
              )}
              {notes.map((n) => (
                <div key={n.id} className="card-surface p-5">
                  <h3 className="text-lg leading-snug">{t(`note_${n.id}_title`, n.title)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(`note_${n.id}_source`, n.source)} · {t(`note_${n.id}_created`, n.createdAt)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`note_${n.id}_body`, n.body)}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="collision" className="mt-4">
              <div className="card-surface p-5">
                <p className="label-eyebrow">{t("knowledge_new_collision", "New collision")}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("knowledge_collision_help", "Where two ideas from different books crash into each other.")}
                </p>
                <div className="mt-4 space-y-3">
                  <Input
                    placeholder={t("knowledge_collision_title_placeholder", "Title")}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                  <Input
                    placeholder={t("knowledge_collision_sources_placeholder", "Sources (e.g. Impro × Thinking in Systems)")}
                    value={draft.source}
                    onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                  />
                  <Textarea
                    rows={4}
                    placeholder={t("knowledge_collision_thought_placeholder", "What does the collision produce?")}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!draft.title.trim() || !draft.body.trim()) {
                        toast.error(t("knowledge_collision_required", "A collision needs a title and a thought."));
                        return;
                      }
                      addNote({ ...draft, tags: ["collision"] });
                      setDraft({ title: "", source: "", body: "" });
                      toast.success(t("knowledge_collision_captured", "Collision captured."));
                    }}
                  >
                    <Plus className="size-4" /> {t("knowledge_save_collision", "Save collision")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <p className="label-eyebrow">{t("knowledge_weekly_recommendation", "Weekly recommendation")}</p>
            </div>
            <p className="mt-3 font-display text-xl leading-snug">
              {t("knowledge_recommendation_headline", "Finish Impro before adding anything new.")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("knowledge_recommendation_body", "Presence is your weakest layer at 43%. Impro maps directly onto the speaking reps you committed to this sprint.")}
            </p>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-accent" />
              <p className="label-eyebrow">{t("knowledge_learning_roadmap", "Learning roadmap")}</p>
            </div>
            <div className="mt-4 space-y-3">
              {roadmap.map((r, idx) => (
                <div key={r.phase} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-sm font-semibold">{t(`roadmap_phase_${idx + 1}`, r.phase)}</p>
                  <p className="text-xs text-muted-foreground">{t(`roadmap_focus_${idx + 1}`, r.focus)}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {r.books} {t("knowledge_titles", "titles")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
