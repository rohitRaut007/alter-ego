import type { Protocol, SafetyNotice } from "@alter-ego/api-client";
import { SECTION_LABELS, type SectionKey } from "@alter-ego/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { SafetyNoticeCard } from "@/components/SafetyNotice";
import { Button, Card, cn, Eyebrow, Spinner, Textarea } from "@/components/ui";
import { useAuth } from "@/lib/auth";

import { SectionView } from "./SectionViews";

/** Seven navigable tabs (PRD 7.1). Execution sections live under Daily OS. */
const TABS: Array<{ id: string; label: string; keys: SectionKey[] }> = [
  { id: "identity", label: "Identity", keys: ["identity"] },
  { id: "character", label: "Character", keys: ["character"] },
  { id: "knowledge", label: "Knowledge", keys: ["knowledge"] },
  { id: "mission", label: "Mission", keys: ["mission"] },
  { id: "daily_os", label: "Daily OS", keys: ["daily_os", "checklist_30", "sprint_90"] },
  { id: "presence", label: "Presence", keys: ["presence"] },
  { id: "legacy", label: "Legacy", keys: ["legacy"] },
];

const RATING_LABELS = ["Not accurate", "Slightly", "Somewhat", "Accurate", "Very accurate"];

function ReviseBox({ protocolId, sectionKey }: { protocolId: string; sectionKey: SectionKey }) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [safety, setSafety] = useState<SafetyNotice | null>(null);

  const revise = useMutation({
    mutationFn: async () => {
      const { data, response } = await api.POST("/api/v1/protocols/{id}/sections/{key}/revise", {
        params: { path: { id: protocolId, key: sectionKey } },
        body: { instruction: text.trim() },
      });
      if (!data) {
        throw new Error(
          response.status === 422
            ? "That change could not be applied. Try rephrasing it."
            : "We could not revise this section. Please try again.",
        );
      }
      return data;
    },
    onSuccess: async (result) => {
      if (result.safety) {
        setSafety(result.safety);
        return;
      }
      setOpen(false);
      setText("");
      await qc.invalidateQueries({ queryKey: ["protocol", protocolId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (safety) {
    return (
      <div className="mt-3">
        <SafetyNoticeCard
          notice={safety}
          onContinue={() => {
            setSafety(null);
            setText("");
          }}
        />
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" /> Revise this section
      </Button>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface p-4">
      <label htmlFor={`rev-${sectionKey}`} className="text-sm font-medium">
        What should change?
      </label>
      <Textarea
        id={`rev-${sectionKey}`}
        rows={3}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="For example: I can only commit one hour a day, not two."
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          className="h-10 px-4"
          loading={revise.isPending}
          disabled={!text.trim()}
          onClick={() => {
            setError(undefined);
            revise.mutate();
          }}
        >
          Apply change
        </Button>
        <Button variant="ghost" className="h-10 px-4" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AccuracyRating({ protocol }: { protocol: Protocol }) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const rate = useMutation({
    mutationFn: async (score: number) => {
      const { response } = await api.POST("/api/v1/protocols/{id}/rating", {
        params: { path: { id: protocol.id } },
        body: { score },
      });
      if (!response.ok) throw new Error("Could not save your rating.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocol", protocol.id] }),
  });

  if (protocol.accuracy_rating !== null) {
    return (
      <Card className="flex items-center gap-2 text-sm">
        <Check className="size-4 text-success" /> Thank you. You rated this protocol{" "}
        {protocol.accuracy_rating} of 5 for accuracy.
      </Card>
    );
  }
  return (
    <Card>
      <p className="text-sm font-semibold">How accurate is this to your situation?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Your answer helps us improve. You can still revise any section.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {RATING_LABELS.map((label, i) => (
          <Button
            key={label}
            variant="outline"
            className="h-10 px-4"
            disabled={rate.isPending}
            onClick={() => rate.mutate(i + 1)}
          >
            {label}
          </Button>
        ))}
      </div>
      {rate.isError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {rate.error.message}
        </p>
      ) : null}
    </Card>
  );
}

export function ProtocolPage() {
  const { id } = useParams();
  const { api } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState("identity");
  const [pdfError, setPdfError] = useState<string>();

  const latest = useQuery({
    queryKey: ["protocol", "latest"],
    enabled: !id,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/protocols/latest");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load your protocol.");
      return data;
    },
  });
  const protocolId = id ?? latest.data?.id;

  const detail = useQuery({
    queryKey: ["protocol", protocolId],
    enabled: Boolean(protocolId),
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/protocols/{id}", {
        params: { path: { id: protocolId as string } },
      });
      if (!data) throw new Error("Could not load your protocol.");
      return data;
    },
    refetchInterval: (q) => (q.state.data?.status === "generating" ? 2000 : false),
  });

  const status = detail.data?.status;

  // Live reveal: the event stream nudges a refetch the moment a section lands. Polling is the fallback.
  useEffect(() => {
    if (!protocolId || status !== "generating") return;
    const ctrl = new AbortController();
    void (async () => {
      try {
        for await (const ev of api.streamEvents(`/api/v1/protocols/${protocolId}/events`, {
          signal: ctrl.signal,
        })) {
          if (["section.ready", "progress", "done", "error"].includes(ev.event)) {
            void qc.invalidateQueries({ queryKey: ["protocol", protocolId] });
          }
        }
      } catch {
        /* aborted or dropped: polling continues */
      }
    })();
    return () => ctrl.abort();
  }, [api, protocolId, qc, status]);

  async function downloadPdf() {
    if (!protocolId) return;
    setPdfError(undefined);
    try {
      const blob = await api.fetchBlob(`/api/v1/protocols/${protocolId}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "alter-ego-protocol.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError("The PDF could not be created. Please try again.");
    }
  }

  if (!id && latest.data === null) return <Navigate to="/onboarding" replace />;
  if (latest.isPending && !id) return <AppShell><Spinner label="Loading your protocol" /></AppShell>;
  if (detail.isPending || !detail.data) {
    return (
      <AppShell>
        {detail.isError ? (
          <Card>
            <p role="alert" className="text-sm text-destructive">
              We could not load your protocol.
            </p>
            <Button className="mt-4 w-auto" onClick={() => void detail.refetch()}>
              Retry
            </Button>
          </Card>
        ) : (
          <Spinner label="Loading your protocol" />
        )}
      </AppShell>
    );
  }

  const protocol = detail.data;
  const sections = new Map(protocol.sections.map((s) => [s.key, s]));
  const total = protocol.expected_sections.length;
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]!;
  const doc = protocol.document as { disclaimer?: string } | null;

  return (
    <AppShell>
      <Eyebrow>Your protocol</Eyebrow>
      <h1 className="mt-2 font-display text-3xl">
        {status === "generating"
          ? "Building your protocol"
          : status === "failed"
            ? "We could not finish your protocol"
            : "Seven layers, one coherent system."}
      </h1>

      {status === "generating" ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-accent" />
          {sections.size} of {total} sections written. Each appears as soon as it is ready.
        </p>
      ) : null}

      {status === "failed" ? (
        <Card className="mt-6">
          <p role="alert" className="text-sm">
            Something went wrong while generating your protocol. Your interview answers are safe.
            Please contact support so we can regenerate it.
          </p>
        </Card>
      ) : null}

      {status !== "failed" ? (
        <>
          <div
            role="tablist"
            aria-label="Protocol layers"
            className="mt-8 flex gap-1 overflow-x-auto border-b border-border"
          >
            {TABS.map((t) => {
              const ready = t.keys.every((k) => sections.has(k));
              return (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active === t.id}
                  aria-controls="protocol-panel"
                  onClick={() => setActive(t.id)}
                  className={cn(
                    "relative shrink-0 px-4 py-3 text-sm font-medium transition",
                    active === t.id
                      ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accent"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  {!ready && status === "generating" ? (
                    <span className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-accent" aria-label="writing" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id="protocol-panel"
            aria-labelledby={`tab-${tab.id}`}
            className="mt-6 space-y-8"
          >
            {tab.keys.map((key) => {
              const section = sections.get(key);
              return (
                <Card key={key}>
                  {tab.keys.length > 1 ? (
                    <h2 className="mb-4 text-lg font-semibold">{SECTION_LABELS[key]}</h2>
                  ) : null}
                  {section ? (
                    <>
                      <SectionView sectionKey={key} content={section.content} />
                      {status === "ready" ? (
                        <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                          <ReviseBox protocolId={protocol.id} sectionKey={key} />
                          {section.revision > 1 ? (
                            <span className="text-xs text-muted-foreground">
                              Revised {section.revision - 1}×
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Writing this section…
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      {status === "ready" ? (
        <div className="mt-8 space-y-6">
          <AccuracyRating protocol={protocol} />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="w-auto" onClick={() => void downloadPdf()}>
              <Download className="size-4" /> Download PDF
            </Button>
            {pdfError ? (
              <p role="alert" className="text-sm text-destructive">
                {pdfError}
              </p>
            ) : null}
          </div>
          {doc?.disclaimer ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{doc.disclaimer}</p>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
