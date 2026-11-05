import assert from "node:assert";
import React, { act } from "react";
import { PlanPage } from "../features/plan/PlanPage";
import { mockSprintWithMilestonesAndFallbacks } from "./fixtures";
import { renderWithProviders } from "./utils";
import type { FallbackPatchPayload, SprintPlan } from "../lib/api-types";

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

console.log("--- Running J6 Plan Page Tests ---");

// 1. Milestones & Timeline
await test("PlanPage: renders milestone timeline ending at sprint target date", async () => {
  const { container, unmount } = await renderWithProviders(
    React.createElement(PlanPage, {
      initialSprint: mockSprintWithMilestonesAndFallbacks,
    })
  );

  const text = container.innerHTML;
  assert.ok(text.includes("Target: 2026-12-31"), "Must display target date 2026-12-31");
  assert.ok(text.includes("Core Protocol Architecture Locked"), "Must render Milestone 1");
  assert.ok(text.includes("First 10 Working Prototypes Shipped"), "Must render Milestone 2");
  assert.ok(text.includes("Full 90-Day Sprint Transformation Verified"), "Must render Milestone 3");

  unmount();
});

// 2. Two-week task window with fallback plans
await test("PlanPage: shows tasks for the next two weeks with milestone and if-then fallback plan", async () => {
  const { container, unmount } = await renderWithProviders(
    React.createElement(PlanPage, {
      initialSprint: mockSprintWithMilestonesAndFallbacks,
    })
  );

  const text = container.innerHTML;
  assert.ok(text.includes("Week 1"), "Must render Week 1 task tag");
  assert.ok(text.includes("Week 2"), "Must render Week 2 task tag");
  assert.ok(text.includes("If-Then Fallback:"), "Must render If-Then Fallback label");
  assert.ok(
    text.includes("If feeling scattered, write just 3 bullet points defining who you are NOT."),
    "Must render fallback plan text for task 1"
  );
  assert.ok(
    text.includes("If short on time, do the 15-minute skeleton review of the top 3 modules."),
    "Must render fallback plan text for task 2"
  );

  unmount();
});

// 3. 15-minute version toggle interaction & Fallback PATCH body
await test("PlanPage: toggling 15-min version sends { did_15_min_version: true } and updates UI", async () => {
  let patchedTaskId = "";
  let submittedPayload: FallbackPatchPayload | null = null;

  const { container, unmount } = await renderWithProviders(
    React.createElement(PlanPage, {
      initialSprint: mockSprintWithMilestonesAndFallbacks,
      onFallbackToggle: async (taskId, payload) => {
        patchedTaskId = taskId;
        submittedPayload = payload;
      },
    })
  );

  // Find the first switch button (for t-001 which has did_15_min_version: false)
  const switches = container.querySelectorAll("button[role='switch']");
  assert.ok(switches.length >= 2, "Must find task switch buttons");
  const firstSwitch = switches[0] as HTMLButtonElement;
  assert.strictEqual(firstSwitch.getAttribute("aria-checked"), "false");

  // Click the switch
  await act(async () => {
    firstSwitch.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.strictEqual(patchedTaskId, "t-001");
  assert.deepStrictEqual(submittedPayload, { did_15_min_version: true });
  assert.strictEqual(firstSwitch.getAttribute("aria-checked"), "true", "Switch should update to true after success");

  unmount();
});

// 4. Failed PATCH toggle does not update state and shows error alert
await test("PlanPage: failed fallback PATCH does not update persisted state", async () => {
  const { container, unmount } = await renderWithProviders(
    React.createElement(PlanPage, {
      initialSprint: mockSprintWithMilestonesAndFallbacks,
      onFallbackToggle: async () => {
        throw new Error("Failed to persist task fallback status");
      },
    })
  );

  const switches = container.querySelectorAll("button[role='switch']");
  const firstSwitch = switches[0] as HTMLButtonElement;
  assert.strictEqual(firstSwitch.getAttribute("aria-checked"), "false");

  await act(async () => {
    firstSwitch.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  // Verify error alert
  const alert = container.querySelector("[role='alert']");
  assert.ok(alert, "Must render alert role on PATCH failure");
  assert.ok(container.innerHTML.includes("Failed to persist task fallback status"));

  // Verify switch state remained false
  assert.strictEqual(firstSwitch.getAttribute("aria-checked"), "false", "State must remain false on failure");

  unmount();
});

// 5. Later weeks: theme and expected outcome only
await test("PlanPage: later weeks display only theme and expected outcome rather than detailed tasks", async () => {
  const { container, unmount } = await renderWithProviders(
    React.createElement(PlanPage, {
      initialSprint: mockSprintWithMilestonesAndFallbacks,
    })
  );

  const text = container.textContent || "";
  assert.ok(text.includes("Later Weeks Roadmap"), "Must render later weeks section");
  assert.ok(text.includes("Velocity Acceleration"), "Must render Week 3 theme");
  assert.ok(
    text.includes("Double daily throughput with protected morning blocks."),
    "Must render Week 3 outcome"
  );
  assert.ok(text.includes("Resilience & Friction Defense"), "Must render Week 4 theme");

  unmount();
});

// 6. Rebuild / Plan next two weeks button when needs_review is true
await test("PlanPage: displays 'Plan the next two weeks' button when needs_review is true and handles click", async () => {
  let rebuildCalled = false;
  const sprintNeedingReview: SprintPlan = {
    ...mockSprintWithMilestonesAndFallbacks,
    needs_review: true,
  };

  const { container, unmount } = await renderWithProviders(
    React.createElement(PlanPage, {
      initialSprint: sprintNeedingReview,
      onPlanNextTwoWeeks: async () => {
        rebuildCalled = true;
      },
    })
  );

  const text = container.innerHTML;
  assert.ok(text.includes("Plan the next two weeks"), "Must render 'Plan the next two weeks' button");
  assert.ok(text.includes("Two-Week Sprint Review Due"), "Must render review due banner");

  const rebuildBtn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Plan the next two weeks")
  ) as HTMLButtonElement;
  assert.ok(rebuildBtn);

  await act(async () => {
    rebuildBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.strictEqual(rebuildCalled, true, "Clicking button must trigger rebuild callback");

  // Banner should now be dismissed because needs_review transitioned to false
  assert.ok(
    !container.innerHTML.includes("Two-Week Sprint Review Due"),
    "Review due banner should clear after rebuild success"
  );

  unmount();
});

console.log(`\nJ6 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
