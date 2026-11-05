import assert from "node:assert";
import React, { act } from "react";
import { TradeoffOptions } from "../features/cards/TradeoffOptions";
import { FeasibilityVerdict } from "../features/cards/FeasibilityVerdict";
import { mockCardListEveryState } from "./fixtures";
import { renderWithProviders } from "./utils";
import type { Card, TradeoffSelectionPayload } from "../lib/api-types";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err);
    failed++;
  }
}

console.log("--- Running J5 Tradeoffs & Feasibility Tests ---");

const calibratingCard: Card = mockCardListEveryState.find((c) => c.state === "calibrating")!;

await test("FeasibilityVerdict: renders server-provided numbers accurately without browser calculation", async () => {
  const { container, unmount } = await renderWithProviders(
    React.createElement(FeasibilityVerdict, {
      card: calibratingCard,
    })
  );

  const text = container.innerHTML;
  assert.ok(text.includes("180h"), "Must display server provided 180h effort");
  assert.ok(text.includes("12h/wk"), "Must display server provided 12h/wk");
  assert.ok(text.includes("75%"), "Must display server provided 75% coverage");
  assert.ok(text.includes(calibratingCard.verdict!.verdict_text), "Must display server verdict text");

  unmount();
});

await test("TradeoffOptions: renders options and disables unavailable option with reason", async () => {
  const options = calibratingCard.verdict!.tradeoff_options;
  const { container, unmount } = await renderWithProviders(
    React.createElement(TradeoffOptions, {
      options,
      onSelectOption: async () => {},
    })
  );

  const text = container.innerHTML;
  assert.ok(text.includes("Move the date out by 4 weeks"), "Must render option 1 (move_date)");
  assert.ok(text.includes("Add 3 hours/week of deep work"), "Must render option 2 (add_time)");
  assert.ok(text.includes("Narrow the scope to core MVP"), "Must render option 3 (narrow_scope)");

  // Option 3 is unavailable in fixture
  assert.ok(
    text.includes("Scope is already minimized to core protocol modules."),
    "Must display reason why narrow_scope is disabled"
  );

  const buttons = container.querySelectorAll("button");
  const disabledButton = Array.from(buttons).find((b) => b.disabled);
  assert.ok(disabledButton, "Unavailable option must have disabled button");

  unmount();
});

await test("TradeoffOptions: clicking 'Select' submits exact API payload { choices: ['move_date'] }", async () => {
  let submittedPayload: TradeoffSelectionPayload | null = null;
  const options = calibratingCard.verdict!.tradeoff_options;

  const { container, unmount } = await renderWithProviders(
    React.createElement(TradeoffOptions, {
      options,
      onSelectOption: async (payload) => {
        submittedPayload = payload;
      },
    })
  );

  // Click the first "Select" button (move_date)
  const buttons = container.querySelectorAll("button");
  const firstSelectBtn = Array.from(buttons).find((b) => b.textContent?.includes("Select") && !b.disabled);
  assert.ok(firstSelectBtn, "Must find enabled Select button for option 1");

  await act(async () => {
    firstSelectBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.deepStrictEqual(
    submittedPayload,
    { choices: ["move_date"] },
    "Payload must exactly match API contract { choices: ['move_date'] }"
  );

  // Button should now show "Applied"
  assert.ok(container.innerHTML.includes("Applied"), "Option button should update to Applied");

  unmount();
});

await test("TradeoffOptions: failure does not mark option as applied and displays error alert", async () => {
  const options = calibratingCard.verdict!.tradeoff_options;

  const { container, unmount } = await renderWithProviders(
    React.createElement(TradeoffOptions, {
      options,
      onSelectOption: async () => {
        throw new Error("Network timeout: failed to apply tradeoff calibration");
      },
    })
  );

  const buttons = container.querySelectorAll("button");
  const firstSelectBtn = Array.from(buttons).find((b) => b.textContent?.includes("Select") && !b.disabled);
  assert.ok(firstSelectBtn);

  await act(async () => {
    firstSelectBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  // Verify alert role is rendered
  const alert = container.querySelector("[role='alert']");
  assert.ok(alert, "Must render alert role when tradeoff submission fails");
  assert.ok(container.innerHTML.includes("Network timeout"), "Must display error text");

  // Verify option is NOT marked as applied
  assert.ok(!container.innerHTML.includes("Applied"), "Must NOT mark option as applied on failure");

  unmount();
});

console.log(`\nJ5 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
