import { describe, expect, it } from "vitest";

import example from "../fixtures/protocol.v2.example.json";
import minimal from "../fixtures/protocol.v2.minimal.json";
import schema from "../protocol.v2.schema.json";
import { protocolDocument, sectionSchemas, SECTION_KEYS } from "./protocol";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("protocol zod mirror", () => {
  it("accepts the example documents exported by the API", () => {
    for (const doc of [example, minimal]) {
      const res = protocolDocument.safeParse(doc);
      expect(res.error?.issues ?? []).toEqual([]);
      expect(res.success).toBe(true);
    }
  });

  it("validates every section against its own schema", () => {
    const doc = example as Record<string, unknown>;
    for (const key of SECTION_KEYS) {
      const value = key === "checklist_30" ? { tasks: doc.checklist_30 } : doc[key];
      expect(sectionSchemas[key].safeParse(value).success, key).toBe(true);
    }
  });

  it("covers every top-level property of the JSON Schema exported by the API", () => {
    const apiKeys = Object.keys(schema.properties).sort();
    expect(Object.keys(protocolDocument.shape).sort()).toEqual(apiKeys);
    // Sections arrive as cards unlock, so only the envelope is required.
    expect(schema.required.slice().sort()).toEqual(["disclaimer", "generated_at", "schema_version"]);
  });

  it("accepts a document with no sections yet", () => {
    const { schema_version, generated_at, disclaimer } = minimal;
    expect(protocolDocument.safeParse({ schema_version, generated_at, disclaimer }).success).toBe(
      true,
    );
  });

  it("rejects unknown fields, bad clocks and duplicate ids", () => {
    const extra = clone(example) as Record<string, any>;
    extra.identity.surprise = "x";
    expect(protocolDocument.safeParse(extra).success).toBe(false);

    const badClock = clone(example) as Record<string, any>;
    badClock.daily_os.schedule[0].start = "6am";
    expect(protocolDocument.safeParse(badClock).success).toBe(false);

    const dupes = clone(example) as Record<string, any>;
    dupes.checklist_30[1].id = dupes.checklist_30[0].id;
    expect(protocolDocument.safeParse(dupes).success).toBe(false);
  });

  it("requires a Day 1 task when a legacy checklist is present", () => {
    const doc = clone(example) as Record<string, any>;
    for (const t of doc.checklist_30) t.due_day = Math.max(2, t.due_day);
    expect(protocolDocument.safeParse(doc).success).toBe(false);
  });

  it("checks plan milestones, fallbacks and if-then plans", () => {
    const unknownMilestone = clone(minimal) as Record<string, any>;
    unknownMilestone.sprint_90.weeks[0].tasks[0].milestone_id = "nope";
    expect(protocolDocument.safeParse(unknownMilestone).success).toBe(false);

    const longFallback = clone(minimal) as Record<string, any>;
    longFallback.sprint_90.weeks[0].tasks[0].fallback_minutes = 20;
    expect(protocolDocument.safeParse(longFallback).success).toBe(false);

    const halfPlan = clone(minimal) as Record<string, any>;
    delete halfPlan.sprint_90.weeks[0].tasks[1].if_then.then_action;
    expect(protocolDocument.safeParse(halfPlan).success).toBe(false);

    const parsed = protocolDocument.parse(minimal);
    const later = parsed.sprint_90?.weeks.find((w) => w.index === 5);
    expect(later?.tasks).toEqual([]);
    expect(later?.outcome).toBeTruthy();
  });

  it("rejects a 1.0.0 document until the API upgrades it", () => {
    const old = clone(example) as Record<string, any>;
    old.schema_version = "1.0.0";
    expect(protocolDocument.safeParse(old).success).toBe(false);
  });
});
