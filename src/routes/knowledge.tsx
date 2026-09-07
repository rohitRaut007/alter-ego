import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Brain, Loader2, Plus, Send, Sparkles } from "lucide-react";
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
import { callKnowledgeAiServerFn, type KnowledgeAIPayload } from "@/services/knowledge-ai";

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
  const { books, notes, updateBookProgress, addNote, onboardingAnswers, personalityScores, settings } =
    useAppState();
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ title: "", source: "", body: "" });
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ q: string; a: string }>>([]);

  const getAnswer = (key: string): string => {
    const val = onboardingAnswers[key];
    if (Array.isArray(val)) return val.join(", ");
    return val || "";
  };

  const quickPrompts = [
    t("knowledge_ai_prompt_recommend", "What should I read next based on my goals?"),
    t("knowledge_ai_prompt_summary", "Summarize my notes and find patterns"),
    t("knowledge_ai_prompt_roadmap", "Create a 90-day reading roadmap for me"),
    t("knowledge_ai_prompt_collision", "Find connections between my current books"),
  ];

  async function askKnowledgeAI(query: string) {
    if (!query.trim() || aiLoading) return;
    setAiLoading(true);
    const q = query.trim();
    setAiQuery("");

    try {
      const payload: KnowledgeAIPayload = {
        query: q,
        userGoal: getAnswer("q9") || getAnswer("q1"),
        userDomain: getAnswer("q2"),
        currentBooks: books.map((b) => ({
          title: b.title,
          author: b.author,
          progress: b.progress,
        })),
        notes: notes.map((n) => ({ title: n.title, body: n.body })),
      };
      if (personalityScores) {
        payload.personalityScores = {
          openness: personalityScores.openness,
          conscientiousness: personalityScores.conscientiousness,
          extraversion: personalityScores.extraversion,
        };
      }

      const result = await callKnowledgeAiServerFn({ data: payload });
      setAiHistory((prev) => [...prev, { q, a: result.response }]);
      setAiResponse(result.response);
    } catch (err) {
      toast.error(t("knowledge_ai_error", "Could not reach AI. Check your API key configuration."));
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  // Dynamic roadmap based on onboarding answers
  const domain = getAnswer("q2") || "your domain";
  const goal = getAnswer("q1") || "your goals";
  const roadmap = [
    {
      phase: t("roadmap_phase_1", "Now"),
      focus: domain ? `${domain} foundations` : t("roadmap_focus_1", "Systems & leverage"),
      books: Math.max(1, books.filter((b) => b.status === "reading").length),
    },
    {
      phase: t("roadmap_phase_2", "Next 90 days"),
      focus: t("roadmap_focus_2", "Presence & communication"),
      books: 2,
    },
    {
      phase: t("roadmap_phase_3", "This year"),
      focus: t("roadmap_focus_3", "Epistemics & long horizons"),
      books: 4,
    },
  ];

  // Personalized weekly recommendation
  const readingBooks = books.filter((b) => b.status === "reading");
  const weeklyRec = readingBooks.length > 0 ? readingBooks[0] : null;

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("knowledge_layer", "Layer 03")}
        title={t("knowledge_title", "Knowledge System")}
        description={t(
          "knowledge_description",
          "What you read shapes what you can build. This pipeline is curated against your protocol.",
        )}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tabs defaultValue="reading">
            <TabsList>
              <TabsTrigger value="reading">{t("knowledge_reading_list", "Reading list")}</TabsTrigger>
              <TabsTrigger value="ai">
                <Brain className="size-3.5 mr-1" />
                {t("knowledge_ai_tab", "AI Analysis")}
              </TabsTrigger>
              <TabsTrigger value="notes">{t("knowledge_notes", "Notes")}</TabsTrigger>
              <TabsTrigger value="collision">{t("knowledge_collision_notebook", "Collision notebook")}</TabsTrigger>
            </TabsList>

            <TabsContent value="reading" className="mt-4 space-y-3">
              {books.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center text-sm text-muted-foreground">
                  {t("knowledge_no_books", "No books in your reading list yet. Your protocol will add them after onboarding.")}
                </div>
              )}
              {books.map((b) => (
                <div key={b.id} className="card-surface p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg">{b.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {b.author} · {b.category}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(`book_status_${b.status}`, b.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.why}</p>
                  <Progress value={b.progress} className="mt-4 h-1" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {b.progress}% {t("knowledge_percent_read", "read")}
                    </span>
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

            <TabsContent value="ai" className="mt-4">
              <div className="card-surface p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="size-4 text-accent" />
                  <p className="label-eyebrow">{t("knowledge_ai_heading", "AI Knowledge Advisor")}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("knowledge_ai_desc", "Ask for personalized reading recommendations, note summaries, or learning roadmaps — calibrated to your goals and personality.")}
                </p>

                {/* Quick prompts */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void askKnowledgeAI(prompt)}
                      disabled={aiLoading}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Conversation history */}
                {aiHistory.length > 0 && (
                  <div className="mb-4 max-h-80 space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-4">
                    {aiHistory.map((item, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="ml-auto w-fit max-w-[80%] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                          {item.q}
                        </div>
                        <div className="prose prose-sm max-w-none rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                          {item.a}
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        {t("knowledge_ai_thinking", "Analyzing your knowledge system…")}
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder={t("knowledge_ai_placeholder", "Ask about your reading, notes, or learning path…")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void askKnowledgeAI(aiQuery);
                    }}
                    className="bg-card"
                    disabled={aiLoading}
                  />
                  <Button
                    size="icon"
                    disabled={!aiQuery.trim() || aiLoading}
                    onClick={() => void askKnowledgeAI(aiQuery)}
                    aria-label="Ask AI"
                  >
                    {aiLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-3">
              {notes.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center text-sm text-muted-foreground">
                  {t("knowledge_no_notes", "No notes yet. Capture one idea per reading session.")}
                </div>
              )}
              {notes.map((n) => (
                <div key={n.id} className="card-surface p-5">
                  <h3 className="text-lg leading-snug">{n.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.source} · {n.createdAt}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                  {n.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {n.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
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
                    placeholder={t(
                      "knowledge_collision_sources_placeholder",
                      "Sources (e.g. Impro × Thinking in Systems)",
                    )}
                    value={draft.source}
                    onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                  />
                  <Textarea
                    rows={4}
                    placeholder={t(
                      "knowledge_collision_thought_placeholder",
                      "What does the collision produce?",
                    )}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!draft.title.trim() || !draft.body.trim()) {
                        toast.error(
                          t("knowledge_collision_required", "A collision needs a title and a thought."),
                        );
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
            {weeklyRec ? (
              <>
                <p className="mt-3 font-display text-xl leading-snug">
                  {t("knowledge_finish_current", `Finish ${weeklyRec.title} before adding anything new.`)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {weeklyRec.why || t("knowledge_recommendation_body", "Focus compounds. Complete what you started before opening the next volume.")}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("knowledge_no_recommendation", "Complete onboarding to get personalized recommendations.")}
              </p>
            )}
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-accent" />
              <p className="label-eyebrow">{t("knowledge_learning_roadmap", "Learning roadmap")}</p>
            </div>
            <div className="mt-4 space-y-3">
              {roadmap.map((r, idx) => (
                <div key={r.phase} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-sm font-semibold">{r.phase}</p>
                  <p className="text-xs text-muted-foreground">{r.focus}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {r.books} {t("knowledge_titles", "titles")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Stats */}
          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("knowledge_stats", "Reading stats")}</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("knowledge_books_reading", "Currently reading")}</span>
                <span className="font-semibold">{books.filter(b => b.status === "reading").length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("knowledge_books_finished", "Finished")}</span>
                <span className="font-semibold">{books.filter(b => b.status === "finished").length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("knowledge_notes_count", "Notes captured")}</span>
                <span className="font-semibold">{notes.length}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
