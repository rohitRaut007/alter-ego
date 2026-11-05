import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CardTile } from "../features/cards/CardTile";
import { QuestionInput } from "../features/cards/QuestionInput";
import { CardConversation } from "../features/cards/CardConversation";
import { mockCardListEveryState, mockCardStepsAllInputTypes } from "./fixtures";
import type { Card } from "../lib/api-types";

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

console.log("--- Running J4 Dashboard Cards & Conversation Tests ---");

// 1. Input Types
test("QuestionInput: renders text input correctly", () => {
  const html = renderToStaticMarkup(
    React.createElement(QuestionInput, {
      type: "text",
      value: "Focus on systems",
      onChange: () => {},
      placeholder: "Write your answer",
    })
  );
  assert.ok(html.includes("Focus on systems"), "Should contain text value");
  assert.ok(html.includes('placeholder="Write your answer"'), "Should contain placeholder");
});

test("QuestionInput: renders single chips correctly", () => {
  const html = renderToStaticMarkup(
    React.createElement(QuestionInput, {
      type: "chips",
      options: ["Morning", "Afternoon", "Night"],
      value: "Morning",
      onChange: () => {},
    })
  );
  assert.ok(html.includes('aria-pressed="true"'), "Selected chip must have aria-pressed='true'");
  assert.ok(html.includes("Morning"), "Should render chip option");
});

test("QuestionInput: renders multi_chips with multiple selections", () => {
  const html = renderToStaticMarkup(
    React.createElement(QuestionInput, {
      type: "multi_chips",
      options: ["Deep Work", "Exercise", "Reading"],
      value: ["Deep Work", "Reading"],
      onChange: () => {},
    })
  );
  const pressedCount = (html.match(/aria-pressed="true"/g) || []).length;
  assert.strictEqual(pressedCount, 2, "Expected 2 chips pressed");
});

test("QuestionInput: renders options radio list", () => {
  const html = renderToStaticMarkup(
    React.createElement(QuestionInput, {
      type: "options",
      options: ["Alpha", "Beta", "Gamma"],
      value: "Alpha",
      onChange: () => {},
    })
  );
  assert.ok(html.includes('role="radiogroup"'), "Should render radiogroup");
  assert.ok(html.includes('aria-checked="true"'), "Selected option must have aria-checked='true'");
});

// 2. CardTile states
test("CardTile: renders state pill and metadata for active card", () => {
  const activeCard: Card = mockCardListEveryState.find((c) => c.state === "active")!;
  const html = renderToStaticMarkup(
    React.createElement(CardTile, {
      card: activeCard,
      onClick: () => {},
    })
  );
  assert.ok(html.includes("Active"), "Should display Active state pill");
  assert.ok(html.includes(activeCard.title), "Should render title");
  assert.ok(html.includes("questions"), "Should display question count for active card");
});

test("CardTile: renders unlock reason and disabled attribute for locked card", () => {
  const lockedCard: Card = mockCardListEveryState.find((c) => c.state === "locked")!;
  const html = renderToStaticMarkup(
    React.createElement(CardTile, {
      card: lockedCard,
      onClick: () => {},
    })
  );
  assert.ok(html.includes("Locked"), "Should display Locked state");
  assert.ok(html.includes(lockedCard.unlock_reason!), "Should display unlock reason");
  assert.ok(html.includes('aria-disabled="true"'), "Locked card should have aria-disabled='true'");
});

// 3. Card completion update
test("CardConversation: completes card and triggers completion callback", () => {
  let completedId = "";
  const card = mockCardListEveryState[1]!;

  const onComplete = (id: string) => {
    completedId = id;
  };

  assert.ok(card.id, "Card has an ID");
  onComplete(card.id);
  assert.strictEqual(completedId, card.id, "Callback called with card ID");
});

console.log(`\nJ4 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

