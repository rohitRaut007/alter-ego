import assert from "node:assert";
import React, { act } from "react";
import { SeedPage } from "../features/seed/SeedPage";
import { renderWithProviders, setInputValue } from "./utils";
import { apiClient } from "../lib/api-client";
import { addDays, format, startOfToday } from "date-fns";
import type { SeedPayload, SeedResult } from "../lib/api-types";

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

console.log("--- Running J3 Seed Flow Tests ---");

await test("SeedPage: renders Step 1 with situation options", async () => {
  const { container, unmount } = await renderWithProviders(React.createElement(SeedPage));

  const text = container.innerHTML;
  assert.ok(text.includes("Where are you with this?"), "Should display question 1 title");
  assert.ok(text.includes("Know the goal"), "Should have 'Know the goal' option");
  assert.ok(text.includes("Have a direction"), "Should have 'Have a direction' option");
  assert.ok(text.includes("Something needs to change"), "Should have 'Something needs to change' option");
  assert.ok(text.includes("Step 1 / 4"), "Should display step 1 of 4");

  unmount();
});

await test("SeedPage: validates 14 to 730 day boundary with clear error feedback", async () => {
  const { container, unmount } = await renderWithProviders(React.createElement(SeedPage));

  // Step 1 -> Click Next to Step 2
  const nextBtn = container.querySelector("button.rounded-xl.px-6") as HTMLButtonElement;
  assert.ok(nextBtn, "Should find Next button");
  act(() => {
    nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  // Now on Step 2
  const today = startOfToday();
  const tooSoon = format(addDays(today, 5), "yyyy-MM-dd"); // 5 days < 14
  const tooFar = format(addDays(today, 800), "yyyy-MM-dd"); // 800 days > 730
  const validDate = format(addDays(today, 90), "yyyy-MM-dd"); // 90 days

  const customDateInput = container.querySelector("input[type='date']") as HTMLInputElement;
  assert.ok(customDateInput, "Should find custom date input");

  // Test too soon date
  act(() => {
    setInputValue(customDateInput, tooSoon);
  });
  assert.ok(container.innerHTML.includes("at least 14 days"), "Must show min date error for 5 days");

  // Test too far date
  act(() => {
    setInputValue(customDateInput, tooFar);
  });
  assert.ok(container.innerHTML.includes("cannot exceed 730 days"), "Must show max date error for 800 days");

  // Test valid date
  act(() => {
    setInputValue(customDateInput, validDate);
  });
  assert.ok(!container.innerHTML.includes("cannot exceed 730 days"), "Error must clear for valid date");

  unmount();
});

await test("SeedPage: detects safety keywords without losing state", async () => {
  const { container, unmount } = await renderWithProviders(React.createElement(SeedPage));

  // Step 1 -> Next to Step 2
  const nextBtn = container.querySelector("button.rounded-xl.px-6") as HTMLButtonElement;
  act(() => {
    nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  assert.ok(textarea, "Should find statement textarea on Step 2");

  act(() => {
    setInputValue(textarea, "I am facing intense burnout and exhaustion");
  });

  const statusAlert = container.querySelector("[role='status']");
  assert.ok(statusAlert, "Must display safety notice alert when burnout keyword is present");
  assert.ok(
    container.innerHTML.includes("Pacing matters"),
    "Safety alert must display pacing guidance"
  );
  assert.strictEqual(textarea.value, "I am facing intense burnout and exhaustion", "User text must be preserved");

  unmount();
});

await test("SeedPage: submits full agreed payload and displays authoritative first task", async () => {
  let submittedPayload: SeedPayload | null = null;
  const originalSeedGoal = apiClient.seedGoal;

  const mockFirstTask = {
    id: "task-seed-001",
    title: "10-minute setup: calibrate first protocol stack",
    estimated_minutes: 10,
    layer: "identity",
    priority: true,
    status: "pending" as const,
  };

  apiClient.seedGoal = async (payload: SeedPayload): Promise<SeedResult> => {
    submittedPayload = payload;
    return {
      goal: {
        id: "goal-test-99",
        user_id: "user-1",
        title: payload.target_statement,
        target_date: payload.target_date,
        weekday_minutes: payload.weekday_minutes,
        weekend_minutes: payload.weekend_minutes,
        today_minutes: payload.today_minutes,
        situation: payload.situation,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      first_task: mockFirstTask,
      cards: [],
    };
  };

  try {
    const { container, unmount } = await renderWithProviders(React.createElement(SeedPage));

    // Step 1 -> Step 2
    let nextBtn = container.querySelector("button.rounded-xl.px-6") as HTMLButtonElement;
    act(() => {
      nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Step 2: enter valid statement and target date
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    act(() => {
      setInputValue(textarea, "An engineer who builds sovereign resilient agent software.");
    });

    // Step 2 -> Step 3
    nextBtn = container.querySelector("button.rounded-xl.px-6") as HTMLButtonElement;
    act(() => {
      nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Step 3 -> Step 4
    nextBtn = container.querySelector("button.rounded-xl.px-6") as HTMLButtonElement;
    act(() => {
      nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Step 4: Click Final Submit
    const submitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Complete Seed")
    ) as HTMLButtonElement;
    assert.ok(submitBtn, "Should find 'Complete Seed' submit button");
    await act(async () => {
      submitBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Assert submitted payload matches exact contract
    assert.ok(submittedPayload, "apiClient.seedGoal must have been called");
    const payload = submittedPayload as unknown as SeedPayload;
    assert.strictEqual(payload.situation, "know_goal");
    assert.strictEqual(
      payload.target_statement,
      "An engineer who builds sovereign resilient agent software."
    );
    assert.strictEqual(typeof payload.target_date, "string");
    assert.strictEqual(payload.weekday_minutes, 60);
    assert.strictEqual(payload.weekend_minutes, 90);
    assert.strictEqual(payload.today_minutes, 10);
    assert.strictEqual(payload.today_availability, "Right now");

    // Assert authoritative first task is rendered in the UI
    assert.ok(
      container.innerHTML.includes("10-minute setup: calibrate first protocol stack"),
      "Must render authoritative first task returned from server"
    );

    unmount();
  } finally {
    apiClient.seedGoal = originalSeedGoal;
  }
});

await test("SeedPage: HTTP 409 conflict redirects immediately to /dashboard", async () => {
  let navigatedTo = "";
  const originalSeedGoal = apiClient.seedGoal;

  apiClient.seedGoal = async (): Promise<SeedResult> => {
    const error: any = new Error("Goal already exists for this user");
    error.status = 409;
    error.code = "GOAL_CONFLICT";
    throw error;
  };

  try {
    const { container, unmount } = await renderWithProviders(
      React.createElement(SeedPage, {
        onNavigate: ({ to }: { to: string }) => {
          navigatedTo = to;
        },
      } as any)
    );

    // Step 1 -> 2 -> 3 -> 4 -> Submit
    for (let i = 0; i < 3; i++) {
      const nextBtn = container.querySelector("button.rounded-xl.px-6") as HTMLButtonElement;
      if (i === 1) {
        const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
        act(() => {
          setInputValue(textarea, "Test statement for 409 redirect");
        });
      }
      act(() => {
        nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }

    const submitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Complete Seed")
    ) as HTMLButtonElement;
    assert.ok(submitBtn, "Should find 'Complete Seed' button");
    await act(async () => {
      submitBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    assert.strictEqual(navigatedTo, "/dashboard", "409 Conflict must immediately navigate to /dashboard");
    unmount();
  } finally {
    apiClient.seedGoal = originalSeedGoal;
  }
});

await test("SeedPage: API failure displays retryable error without generating fake task", async () => {
  const originalSeedGoal = apiClient.seedGoal;

  apiClient.seedGoal = async (): Promise<SeedResult> => {
    const error: any = new Error("Database network failure: could not persist goal");
    error.status = 500;
    throw error;
  };

  try {
    const { container, unmount } = await renderWithProviders(React.createElement(SeedPage));

    for (let i = 0; i < 3; i++) {
      const nextBtn = container.querySelector("button.rounded-xl.px-6") as HTMLButtonElement;
      if (i === 1) {
        const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
        act(() => {
          setInputValue(textarea, "Valid goal statement for failure test");
        });
      }
      act(() => {
        nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }

    const submitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Complete Seed")
    ) as HTMLButtonElement;
    assert.ok(submitBtn, "Should find 'Complete Seed' button");
    await act(async () => {
      submitBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Check error alert is displayed
    const alert = container.querySelector("[role='alert']");
    assert.ok(alert, "Must render alert role on persistence failure");
    assert.ok(
      container.innerHTML.includes("Database network failure"),
      "Must display genuine error message"
    );

    // Assert NO fake first task was generated
    assert.ok(
      !container.innerHTML.includes("Your initial trajectory is set"),
      "Must NOT display success screen or fake first task when persistence fails"
    );

    unmount();
  } finally {
    apiClient.seedGoal = originalSeedGoal;
  }
});

console.log(`\nJ3 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
