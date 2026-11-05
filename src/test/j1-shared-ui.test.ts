import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChoiceChips } from "../components/ChoiceChips";
import { StatePill } from "../components/StatePill";
import { LockedLayer } from "../components/LockedLayer";
import {
  Dialog,
  DialogContent,
  DialogSheetContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

// Simple test runner helper
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

console.log("--- Running J1 Shared UI Component Tests ---");

// 1. ChoiceChips Tests
test("ChoiceChips: renders chips with correct aria-pressed states in single-select", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChoiceChips, {
      options: ["Option A", "Option B", "Option C"],
      selected: "Option A",
      variant: "single",
    })
  );

  assert.ok(html.includes('aria-pressed="true"'), "Should contain aria-pressed='true' for Option A");
  assert.ok(html.includes('aria-pressed="false"'), "Should contain aria-pressed='false' for Option B and C");
  assert.ok(html.includes("Option A"), "Should render Option A");
  assert.ok(html.includes("Option B"), "Should render Option B");
});

test("ChoiceChips: renders multi-select chips with correct aria-pressed states and summary", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChoiceChips, {
      options: ["Focus", "Strategy", "Execution"],
      selected: ["Focus", "Strategy"],
      variant: "multi",
      selectedLabel: "Selected traits:",
    })
  );

  // Both Focus and Strategy should be pressed
  const trueCount = (html.match(/aria-pressed="true"/g) || []).length;
  assert.strictEqual(trueCount, 2, "Expected 2 chips with aria-pressed='true'");
  assert.ok(html.includes("Selected traits:"), "Should render selected summary label");
  assert.ok(html.includes('aria-label="Remove Focus"'), "Should have accessible remove button for Focus");
});

test("ChoiceChips: renders custom option input with accessible labels", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChoiceChips, {
      options: ["Item 1"],
      selected: [],
      allowCustom: true,
      placeholder: "Enter custom identity",
      addLabel: "Add trait",
    })
  );

  assert.ok(html.includes('placeholder="Enter custom identity"'), "Should render custom input placeholder");
  assert.ok(html.includes('aria-label="Enter custom identity"'), "Should render input accessible aria-label");
  assert.ok(html.includes("Add trait"), "Should render add button text");
});

// 2. StatePill Tests
test("StatePill: renders each required state with role='status' and aria-label", () => {
  const states = ["locked", "needs_input", "calibrating", "active", "needs_review"] as const;

  for (const st of states) {
    const html = renderToStaticMarkup(
      React.createElement(StatePill, { state: st })
    );

    assert.ok(html.includes('role="status"'), `State ${st} must have role='status'`);
    assert.ok(html.includes('aria-label="Status: '), `State ${st} must have aria-label`);
  }
});

test("StatePill: handles case variations and spaces cleanly", () => {
  const html1 = renderToStaticMarkup(React.createElement(StatePill, { state: "Needs input" }));
  const html2 = renderToStaticPill = renderToStaticMarkup(React.createElement(StatePill, { state: "Needs review" }));
  const html3 = renderToStaticMarkup(React.createElement(StatePill, { state: "Locked" }));

  assert.ok(html1.includes("Needs input"), "Should format Needs input");
  assert.ok(html2.includes("Needs review"), "Should format Needs review");
  assert.ok(html3.includes("Locked"), "Should format Locked");
});

// 3. LockedLayer Tests
test("LockedLayer: renders clearly with reasons 'Opens on day 3', 'After your plan', 'Full plan only'", () => {
  const reasons = ["Opens on day 3", "After your plan", "Full plan only"] as const;

  for (const reason of reasons) {
    const html = renderToStaticMarkup(
      React.createElement(LockedLayer, {
        layerName: "Character Stack",
        reason,
      })
    );

    assert.ok(html.includes('role="region"'), "LockedLayer must have role='region'");
    assert.ok(html.includes(reason), `LockedLayer must render reason '${reason}'`);
    assert.ok(html.includes("Character Stack is locked"), "LockedLayer must render layer title");
  }
});

// 4. Dialog Sheet Variant Tests
test("Dialog: DialogSheetContent renders responsive sheet classes for mobile and desktop", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Dialog,
      { open: true },
      React.createElement(
        DialogSheetContent,
        null,
        React.createElement(DialogTitle, null, "Sheet Title"),
        React.createElement(DialogDescription, null, "Sheet description")
      )
    )
  );

  // Phone bottom sheet classes
  assert.ok(html.includes("inset-x-0 bottom-0"), "Must include bottom sheet mobile positioning");
  // Desktop panel classes (sm: breakpoint)
  assert.ok(html.includes("sm:inset-y-0 sm:right-0"), "Must include sm: breakpoint right-side panel classes");
  assert.ok(html.includes("Sheet Title"), "Must render title");
  assert.ok(html.includes("Sheet description"), "Must render description");
});

console.log(`\nJ1 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

