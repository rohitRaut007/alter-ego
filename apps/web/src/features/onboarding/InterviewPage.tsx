import type { InterviewStep, Question, SafetyNotice } from "@alter-ego/api-client";
import { ArrowRight, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button, cn, Progress, Textarea } from "@/components/primitives";
import { useAuth } from "@/lib/auth";

interface Bubble {
  id: string;
  role: "mentor" | "user";
  content: string;
}

const INTRO =
  "I will ask you a series of questions about where you are and where you are going. " +
  "Answer the way you would at 2am, not the way you would on a podcast. " +
  "Your protocol is only as honest as this conversation.";

function MultiSelectChips({
  suggestions,
  selected,
  onToggle,
  placeholder,
}: {
  suggestions: string[];
  selected: string[];
  onToggle: (s: string) => void;
  placeholder: string;
}) {
  const [custom, setCustom] = useState("");
  const add = () => {
    const value = custom.trim();
    if (value && !selected.includes(value)) onToggle(value);
    setCustom("");
  };
  const all = [...suggestions, ...selected.filter((s) => !suggestions.includes(s))];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {all.map((s) => {
          const on = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(s)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {on ? <Check className="size-3" /> : null}
              {s}
              {on && !suggestions.includes(s) ? <X className="size-3" /> : null}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label="Add your own"
          className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <Button type="button" variant="outline" className="h-10 px-4" onClick={add} disabled={!custom.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function InterviewPage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [interviewId, setInterviewId] = useState<string>();
  const [question, setQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string>();
  const [safety, setSafety] = useState<SafetyNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const push = useCallback((b: Omit<Bubble, "id">) => {
    setBubbles((prev) => [...prev, { ...b, id: `${prev.length}-${b.role}` }]);
  }, []);

  const finish = useCallback(
    async (id: string) => {
      setCompiling(true);
      const result = await api
        .POST("/api/v1/interviews/{id}/complete", { params: { path: { id } } })
        .catch(() => null);
      const data = result?.data;
      if (!data) {
        setCompiling(false);
        setError("We could not start building your protocol. Please try again.");
        return;
      }
      navigate(`/protocol/${data.protocol_id}`, { replace: true });
    },
    [api, navigate],
  );

  const apply = useCallback(
    (step: InterviewStep, resumed: boolean) => {
      setInterviewId(step.interview_id);
      setProgress(step.progress);
      if (step.done) {
        void finish(step.interview_id);
        return;
      }
      setQuestion(step.question);
      if (step.question) {
        push({ role: "mentor", content: step.question.question });
      }
      if (resumed) {
        push({ role: "mentor", content: "Welcome back. Let us continue where you left off." });
      }
    },
    [finish, push],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    push({ role: "mentor", content: INTRO });
    void (async () => {
      const result = await api.POST("/api/v1/interviews").catch(() => null);
      setLoading(false);
      const data = result?.data;
      const response = result?.response;
      if (!data) {
        setError(
          response?.status === 403
            ? "Your plan does not include the protocol yet."
            : "We could not start the interview. Please refresh and try again.",
        );
        return;
      }
      apply(data, data.answered_count > 0);
    })();
  }, [api, apply, push]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, busy, compiling]);

  async function submit(value: string | string[]) {
    const text = Array.isArray(value) ? value.join("; ") : value.trim();
    if (!text || busy || !interviewId) return;
    setBusy(true);
    setError(undefined);
    setDraft("");
    setSelected([]);
    push({ role: "user", content: Array.isArray(value) ? value.join(" · ") : text });
    const result = await api
      .POST("/api/v1/interviews/{id}/turns", {
        params: { path: { id: interviewId } },
        body: { answer: text },
      })
      .catch(() => null);
    setBusy(false);
    const data = result?.data;
    if (!data) {
      setError(
        result?.response.status === 400
          ? "That answer is too long or empty. Please shorten it."
          : "Something went wrong saving that answer. Please try again.",
      );
      return;
    }
    if (data.safety) {
      // Nothing was stored or sent on. The same question stays open.
      setBubbles((prev) => prev.slice(0, -1));
      setSafety(data.safety);
      return;
    }
    if (data.acknowledgement) push({ role: "mentor", content: data.acknowledgement });
    apply(data, false);
  }

  const toggle = (s: string) =>
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-4 sm:px-8">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">
                {compiling ? "Compiling" : (question?.stage ?? "The interview")}
              </span>
              <span className="text-muted-foreground">{Math.round(progress * 100)}%</span>
            </div>
            <div className="mt-2">
              <Progress value={progress} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="space-y-5" aria-live="polite">
          {bubbles.map((b) => (
            <div
              key={b.id}
              className={cn(
                "rise-in max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[78%]",
                b.role === "mentor"
                  ? "border border-border bg-card shadow-soft"
                  : "ml-auto bg-primary text-primary-foreground",
              )}
            >
              {b.content}
            </div>
          ))}
          {loading || busy ? (
            <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {loading ? "Preparing the interview…" : "Thinking…"}
            </div>
          ) : null}
          {compiling ? (
            <div role="status" className="rise-in rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Loader2 className="size-4 animate-spin text-accent" />
                Compiling your protocol
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Each section is written from your own answers. You will see them appear one at a
                time.
              </p>
            </div>
          ) : null}
          {safety ? (
            <SafetyNoticeCard notice={safety} onContinue={() => setSafety(null)} />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div ref={endRef} />
        </div>
      </div>

      {question && !compiling && !safety ? (
        <div className="sticky bottom-0 border-t border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-5 py-4 sm:px-8">
            {question.multi_select ? (
              <>
                <MultiSelectChips
                  suggestions={question.suggestions}
                  selected={selected}
                  onToggle={toggle}
                  placeholder={question.placeholder || "Add your own"}
                />
                <Button
                  className="mt-3 w-full"
                  disabled={selected.length === 0 || busy}
                  onClick={() => void submit(selected)}
                >
                  Confirm selection ({selected.length})
                  <ArrowRight className="size-4" />
                </Button>
              </>
            ) : (
              <>
                {question.suggestions.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {question.suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDraft(s)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-border-strong hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={question.placeholder}
                    aria-label="Your answer"
                    rows={2}
                    maxLength={4000}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submit(draft);
                      }
                    }}
                  />
                  <Button
                    className="size-11 shrink-0 px-0"
                    disabled={!draft.trim() || busy}
                    onClick={() => void submit(draft)}
                    aria-label="Send answer"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
