import { sectionSchemas, type SectionData, type SectionKey } from "@alter-ego/validation";
import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui";

type Data<K extends SectionKey> = SectionData<K>;

function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 text-sm font-semibold first:mt-0">{children}</h3>;
}

function P({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <p className={`mt-1.5 text-sm leading-relaxed ${muted ? "text-muted-foreground" : ""}`}>
      {children}
    </p>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" aria-hidden />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

function Identity({ d }: { d: Data<"identity"> }) {
  return (
    <div>
      <p className="font-display text-2xl leading-snug sm:text-3xl">“{d.identity_statement}”</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {d.alter_ego_name} · {d.archetype}
      </p>
      <H>Thesis</H>
      <P>{d.thesis}</P>
      <H>Legacy definition</H>
      <P>{d.legacy_definition}</P>
      <H>Why this fits you</H>
      <List items={d.why_this_fits} />
    </div>
  );
}

function Character({ d }: { d: Data<"character"> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {d.traits.map((t) => (
        <div key={t.id} className="rounded-xl border border-border bg-surface p-4">
          <p className="font-semibold">{t.name}</p>
          <P>{t.statement}</P>
          <P muted>{t.rationale}</P>
          <H>Practice</H>
          <List items={t.practices.map((p) => `${p.description} (${p.cadence}, ${p.minutes} min)`)} />
          <H>Failure mode</H>
          <P muted>{t.failure_mode}</P>
        </div>
      ))}
    </div>
  );
}

function Knowledge({ d }: { d: Data<"knowledge"> }) {
  return (
    <div>
      <P>{d.sequencing_rationale}</P>
      <ol className="mt-4 divide-y divide-border rounded-xl border border-border">
        {d.reading_list.map((r) => (
          <li key={r.id} className="flex gap-4 p-4">
            <span className="font-display text-xl text-muted-foreground">{r.sequence}</span>
            <div>
              <p className="text-sm font-semibold">
                {r.title} <span className="font-normal text-muted-foreground">· {r.author}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{r.why_now}</p>
              <p className="mt-1 text-xs text-muted-foreground">About {r.estimated_hours} hours</p>
            </div>
          </li>
        ))}
      </ol>
      <H>Destruction test</H>
      <P>{d.destruction_test_template}</P>
    </div>
  );
}

function Mission({ d }: { d: Data<"mission"> }) {
  return (
    <div>
      <p className="text-lg leading-snug">{d.statement}</p>
      <H>Strategy</H>
      <P>{d.strategy}</P>
      <H>Roadmap</H>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        {d.roadmap.map((p) => (
          <div key={p.name} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.horizon_weeks} weeks</p>
            <List items={p.outcomes} />
          </div>
        ))}
      </div>
      <H>Risks to design around</H>
      <List items={d.risks} />
      <H>Execution system</H>
      <P>{d.execution_system}</P>
    </div>
  );
}

function DailyOs({ d }: { d: Data<"daily_os"> }) {
  return (
    <div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {d.schedule.map((b) => (
          <li key={`${b.start}-${b.label}`} className="flex items-center gap-4 p-3 text-sm">
            <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
              {b.start}–{b.end}
            </span>
            <span className="flex-1 font-medium">{b.label}</span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">{b.kind.replace("_", " ")}</span>
          </li>
        ))}
      </ul>
      <P muted>Deep work target: {d.deep_work_minutes_per_day} minutes a day.</P>
      <H>Shutdown ritual</H>
      <P>{d.shutdown_ritual}</P>
      <H>Evening reflection</H>
      <List items={d.reflection_questions} />
    </div>
  );
}

function Presence({ d }: { d: Data<"presence"> }) {
  return (
    <div>
      <H>Principles</H>
      <List items={d.principles} />
      <H>Micro-practices</H>
      <List items={d.micro_practices.map((m) => `${m.description} (${m.minutes} min)`)} />
      <H>Wardrobe</H>
      <P>{d.wardrobe_notes}</P>
      <H>Social playbook</H>
      <List items={d.social_playbook} />
    </div>
  );
}

const HORIZON = { "2y": "Two years", "5y": "Five years", life: "A life" } as const;

function Legacy({ d }: { d: Data<"legacy"> }) {
  return (
    <div className="space-y-4">
      {d.milestones.map((m) => (
        <div key={m.horizon} className="rounded-xl border border-border bg-surface p-4">
          <Eyebrow>{HORIZON[m.horizon]}</Eyebrow>
          <p className="mt-2 text-sm font-medium">{m.statement}</p>
          <H>Evidence of progress</H>
          <List items={m.evidence_of_progress} />
          <H>Leading indicators</H>
          <List items={m.leading_indicators} />
        </div>
      ))}
    </div>
  );
}

function Checklist({ d }: { d: Data<"checklist_30"> }) {
  const tasks = [...d.tasks].sort((a, b) => a.due_day - b.due_day);
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {tasks.map((t) => (
        <li key={t.id} className="flex gap-4 p-3">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
            Day {t.due_day}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {t.title}
              {t.priority ? (
                <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px]">priority</span>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">{t.detail}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{t.minutes} min</span>
        </li>
      ))}
    </ul>
  );
}

function Sprint({ d }: { d: Data<"sprint_90"> }) {
  return (
    <div>
      <p className="text-sm leading-relaxed">{d.goal}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {d.weeks.map((w) => (
          <div key={w.index} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">
              Week {w.index} <span className="font-normal text-muted-foreground">· {w.theme}</span>
            </p>
            <List items={w.tasks.map((t) => t.title)} />
            <p className="mt-2 text-xs text-muted-foreground">Review: {w.review_prompt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Validate section content before rendering, so a malformed section never crashes the page. */
export function SectionView({ sectionKey, content }: { sectionKey: SectionKey; content: unknown }) {
  const parsed = sectionSchemas[sectionKey].safeParse(content);
  if (!parsed.success) {
    return (
      <p role="alert" className="text-sm text-destructive">
        This section could not be displayed. It has been flagged for review.
      </p>
    );
  }
  const d = parsed.data as never;
  switch (sectionKey) {
    case "identity":
      return <Identity d={d} />;
    case "character":
      return <Character d={d} />;
    case "knowledge":
      return <Knowledge d={d} />;
    case "mission":
      return <Mission d={d} />;
    case "daily_os":
      return <DailyOs d={d} />;
    case "presence":
      return <Presence d={d} />;
    case "legacy":
      return <Legacy d={d} />;
    case "checklist_30":
      return <Checklist d={d} />;
    case "sprint_90":
      return <Sprint d={d} />;
  }
}
