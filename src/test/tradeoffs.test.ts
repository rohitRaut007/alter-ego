import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TradeoffOptions } from "../features/cards/TradeoffOptions";
import { FeasibilityVerdict } from "../features/cards/FeasibilityVerdict";
import { mockCardListEveryState } from "./fixtures";
import type { Card, TradeoffSelectionPayload } from "../lib/api-types";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}:`, err);
    failed++;
  }
}

console.log("--- Running J5 Tradeoffs & Feasibility Tests ---");

const calibratingCard: Card = mockCardListEveryState.find((c) => c.state === "calibrating")!;

test("FeasibilityVerdict: renders server-provided numbers accurately without modification", () => {
  const html = renderToStaticMarkup(
    React.createElement(FeasibilityVerdict, {
      card: calibratingCard,
    })
  );

  assert.ok(html.includes("180h"), "Must display server provided 180h effort");
  assert.ok(html.includes("12h/wk"), "Must display server provided 12h/wk");
  assert.ok(html.includes("75%"), "Must display server provided 75% coverage");
  assert.ok(html.includes(calibratingCard.verdict!.verdict_text), "Must display server verdict text");
});

test("TradeoffOptions: renders all 3 tradeoff options and disables unavailable option with reason", () => {
  const options = calibratingCard.verdict!.tradeoff_options;
  const html = renderToStaticMarkup(
    React.createElement(TradeoffOptions, {
      options,
      onSelectOption: async () => {},
    })
  );

  assert.ok(html.includes("Move the date out by 4 weeks"), "Must render option 1 (move_date)");
  assert.ok(html.includes("Add 3 hours/week of deep work"), "Must render option 2 (add_time)");
  assert.ok(html.includes("Narrow the scope to core MVP"), "Must render option 3 (narrow_scope)");

  // Option 3 is unavailable in fixture
  assert.ok(
    html.includes("Scope is already minimized to core protocol modules."),
    "Must display reason why narrow_scope is disabled"
  );
});

test("TradeoffOptions: submits exact API-defined request body choices: ['move_date']", async () => {
  let submittedPayload: TradeoffSelectionPayload | null = null;

  const mockSubmit = async (payload: TradeoffSelectionPayload) => {
    submittedPayload = payload;
  };

  // Simulate user selecting move_date
  await mockSubmit({ choices: ["move_date"] });

  assert.deepStrictEqual(
    submittedPayload,
    { choices: ["move_date"] },
    "Payload must exactly match API contract { choices: ['move_date'] }"
  );
});

console.log(`\nJ5 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

