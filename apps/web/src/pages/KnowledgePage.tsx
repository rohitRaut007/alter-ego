import type { Library, Note, ReadingItem, SafetyNotice } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Brain, Loader2, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";

interface AdvisorTurn {
  q: string;
  a: string;
  sources: Array<{ id: string; title: string; author: string; summary: string }>;
}

const PHASE_LABEL = {
  now: ["roadmap_phase_1", "Now"],
  next_90_days: ["roadmap_phase_2", "Next 90 days"],
  this_year: ["roadmap_phase_3", "This year"],
} as const;

export function KnowledgePage() {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [aiQuery, setAiQuery] = useState("");
  const [aiHistory, setAiHistory] = useState<AdvisorTurn[]>([]);
  const [safety, setSafety] = useState<SafetyNotice | null>(null);
  const [draft, setDraft] = useState({ title: "", source: "", body: "" });
  const [finishing, setFinishing] = useState<ReadingItem | null>(null);
  const [destruction, setDestruction] = useState("");

  const library = useQuery({
    queryKey: ["knowledge", "library"],
    queryFn: async (): Promise<Library | null> => {
      const { data, response } = await api.GET("/api/v1/knowledge/library");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load the library.");
      return data;
    },
  });
  const notes = useQuery({
    queryKey: ["knowledge", "notes"],
    enabled: library.data != null,
    queryFn: async (): Promise<Note[]> => (await api.GET("/api/v1/knowledge/notes")).data ?? [],
  });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["knowledge"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);

  const progress = useMutation({
    mutationFn: async (v: { id: string; progress?: number; status?: "want" | "reading" | "finished" }) => {
      const { id, ...body } = v;
      const { response } = await api.PATCH("/api/v1/knowledge/items/{id}", {
        params: { path: { id } },
        body,
      });
      if (!response.ok) throw new Error("save failed");
    },
    onSuccess: refresh,
    onError: () => toast.error(t("knowledge_save_error", "That did not save. Please try again.")),
  });

  const addNote = useMutation({
    mutationFn: async (v: {
      title: string;
      body: string;
      source?: string;
      kind: "note" | "collision" | "destruction_test";
      item_id?: string;
    }) => {
      const { data } = await api.POST("/api/v1/knowledge/notes", {
        body: { ...v, source: v.source ?? "" },
      });
      if (!data) throw new Error("save failed");
      return data;
    },
    onSuccess: async (res) => {
      if (res.safety) {
        setSafety(res.safety);
        return;
      }
      await refresh();
    },
    onError: () => toast.error(t("knowledge_save_error", "That did not save. Please try again.")),
  });

  const removeNote = useMutation({
    mutationFn: async (id: string) => {
      await api.DELETE("/api/v1/knowledge/notes/{id}", { params: { path: { id } } });
    },
    onSuccess: refresh,
  });

  const advisor = useMutation({
    mutationFn: async (query: string) => {
      const { data } = await api.POST("/api/v1/knowledge/advisor", { body: { query } });
      if (!data) throw new Error("advisor failed");
      return { query, data };
    },
    onSuccess: ({ query, data }) => {
      if (data.safety) {
        setSafety(data.safety);
        return;
      }
      setAiHistory((h) => [...h, { q: query, a: data.answer, sources: data.sources }]);
    },
    onError: () =>
      toast.error(t("knowledge_ai_error", "The advisor could not respond. Please try again.")),
  });

  function ask(q: string) {
    const query = q.trim();
    if (!query || advisor.isPending) return;
    setAiQuery("");
    setSafety(null);
    advisor.mutate(query);
  }

  if (library.isPending) {
    return (
      <AppShell>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </AppShell>
    );
  }
  if (library.isError) {
    return (
      <AppShell>
        <div className="card-surface p-6">
          <p role="alert" className="text-sm text-destructive">
            {t("knowledge_load_error", "We could not load your knowledge system.")}
          </p>
          <Button className="mt-4" onClick={() => void library.refetch()}>
            {t("retry", "Retry")}
          </Button>
        </div>
      </AppShell>
    );
  }
  if (library.data === null) {
    return (
      <AppShell>
        <PageHeader eyebrow={t("knowledge_layer", "Layer 03")} title={t("knowledge_title", "Knowledge System")} />
        <div className="card-surface p-6">
          <p className="text-sm text-muted-foreground">
            {t("knowledge_no_books", "Your reading list is created from your protocol after the interview.")}
          </p>
          <Button asChild className="mt-4">
            <Link to="/onboarding">{t("home_start_interview", "Start the interview")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const lib = library.data;
  const rec = lib.recommendation;
  const quickPrompts = [
    t("knowledge_ai_prompt_recommend", "What should I read next based on my goals?"),
    t("knowledge_ai_prompt_summary", "Summarize my notes and find patterns"),
    t("knowledge_ai_prompt_roadmap", "Create a 90-day reading roadmap for me"),
    t("knowledge_ai_prompt_collision", "Find connections between my current books"),
  ];
  const allNotes = notes.data ?? [];
  const collisions = allNotes.filter((n) => n.kind === "collision");

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("knowledge_layer", "Layer 03")}
        title={t("knowledge_title", "Knowledge System")}
        description={t(
          "knowledge_description",
          "What you read shapes what you can build. This list is sequenced against your protocol.",
        )}
      />

      {safety ? (
        <div className="mb-5">
          <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tabs defaultValue="reading">
            <TabsList>
              <TabsTrigger value="reading">{t("knowledge_reading_list", "Reading list")}</TabsTrigger>
              <TabsTrigger value="ai">
                <Brain className="mr-1 size-3.5" />
                {t("knowledge_ai_tab", "Advisor")}
              </TabsTrigger>
              <TabsTrigger value="notes">{t("knowledge_notes", "Notes")}</TabsTrigger>
              <TabsTrigger value="collision">
                {t("knowledge_collision_notebook", "Collision notebook")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reading" className="mt-4 space-y-3">
              {lib.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center text-sm text-muted-foreground">
                  {t("knowledge_no_books", "No titles on your reading list yet.")}
                </div>
              ) : null}
              {lib.items.map((b) => (
                <div key={b.id} className="card-surface p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg">{b.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {b.author} · ~{b.estimated_hours}h
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(`book_status_${b.status}`, b.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.why_now}</p>
                  <Progress value={b.progress} className="mt-4 h-1" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {b.progress}% {t("knowledge_percent_read", "read")}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={progress.isPending || b.status === "finished"}
                        onClick={() =>
                          progress.mutate({ id: b.id, progress: Math.min(100, b.progress + 10) })
                        }
                      >
                        {t("knowledge_progress_btn", "+10%")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={progress.isPending || b.status === "finished"}
                        onClick={() => {
                          setDestruction("");
                          setFinishing(b);
                        }}
                      >
                        {t("knowledge_finish", "Finish")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <div className="card-surface p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Brain className="size-4 text-accent" />
                  <p className="label-eyebrow">{t("knowledge_ai_heading", "Knowledge advisor")}</p>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  {t(
                    "knowledge_ai_desc",
                    "Ask for reading recommendations, note summaries or connections. Recommendations come from a curated source set and your own list.",
                  )}
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {quickPrompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => ask(p)}
                      disabled={advisor.isPending}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {aiHistory.length > 0 ? (
                  <div className="mb-4 max-h-96 space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-4">
                    {aiHistory.map((item, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="ml-auto w-fit max-w-[80%] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                          {item.q}
                        </div>
                        <div className="whitespace-pre-wrap rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                          {item.a}
                        </div>
                        {item.sources.length > 0 ? (
                          <ul className="space-y-1.5">
                            {item.sources.map((s) => (
                              <li key={s.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                                <span className="font-semibold">{s.title}</span> · {s.author}
                                <span className="mt-0.5 block text-muted-foreground">{s.summary}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                    {advisor.isPending ? (
                      <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        {t("knowledge_ai_thinking", "Looking through your reading system…")}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder={t("knowledge_ai_placeholder", "Ask about your reading, notes or learning path…")}
                    aria-label="Ask the advisor"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") ask(aiQuery);
                    }}
                    className="bg-card"
                    disabled={advisor.isPending}
                  />
                  <Button
                    size="icon"
                    disabled={!aiQuery.trim() || advisor.isPending}
                    onClick={() => ask(aiQuery)}
                    aria-label="Ask"
                  >
                    {advisor.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-3">
              {allNotes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center text-sm text-muted-foreground">
                  {t("knowledge_no_notes", "No notes yet. Capture one idea per reading session.")}
                </div>
              ) : null}
              {allNotes.map((n) => (
                <div key={n.id} className="card-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg leading-snug">{n.title}</h3>
                    <button
                      type="button"
                      aria-label="Delete note"
                      onClick={() => removeNote.mutate(n.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.source ? `${n.source} · ` : ""}
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {n.body}
                  </p>
                  {n.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {n.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
                    aria-label="Collision title"
                    placeholder={t("knowledge_collision_title_placeholder", "Title")}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                  <Input
                    aria-label="Collision sources"
                    placeholder={t("knowledge_collision_sources_placeholder", "Sources (e.g. Impro × Thinking in Systems)")}
                    value={draft.source}
                    onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                  />
                  <Textarea
                    rows={4}
                    aria-label="Collision thought"
                    placeholder={t("knowledge_collision_thought_placeholder", "What does the collision produce?")}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                  <Button
                    className="w-full"
                    disabled={addNote.isPending}
                    onClick={() => {
                      if (!draft.title.trim() || !draft.body.trim()) {
                        toast.error(t("knowledge_collision_required", "A collision needs a title and a thought."));
                        return;
                      }
                      addNote.mutate(
                        { ...draft, kind: "collision" },
                        {
                          onSuccess: (res) => {
                            if (!res.safety) {
                              setDraft({ title: "", source: "", body: "" });
                              toast.success(t("knowledge_collision_captured", "Collision captured."));
                            }
                          },
                        },
                      );
                    }}
                  >
                    <Plus className="size-4" /> {t("knowledge_save_collision", "Save collision")}
                  </Button>
                </div>
              </div>
              {collisions.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {collisions.map((n) => (
                    <li key={n.id} className="card-surface p-4 text-sm">
                      <p className="font-semibold">{n.title}</p>
                      {n.source ? <p className="text-xs text-muted-foreground">{n.source}</p> : null}
                      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{n.body}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <p className="label-eyebrow">{t("knowledge_weekly_recommendation", "Weekly recommendation")}</p>
            </div>
            {rec ? (
              <>
                <p className="mt-3 font-display text-xl leading-snug">
                  {rec.kind === "finish"
                    ? `${t("knowledge_finish_current", "Finish")} “${rec.title}” ${t("knowledge_before_new", "before adding anything new.")}`
                    : rec.kind === "start"
                      ? `${t("knowledge_start_next", "Start")} “${rec.title}”.`
                      : `${t("knowledge_discover", "Consider")} “${rec.title}” ${t("knowledge_by", "by")} ${rec.author}.`}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rec.reason}</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("knowledge_no_recommendation", "Add a title to your list to get recommendations.")}
              </p>
            )}
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-accent" />
              <p className="label-eyebrow">{t("knowledge_learning_roadmap", "Learning roadmap")}</p>
            </div>
            <div className="mt-4 space-y-3">
              {lib.roadmap.map((r) => (
                <div key={r.phase} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-sm font-semibold">
                    {t(PHASE_LABEL[r.phase][0], PHASE_LABEL[r.phase][1])}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.focus}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {r.titles.length} {t("knowledge_titles", "titles")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("knowledge_stats", "Reading stats")}</p>
            <div className="mt-4 space-y-2 text-sm">
              {[
                [t("knowledge_books_reading", "Currently reading"), lib.stats.reading],
                [t("knowledge_books_finished", "Finished"), lib.stats.finished],
                [t("knowledge_notes_count", "Notes captured"), lib.stats.notes],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={finishing !== null} onOpenChange={(o) => !o && setFinishing(null)}>
        <DialogContent className="max-w-lg">
          {finishing ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-normal">
                  {t("knowledge_destruction_title", "Destruction test")}
                </DialogTitle>
                <DialogDescription className="leading-relaxed">
                  {lib.destruction_test_template}
                </DialogDescription>
              </DialogHeader>
              <Textarea
                rows={5}
                aria-label="Destruction test"
                value={destruction}
                onChange={(e) => setDestruction(e.target.value)}
                placeholder={t("knowledge_destruction_placeholder", "The strongest argument against this book is…")}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    progress.mutate({ id: finishing.id, status: "finished" });
                    setFinishing(null);
                  }}
                >
                  {t("knowledge_skip_test", "Finish without it")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!destruction.trim() || addNote.isPending}
                  onClick={() => {
                    const item = finishing;
                    addNote.mutate(
                      {
                        title: `Destruction test: ${item.title}`,
                        body: destruction.trim(),
                        kind: "destruction_test",
                        item_id: item.id,
                      },
                      {
                        onSuccess: (res) => {
                          if (res.safety) return;
                          progress.mutate({ id: item.id, status: "finished" });
                          setFinishing(null);
                        },
                      },
                    );
                  }}
                >
                  {t("knowledge_save_and_finish", "Save and finish")}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
