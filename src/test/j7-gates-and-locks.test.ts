import assert from "node:assert";
import React from "react";
import { RequireGoal } from "../components/RequireGoal";
import { LockedLayer } from "../components/LockedLayer";
import { renderWithProviders } from "./utils";

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

console.log("--- Running J7 Gates & Locked Layers Tests ---");

await test("RequireGoal: protects inner content when user is not hydrated/has no goal", async () => {
  const { container, unmount } = await renderWithProviders(
    React.createElement(
      RequireGoal,
      null,
      React.createElement("div", { id: "protected-content" }, "Protected Content")
    )
  );

  // When loading or no goal, protected content should not be revealed
  const protectedDiv = container.querySelector("#protected-content");
  assert.strictEqual(
    protectedDiv,
    null,
    "RequireGoal must not reveal protected content before goal verification"
  );

  unmount();
});

await test("LockedLayer: asserts locked state for Character Stack ('Opens on day 3')", async () => {
  const { container, unmount } = await renderWithProviders(
    React.createElement(LockedLayer, {
      layerName: "Character Stack",
      reason: "Opens on day 3",
    })
  );

  const text = container.innerHTML;
  assert.ok(text.includes("Character Stack is locked"), "Must display layer locked message");
  assert.ok(text.includes("Opens on day 3"), "Must display reason 'Opens on day 3'");

  unmount();
});

await test("LockedLayer: asserts locked state for Legacy Timeline ('After your plan')", async () => {
  const { container, unmount } = await renderWithProviders(
    React.createElement(LockedLayer, {
      layerName: "Legacy Timeline",
      reason: "After your plan",
    })
  );

  const text = container.innerHTML;
  assert.ok(text.includes("Legacy Timeline is locked"), "Must display layer locked message");
  assert.ok(text.includes("After your plan"), "Must display reason 'After your plan'");

  unmount();
});

console.log(`\nJ7 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
