import assert from "node:assert";
import React, { act } from "react";
import { CardTile } from "../features/cards/CardTile";
import { QuestionInput } from "../features/cards/QuestionInput";
import { CardConversation } from "../features/cards/CardConversation";
import { mockCardListEveryState, mockCardStepsAllInputTypes } from "./fixtures";
import { renderWithProviders, setInputValue } from "./utils";
import { apiClient } from "../lib/api-client";
import type { Card, CardStep } from "../lib/api-types";

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

console.log("--- Running J4 Dashboard Cards & Conversation Tests ---");

// 1. QuestionInput: all 4 input types with real interactions
await test("QuestionInput: text variant supports user input and triggers onChange", async () => {
  let changedValue = "";
  const { container, unmount } = await renderWithProviders(
    React.createElement(QuestionInput, {
      type: "text",
      value: "",
      placeholder: "Write your reflection...",
      onChange: (val) => {
        changedValue = val as string;
      },
    })
  );

  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  assert.ok(textarea, "Must render textarea for 'text' type");
  assert.strictEqual(textarea.getAttribute("placeholder"), "Write your reflection...");

  act(() => {
    setInputValue(textarea, "Reflecting on daily high-leverage focus.");
  });

  assert.strictEqual(changedValue, "Reflecting on daily high-leverage focus.");
  unmount();
});

await test("QuestionInput: chips variant handles single-choice selection", async () => {
  let selected = "Morning";
  const { container, unmount } = await renderWithProviders(
    React.createElement(QuestionInput, {
      type: "chips",
      options: ["Morning", "Afternoon", "Night"],
      value: selected,
      onChange: (val) => {
        selected = val as string;
      },
    })
  );

  const buttons = container.querySelectorAll("button[role='button']");
  assert.strictEqual(buttons.length, 3);
  assert.strictEqual(buttons[0]?.getAttribute("aria-pressed"), "true");
  assert.strictEqual(buttons[1]?.getAttribute("aria-pressed"), "false");

  act(() => {
    buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.strictEqual(selected, "Afternoon");
  unmount();
});

await test("QuestionInput: multi_chips variant handles multiple active chips", async () => {
  let selected: string[] = ["Deep Work"];
  const { container, unmount } = await renderWithProviders(
    React.createElement(QuestionInput, {
      type: "multi_chips",
      options: ["Deep Work", "Exercise", "Reading"],
      value: selected,
      onChange: (val) => {
        selected = val as string[];
      },
    })
  );

  const readingBtn = Array.from(container.querySelectorAll("button[role='button']")).find((b) =>
    b.textContent?.includes("Reading")
  );
  assert.ok(readingBtn);

  act(() => {
    readingBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.ok(selected.includes("Deep Work"));
  assert.ok(selected.includes("Reading"));
  unmount();
});

await test("QuestionInput: options variant renders radiogroup with aria-checked", async () => {
  let selected = "Alpha";
  const { container, unmount } = await renderWithProviders(
    React.createElement(QuestionInput, {
      type: "options",
      options: ["Alpha", "Beta", "Gamma"],
      value: selected,
      onChange: (val) => {
        selected = val as string;
      },
    })
  );

  const radiogroup = container.querySelector("[role='radiogroup']");
  assert.ok(radiogroup, "Should render radiogroup container");

  const radios = container.querySelectorAll("[role='radio']");
  assert.strictEqual(radios.length, 3);
  assert.strictEqual(radios[0]?.getAttribute("aria-checked"), "true");
  assert.strictEqual(radios[1]?.getAttribute("aria-checked"), "false");

  act(() => {
    radios[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.strictEqual(selected, "Beta");
  unmount();
});

// 2. CardTile states
await test("CardTile: renders state pill and metadata for active card", async () => {
  const activeCard: Card = mockCardListEveryState.find((c) => c.state === "active")!;
  const { container, unmount } = await renderWithProviders(
    React.createElement(CardTile, {
      card: activeCard,
      onClick: () => {},
    })
  );

  const text = container.innerHTML;
  assert.ok(text.toLowerCase().includes("active"), "Should display Active state pill");
  assert.ok(text.includes(activeCard.title), "Should render card title");
  assert.ok(text.includes("questions"), "Should display question count");

  unmount();
});

await test("CardTile: renders unlock reason and disabled attribute for locked card", async () => {
  const lockedCard: Card = mockCardListEveryState.find((c) => c.state === "locked")!;
  const { container, unmount } = await renderWithProviders(
    React.createElement(CardTile, {
      card: lockedCard,
      onClick: () => {},
    })
  );

  const text = container.innerHTML;
  assert.ok(text.includes("Locked"), "Should display Locked state");
  assert.ok(text.includes(lockedCard.unlock_reason!), "Should display unlock reason");
  assert.ok(text.includes('aria-disabled="true"'), "Locked card should have aria-disabled='true'");

  unmount();
});

// 3. CardConversation real interaction and API persistence
await test("CardConversation: submits answers via API and invokes onCardComplete", async () => {
  let submittedPayloads: Array<{ stepNumber: number; answer: any }> = [];
  let completedCardId = "";

  const originalSubmitAnswer = apiClient.submitCardAnswer;
  apiClient.submitCardAnswer = async (cardId, stepNumber, answer) => {
    submittedPayloads.push({ stepNumber, answer });
    const isFinal = stepNumber >= 2;
    return {
      accepted: true,
      next_step: isFinal ? null : stepNumber + 1,
      completed: isFinal,
    };
  };

  const initialStep: CardStep = {
    id: "step-test-1",
    card_id: "card-reality",
    step_number: 1,
    total_steps: 2,
    question: "What is your primary focus block duration?",
    type: "text",
    placeholder: "e.g. 90 minutes",
  };

  try {
    const card = mockCardListEveryState.find((c) => c.slug === "reality-audit")!;
    const { container, unmount } = await renderWithProviders(
      React.createElement(CardConversation, {
        card: { ...card, total_steps: 2 },
        initialStep,
        onCardComplete: (id) => {
          completedCardId = id;
        },
      })
    );

    // Assert initial question rendered
    assert.ok(container.innerHTML.includes("What is your primary focus block duration?"));

    // Enter answer
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    act(() => {
      setInputValue(textarea, "90 minutes protected morning block");
    });

    // Click Continue
    const continueBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue") || b.textContent?.includes("Finish")
    ) as HTMLButtonElement;
    assert.ok(continueBtn);

    await act(async () => {
      continueBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Verify first step answer was submitted
    assert.strictEqual(submittedPayloads.length, 1);
    assert.strictEqual(submittedPayloads[0]?.stepNumber, 1);
    assert.strictEqual(submittedPayloads[0]?.answer, "90 minutes protected morning block");

    unmount();
  } finally {
    apiClient.submitCardAnswer = originalSubmitAnswer;
  }
});

console.log(`\nJ4 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
