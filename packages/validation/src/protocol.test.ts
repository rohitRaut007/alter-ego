import { describe, expect, it } from "vitest";

import example from "../fixtures/protocol.v1.example.json";
import schema from "../protocol.v1.schema.json";
import { protocolDocument, sectionSchemas, SECTION_KEYS } from "./protocol";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("protocol zod mirror", () => {
  it("accepts the example document exported by the API", () => {
    const res = protocolDocument.safeParse(example);
    expect(res.error?.issues ?? []).toEqual([]);
    expect(res.success).toBe(true);
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
    expect(schema.required.slice().sort()).toEqual(apiKeys);
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

  it("requires a Day 1 task", () => {
    const doc = clone(example) as Record<string, any>;
    for (const t of doc.checklist_30) t.due_day = Math.max(2, t.due_day);
    expect(protocolDocument.safeParse(doc).success).toBe(false);
  });
});
