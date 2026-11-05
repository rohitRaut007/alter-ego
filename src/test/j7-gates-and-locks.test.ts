import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequireGoal } from "../components/RequireGoal";
import { LockedLayer } from "../components/LockedLayer";
import { AppStateProvider } from "../lib/app-state";

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

console.log("--- Running J7 Gates & Locked Layers Tests ---");

test("RequireGoal: protects inner content when user is not hydrated/has no goal", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      AppStateProvider,
      null,
      React.createElement(
        RequireGoal,
        null,
        React.createElement("div", { id: "protected-content" }, "Protected Content")
      )
    )
  );

  // When loading or no goal, protected content should not be revealed
  assert.ok(
    !html.includes('id="protected-content"'),
    "RequireGoal must not reveal protected content before goal verification"
  );
});

test("LockedLayer: asserts locked state for Character Stack ('Opens on day 3')", () => {
  const html = renderToStaticMarkup(
    React.createElement(LockedLayer, {
      layerName: "Character Stack",
      reason: "Opens on day 3",
    })
  );

  assert.ok(html.includes("Character Stack is locked"), "Must display layer locked message");
  assert.ok(html.includes("Opens on day 3"), "Must display reason 'Opens on day 3'");
});

test("LockedLayer: asserts locked state for Legacy Timeline ('After your plan')", () => {
  const html = renderToStaticMarkup(
    React.createElement(LockedLayer, {
      layerName: "Legacy Timeline",
      reason: "After your plan",
    })
  );

  assert.ok(html.includes("Legacy Timeline is locked"), "Must display layer locked message");
  assert.ok(html.includes("After your plan"), "Must display reason 'After your plan'");
});

console.log(`\nJ7 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

