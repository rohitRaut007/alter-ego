import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MessageSquare, Plus, Send, Sparkles, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/lib/app-state";
import { useLanguage } from "@/lib/i18n";
import { challenges, suggestedPrompts } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mentor")({
  head: () => ({
    meta: [
      { title: "AI Mentor — Alter Ego OS" },
      {
        name: "description",
        content:
          "A context-aware mentor that knows your protocol, your sprint and your streaks — with weekly accountability challenges.",
      },
      { property: "og:title", content: "AI Mentor — Alter Ego OS" },
      {
        property: "og:description",
        content: "Coaching that references your actual protocol instead of generic advice.",
      },
    ],
  }),
  component: Mentor,
});

function Mentor() {
  const { conversations, sendMentorMessage, startConversation } = useAppState();
  const { t } = useLanguage();
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, pending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    setDraft("");
    setPending(true);
    try {
      const res = await sendMentorMessage(active?.id ?? null, content);
      if (res && res.conversationId && res.conversationId !== active?.id) {
        setActiveId(res.conversationId);
      }
    } catch (err) {
      console.error("[MENTOR PAGE SEND ERROR]", err);
      toast.error(t("mentor_error", "Could not reach AI Mentor. Please check your API key configuration."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("always_on", "Always on")}
        title={t("mentor_title", "AI Mentor")}
        description={t("mentor_subtitle", "It sees every layer, every streak and every missed block. Ask it something precise.")}
        action={
          <Button
            variant="outline"
            onClick={() => {
              const id = startConversation();
              setActiveId(id);
            }}
          >
            <Plus className="size-4" /> {t("mentor_new_conversation", "New conversation")}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="card-surface flex h-[620px] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-sm font-semibold">
              {active ? t(`conv_${active.id}_title`, active.title) : t("mentor_new_conversation", "New conversation")}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" /> {t("mentor_context_loaded", "Context loaded")}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
            {(!active || active.messages.length === 0) && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageSquare className="size-8 text-muted-foreground" />
                <p className="mt-4 font-display text-xl">{t("mentor_nothing_yet", "Nothing on the table yet.")}</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  {t("mentor_ask_help", "Ask about today, your sprint, a trait that's slipping, or what to read next.")}
                </p>
              </div>
            )}
            {active?.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rise-in max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "mentor"
                    ? "border border-border bg-surface"
                    : "ml-auto bg-primary text-primary-foreground",
                )}
              >
                {t(`conv_${active.id}_cm${m.id}`, m.content)}
              </div>
            ))}
            {pending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> {t("mentor_thinking", "Mentor is thinking…")}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border px-5 py-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestedPrompts.slice(0, 3).map((p, idx) => {
                const translatedPrompt = t(`suggested_prompt_${idx}`, p);
                return (
                  <button
                    key={p}
                    onClick={() => void send(translatedPrompt)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    {translatedPrompt}
                  </button>
                );
              })}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("mentor_placeholder", "Ask your mentor…")}
                className="max-h-32 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <Button
                size="icon"
                className="size-10 shrink-0"
                disabled={!draft.trim() || pending}
                onClick={() => void send(draft)}
                aria-label="Send message"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("mentor_challenges", "Challenges")}</p>
            <div className="mt-4 space-y-3">
              {challenges.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                      <Zap className="size-3" /> {t(`difficulty_${c.difficulty.toLowerCase()}`, c.difficulty)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug">{t(`challenge_${c.id}_title`, c.title)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(`challenge_${c.id}_detail`, c.detail)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => toast.success(t("mentor_challenge_accepted", "Challenge accepted. Added to this week."))}
                  >
                    {t("mentor_accept", "Accept")}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("mentor_history", "History")}</p>
            <div className="mt-3 space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                    c.id === active?.id ? "bg-secondary" : "hover:bg-secondary/60",
                  )}
                >
                  <span className="block truncate text-sm font-medium">{t(`conv_${c.id}_title`, c.title)}</span>
                  <span className="text-xs text-muted-foreground">{c.updatedAt}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
