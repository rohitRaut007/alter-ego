import { z } from "zod";

/**
 * Mirror of apps/api/protocol/schema/v1.py (schema 1.0.0).
 * Drift is caught by protocol.test.ts, which validates the example document exported by the API.
 */

const text = z.string().trim().min(1).max(1200);
const shortText = z.string().trim().min(1).max(200);
const id = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const layerId = z.enum([
  "identity",
  "character",
  "knowledge",
  "mission",
  "daily_os",
  "presence",
  "legacy",
]);
export type LayerId = z.infer<typeof layerId>;

const practice = z.strictObject({
  id,
  description: text,
  cadence: z.enum(["daily", "weekly"]),
  minutes: z.number().int().min(1).max(180),
});

const trait = z.strictObject({
  id,
  name: shortText,
  statement: text,
  rationale: text,
  practices: z.array(practice).min(1).max(3),
  failure_mode: text,
  monthly_reflection_prompt: text,
});

export const identitySection = z.strictObject({
  archetype: shortText,
  thesis: text,
  alter_ego_name: shortText,
  identity_statement: text,
  legacy_definition: text,
  why_this_fits: z.array(text).min(1).max(6),
});

export const characterSection = z.strictObject({
  traits: z.array(trait).min(3).max(7),
});

const readingItem = z.strictObject({
  id,
  title: shortText,
  author: shortText,
  why_now: text,
  sequence: z.number().int().min(1),
  estimated_hours: z.number().int().min(1).max(100),
});

export const knowledgeSection = z.strictObject({
  reading_list: z.array(readingItem).min(5).max(15),
  sequencing_rationale: text,
  destruction_test_template: text,
  weekly_focus_domains: z.array(shortText).min(1).max(6),
});

const phase = z.strictObject({
  name: shortText,
  horizon_weeks: z.number().int().min(1).max(104),
  outcomes: z.array(text).min(1).max(6),
});

export const missionSection = z.strictObject({
  statement: text,
  strategy: text,
  roadmap: z.array(phase).min(2).max(5),
  risks: z.array(text).min(1).max(8),
  execution_system: text,
});

const block = z.strictObject({
  start: clock,
  end: clock,
  label: shortText,
  layer: layerId,
  kind: z.enum(["deep_work", "recovery", "practice", "admin", "learning"]),
});

export const dailyOsSection = z.strictObject({
  schedule: z.array(block).min(1).max(14),
  deep_work_minutes_per_day: z.number().int().min(0).max(480),
  shutdown_ritual: text,
  reflection_questions: z.array(text).length(3),
});

const microPractice = z.strictObject({
  id,
  description: text,
  minutes: z.number().int().min(1).max(60),
});

export const presenceSection = z.strictObject({
  principles: z.array(text).min(1).max(8),
  micro_practices: z.array(microPractice).min(1).max(10),
  wardrobe_notes: text,
  social_playbook: z.array(text).min(1).max(8),
});

const milestone = z.strictObject({
  horizon: z.enum(["2y", "5y", "life"]),
  statement: text,
  evidence_of_progress: z.array(text).min(1).max(6),
  leading_indicators: z.array(text).min(1).max(6),
});

export const legacySection = z
  .strictObject({ milestones: z.array(milestone).length(3) })
  .refine(
    (v) => new Set(v.milestones.map((m) => m.horizon)).size === 3,
    "Legacy needs exactly one milestone each for 2y, 5y and life",
  );

export const task = z.strictObject({
  id,
  title: shortText,
  detail: text,
  layer: layerId,
  due_day: z.number().int().min(1).max(90),
  minutes: z.number().int().min(1).max(480),
  priority: z.boolean().default(false),
  trait_id: id.optional(),
});
export type Task = z.infer<typeof task>;

const week = z.strictObject({
  index: z.number().int().min(1).max(13),
  theme: shortText,
  tasks: z.array(task).min(1).max(12),
  review_prompt: text,
});

export const sprintSection = z.strictObject({
  goal: text,
  weeks: z.array(week).min(12).max(13),
});

/** Wrapper the API stores for the checklist section; the full document holds the bare list. */
export const checklistSection = z.strictObject({
  tasks: z.array(task).min(5).max(60),
});

export const protocolDocument = z
  .strictObject({
    schema_version: z.literal("1.0.0"),
    generated_at: z.string().datetime({ offset: true }),
    identity: identitySection,
    character: characterSection,
    knowledge: knowledgeSection,
    mission: missionSection,
    daily_os: dailyOsSection,
    presence: presenceSection,
    legacy: legacySection,
    checklist_30: z.array(task).min(5).max(60),
    sprint_90: sprintSection,
    disclaimer: text,
  })
  .superRefine((doc, ctx) => {
    const ids = [
      ...doc.character.traits.map((t) => t.id),
      ...doc.character.traits.flatMap((t) => t.practices.map((p) => p.id)),
      ...doc.knowledge.reading_list.map((r) => r.id),
      ...doc.presence.micro_practices.map((m) => m.id),
      ...doc.checklist_30.map((t) => t.id),
      ...doc.sprint_90.weeks.flatMap((w) => w.tasks.map((t) => t.id)),
    ];
    const seen = new Set<string>();
    for (const x of ids) {
      if (seen.has(x)) ctx.addIssue({ code: "custom", message: `Duplicate id: ${x}` });
      seen.add(x);
    }
    if (!doc.checklist_30.some((t) => t.due_day === 1)) {
      ctx.addIssue({ code: "custom", message: "checklist_30 needs a Day 1 task" });
    }
    if (doc.checklist_30.some((t) => t.due_day > 30)) {
      ctx.addIssue({ code: "custom", message: "checklist_30 tasks must be due within 30 days" });
    }
  });
export type ProtocolDocument = z.infer<typeof protocolDocument>;

export const SECTION_KEYS = [
  "identity",
  "character",
  "knowledge",
  "mission",
  "daily_os",
  "presence",
  "legacy",
  "checklist_30",
  "sprint_90",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const sectionSchemas = {
  identity: identitySection,
  character: characterSection,
  knowledge: knowledgeSection,
  mission: missionSection,
  daily_os: dailyOsSection,
  presence: presenceSection,
  legacy: legacySection,
  checklist_30: checklistSection,
  sprint_90: sprintSection,
} as const;

export type SectionData<K extends SectionKey> = z.infer<(typeof sectionSchemas)[K]>;

/** Display metadata for the seven layers plus the two execution sections. */
export const SECTION_LABELS: Record<SectionKey, string> = {
  identity: "Identity",
  character: "Character",
  knowledge: "Knowledge",
  mission: "Mission",
  daily_os: "Daily OS",
  presence: "Presence",
  legacy: "Legacy",
  checklist_30: "30-day checklist",
  sprint_90: "90-day sprint",
};
