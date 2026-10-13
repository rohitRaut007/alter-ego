import type { Challenge, MemoryFact, MentorMessage, Nudge, SafetyNotice, Thread } from "@alter-ego/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Loader2, MessageSquare, Plus, Send, Sparkles, Trash2, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LocalMessage {
  id: string;
  role: "user" | "mentor";
  body: string;
  pending?: boolean;
}

export function MentorPage() {
  const { api } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState<LocalMessage[]>([]);
  const [safety, setSafety] = useState<SafetyNotice | null>(null);
  const [error, setError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const threads = useQuery({
    queryKey: ["mentor", "threads"],
    queryFn: async (): Promise<Thread[]> => (await api.GET("/api/v1/mentor/threads")).data ?? [],
  });
  const prompts = useQuery({
    queryKey: ["mentor", "prompts"],
    queryFn: async () => (await api.GET("/api/v1/mentor/prompts")).data ?? null,
  });
  const nudges = useQuery({
    queryKey: ["mentor", "nudges"],
    queryFn: async (): Promise<Nudge[]> => (await api.GET("/api/v1/mentor/nudges")).data ?? [],
  });
  const challenges = useQuery({
    queryKey: ["mentor", "challenges"],
    queryFn: async (): Promise<Challenge[]> =>
      (await api.GET("/api/v1/mentor/challenges")).data ?? [],
  });
  const memory = useQuery({
    queryKey: ["mentor", "memory"],
    queryFn: async (): Promise<MemoryFact[]> => (await api.GET("/api/v1/mentor/memory")).data ?? [],
  });

  // Default to the most recent thread once the list loads.
  useEffect(() => {
    if (activeId === null && threads.data && threads.data.length > 0) {
      setActiveId(threads.data[0]!.id);
    }
  }, [activeId, threads.data]);

  const detail = useQuery({
    queryKey: ["mentor", "thread", activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/mentor/threads/{id}", {
        params: { path: { id: activeId as string } },
      });
      if (!data) throw new Error("Could not load the conversation.");
      return data;
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [detail.data?.messages.length, live, sending]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const newThread = useMutation({
    mutationFn: async () => {
      const { data } = await api.POST("/api/v1/mentor/threads", { body: { kind: "chat" } });
      if (!data) throw new Error("Could not start a conversation.");
      return data;
    },
    onSuccess: async (thread) => {
      setActiveId(thread.id);
      setLive([]);
      setSafety(null);
      await qc.invalidateQueries({ queryKey: ["mentor", "threads"] });
    },
  });

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { response } = await api.POST("/api/v1/mentor/challenges/{id}/accept", {
        params: { path: { id } },
      });
      if (!response.ok) throw new Error("Could not accept the challenge.");
    },
    onSuccess: async () => {
      toast.success(t("mentor_challenge_accepted", "Challenge accepted. Added to this week."));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mentor", "challenges"] }),
        qc.invalidateQueries({ queryKey: ["brief"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: () => toast.error(t("mentor_challenge_error", "Could not accept that challenge.")),
  });

  const forget = useMutation({
    mutationFn: async (id: string) => {
      await api.DELETE("/api/v1/mentor/memory/{id}", { params: { path: { id } } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentor", "memory"] }),
  });

  const resume = useMutation({
    mutationFn: async () => {
      await api.POST("/api/v1/mentor/threads/{id}/resume", {
        params: { path: { id: activeId as string } },
      });
    },
    onSuccess: async () => {
      setSafety(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mentor", "thread", activeId] }),
        qc.invalidateQueries({ queryKey: ["mentor", "threads"] }),
      ]);
    },
  });

  async function ensureThread(): Promise<string> {
    if (activeId) return activeId;
    const { data } = await api.POST("/api/v1/mentor/threads", { body: { kind: "chat" } });
    if (!data) throw new Error("Could not start a conversation.");
    setActiveId(data.id);
    return data.id;
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setDraft("");
    setError(undefined);
    setSafety(null);
    setSending(true);
    const mentorId = `live-${Date.now()}`;
    setLive([
      { id: `u-${mentorId}`, role: "user", body: content },
      { id: mentorId, role: "mentor", body: "", pending: true },
    ]);
    try {
      const threadId = await ensureThread();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await api.postStream(
        `/api/v1/mentor/threads/${threadId}/messages`,
        { content, stream: true },
        { signal: ctrl.signal },
      );
      if (res.kind === "json") {
        const body = res.data as { safety?: SafetyNotice | null };
        if (body.safety) setSafety(body.safety);
        setLive([]);
      } else {
        let acc = "";
        for await (const ev of res.events) {
          if (ev.event === "token") {
            acc += (JSON.parse(ev.data) as { text: string }).text;
            setLive((prev) => prev.map((m) => (m.id === mentorId ? { ...m, body: acc } : m)));
          } else if (ev.event === "error") {
            throw new Error("mentor_unavailable");
          }
        }
        setLive([]);
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mentor", "thread", threadId] }),
        qc.invalidateQueries({ queryKey: ["mentor", "threads"] }),
        qc.invalidateQueries({ queryKey: ["mentor", "memory"] }),
      ]);
    } catch (err) {
      setLive([]);
      const status = (err as { status?: number }).status;
      setError(
        status === 409
          ? t("mentor_paused", "This conversation is paused. Resume it to continue.")
          : status === 429
            ? t("mentor_rate_limited", "You have reached the hourly message limit. Please try again later.")
            : t("mentor_error", "The mentor could not respond. Please try again."),
      );
    } finally {
      setSending(false);
    }
  }

  const stored: LocalMessage[] = (detail.data?.messages ?? []).map((m: MentorMessage) => ({
    id: m.id,
    role: m.role as "user" | "mentor",
    body: m.body,
  }));
  const messages = [...stored, ...live];
  const paused = detail.data?.thread.status === "paused_safety";
  const unread = (nudges.data ?? []).filter((n) => !n.read);
  const offered = (challenges.data ?? []).filter((c) => c.status === "offered");

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("always_on", "Always on")}
        title={t("mentor_title", "AI Mentor")}
        description={t(
          "mentor_subtitle",
          "It sees every layer, every streak and every missed block. Ask it something precise.",
        )}
        action={
          <Button variant="outline" onClick={() => newThread.mutate()} disabled={newThread.isPending}>
            <Plus className="size-4" /> {t("mentor_new_conversation", "New conversation")}
          </Button>
        }
      />

      {unread.length > 0 ? (
        <div className="mb-5 space-y-2" aria-label="Mentor messages">
          {unread.map((n) => (
            <div key={n.id} className="card-surface flex items-start gap-3 border-accent/30 p-4">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="flex-1 text-sm leading-relaxed">{n.body}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api.POST("/api/v1/mentor/nudges/{id}/read", { params: { path: { id: n.id } } });
                  void qc.invalidateQueries({ queryKey: ["mentor", "nudges"] });
                  void qc.invalidateQueries({ queryKey: ["dashboard"] });
                }}
              >
                {t("dismiss", "Dismiss")}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="card-surface flex h-[620px] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-3.5" />
            </span>
            <span className="truncate text-sm font-semibold">
              {detail.data?.thread.title || t("mentor_new_conversation", "New conversation")}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", paused ? "bg-destructive" : "bg-success")} />
              {paused ? t("mentor_status_paused", "Paused") : t("mentor_context_loaded", "Context loaded")}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6" aria-live="polite">
            {messages.length === 0 && !safety ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageSquare className="size-8 text-muted-foreground" />
                <p className="mt-4 font-display text-xl">
                  {t("mentor_nothing_yet", "Nothing on the table yet.")}
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  {t(
                    "mentor_ask_help",
                    "Ask about today, your sprint, a trait that is slipping, or what to read next.",
                  )}
                </p>
              </div>
            ) : null}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rise-in max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "mentor"
                    ? "border border-border bg-surface"
                    : "ml-auto bg-primary text-primary-foreground",
                )}
              >
                {m.body || (m.pending ? <Loader2 className="size-3.5 animate-spin" /> : null)}
              </div>
            ))}
            {safety ? <SafetyNoticeCard notice={safety} /> : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border px-5 py-4">
            {paused ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {t("mentor_paused_help", "Coaching is paused for this conversation.")}
                </p>
                <Button size="sm" onClick={() => resume.mutate()} disabled={resume.isPending}>
                  {t("mentor_resume", "Resume")}
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(prompts.data?.prompts ?? []).slice(0, 3).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void send(p)}
                      disabled={sending}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("mentor_placeholder", "Ask your mentor…")}
                    aria-label="Message"
                    maxLength={4000}
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
                    disabled={!draft.trim() || sending}
                    onClick={() => void send(draft)}
                    aria-label="Send message"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <p className="label-eyebrow">{t("mentor_challenges", "Challenges")}</p>
            <div className="mt-4 space-y-3">
              {offered.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("mentor_no_challenges", "No open challenges this week.")}
                </p>
              ) : null}
              {offered.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    <Zap className="size-3" /> {c.difficulty}
                  </span>
                  <p className="mt-2 text-sm font-medium leading-snug">{c.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate(c.id)}
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
              {(threads.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("mentor_no_history", "Your conversations will appear here.")}
                </p>
              ) : null}
              {(threads.data ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveId(c.id);
                    setLive([]);
                    setSafety(null);
                  }}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                    c.id === activeId ? "bg-secondary" : "hover:bg-secondary/60",
                  )}
                >
                  <span className="block truncate text-sm font-medium">
                    {c.title || t("mentor_new_conversation", "New conversation")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.updated_at).toLocaleDateString()} · {c.message_count}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-accent" />
              <p className="label-eyebrow">{t("mentor_memory", "What I remember")}</p>
            </div>
            <ul className="mt-3 space-y-2">
              {(memory.data ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  {t("mentor_no_memory", "Nothing yet. Commitments and goals you mention are kept here.")}
                </li>
              ) : null}
              {(memory.data ?? []).slice(0, 8).map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="flex-1">{f.text}</span>
                  <button
                    type="button"
                    aria-label="Forget this"
                    onClick={() => forget.mutate(f.id)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
