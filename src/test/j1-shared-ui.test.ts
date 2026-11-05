import assert from "node:assert";
import React, { act } from "react";
import { ChoiceChips } from "../components/ChoiceChips";
import { StatePill } from "../components/StatePill";
import { LockedLayer } from "../components/LockedLayer";
import {
  Dialog,
  DialogSheetContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { renderWithProviders, setInputValue } from "./utils";

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

console.log("--- Running J1 Shared UI Component Tests ---");

// 1. ChoiceChips Tests
await test("ChoiceChips: renders chips with correct aria-pressed states in single-select", async () => {
  let selected = "Option A";
  const { container, unmount } = await renderWithProviders(
    React.createElement(ChoiceChips, {
      options: ["Option A", "Option B", "Option C"],
      selected,
      variant: "single",
      onChange: (val) => {
        selected = val as string;
      },
    })
  );

  const buttons = container.querySelectorAll("button[role='button']");
  assert.strictEqual(buttons.length, 3, "Expected 3 chip buttons");
  assert.strictEqual(buttons[0]?.getAttribute("aria-pressed"), "true", "Option A should be pressed");
  assert.strictEqual(buttons[1]?.getAttribute("aria-pressed"), "false", "Option B should not be pressed");
  assert.strictEqual(buttons[2]?.getAttribute("aria-pressed"), "false", "Option C should not be pressed");

  // Click Option B
  act(() => {
    buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.strictEqual(selected, "Option B", "Clicking Option B should trigger onChange with Option B");

  unmount();
});

await test("ChoiceChips: supports keyboard navigation (Space / Enter)", async () => {
  let selected = "";
  const { container, unmount } = await renderWithProviders(
    React.createElement(ChoiceChips, {
      options: ["Alpha", "Beta"],
      selected,
      variant: "single",
      onChange: (val) => {
        selected = val as string;
      },
    })
  );

  const betaBtn = container.querySelectorAll("button[role='button']")[1];
  assert.ok(betaBtn);

  // Press Enter key
  act(() => {
    betaBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  assert.strictEqual(selected, "Beta", "Enter key should select Beta");

  unmount();
});

await test("ChoiceChips: renders multi-select chips with correct aria-pressed and removes chip", async () => {
  let selected = ["Focus", "Strategy"];
  const { container, unmount } = await renderWithProviders(
    React.createElement(ChoiceChips, {
      options: ["Focus", "Strategy", "Execution"],
      selected,
      variant: "multi",
      selectedLabel: "Selected traits:",
      onChange: (val) => {
        selected = val as string[];
      },
    })
  );

  const pressedChips = container.querySelectorAll("button[aria-pressed='true']");
  assert.strictEqual(pressedChips.length, 2, "Expected 2 pressed chips");

  // Remove Focus
  const removeBtn = container.querySelector("button[aria-label='Remove Focus']");
  assert.ok(removeBtn, "Must find remove button for Focus");
  act(() => {
    removeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.deepStrictEqual(selected, ["Strategy"], "Removing Focus leaves Strategy");

  unmount();
});

await test("ChoiceChips: allows adding custom option", async () => {
  let selected: string[] = [];
  const { container, unmount } = await renderWithProviders(
    React.createElement(ChoiceChips, {
      options: ["Default 1"],
      selected,
      variant: "multi",
      allowCustom: true,
      placeholder: "Add custom trait",
      addLabel: "Add trait",
      onChange: (val) => {
        selected = val as string[];
      },
    })
  );

  const input = container.querySelector("input[aria-label='Add custom trait']") as HTMLInputElement;
  assert.ok(input, "Should find custom input");

  act(() => {
    setInputValue(input, "Sovereign Drive");
  });

  const addBtn = input.parentElement?.querySelector("button") as HTMLButtonElement;
  assert.ok(addBtn, "Should find add button next to custom input");
  act(() => {
    addBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.ok(selected.includes("Sovereign Drive"), "Custom option should be added and selected");
  unmount();
});

// 2. StatePill Tests
await test("StatePill: renders each required state with role='status' and aria-label", async () => {
  const states = ["locked", "needs_input", "calibrating", "active", "needs_review"] as const;

  for (const st of states) {
    const { container, unmount } = await renderWithProviders(
      React.createElement(StatePill, { state: st })
    );

    const pill = container.querySelector("[role='status']");
    assert.ok(pill, `State ${st} must render an element with role='status'`);
    assert.ok(
      pill.getAttribute("aria-label")?.includes("Status:"),
      `State ${st} must have aria-label starting with 'Status:'`
    );
    unmount();
  }
});

await test("StatePill: handles case variations and spaces cleanly", async () => {
  const { container: c1, unmount: u1 } = await renderWithProviders(
    React.createElement(StatePill, { state: "Needs input" })
  );
  assert.ok(c1.innerHTML.includes("Needs input"));
  u1();

  const { container: c2, unmount: u2 } = await renderWithProviders(
    React.createElement(StatePill, { state: "Needs review" })
  );
  assert.ok(c2.innerHTML.includes("Needs review"));
  u2();

  const { container: c3, unmount: u3 } = await renderWithProviders(
    React.createElement(StatePill, { state: "Locked" })
  );
  assert.ok(c3.innerHTML.includes("Locked"));
  u3();
});

// 3. LockedLayer Tests
await test("LockedLayer: renders clearly with reasons 'Opens on day 3', 'After your plan', 'Full plan only'", async () => {
  const reasons = ["Opens on day 3", "After your plan", "Full plan only"] as const;

  for (const reason of reasons) {
    const { container, unmount } = await renderWithProviders(
      React.createElement(LockedLayer, {
        layerName: "Character Stack",
        reason,
      })
    );

    const region = container.querySelector("[role='region']");
    assert.ok(region, "LockedLayer must have role='region'");
    assert.ok(container.innerHTML.includes(reason), `LockedLayer must render reason '${reason}'`);
    assert.ok(container.innerHTML.includes("Character Stack"), "LockedLayer must render layer title");
    unmount();
  }
});

// 4. Dialog Sheet Variant Tests
await test("Dialog: DialogSheetContent renders responsive sheet classes for mobile and desktop", async () => {
  const { unmount } = await renderWithProviders(
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

  const bodyHtml = document.body.innerHTML;
  assert.ok(bodyHtml.includes("inset-x-0 bottom-0"), "Must include bottom sheet mobile positioning");
  assert.ok(bodyHtml.includes("sm:inset-y-0 sm:right-0"), "Must include sm: breakpoint right-side panel classes");
  assert.ok(bodyHtml.includes("Sheet Title"), "Must render title");
  assert.ok(bodyHtml.includes("Sheet description"), "Must render description");

  unmount();
});

console.log(`\nJ1 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
