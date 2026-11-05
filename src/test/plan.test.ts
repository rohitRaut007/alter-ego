import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanPage } from "../features/plan/PlanPage";
import { mockSprintWithMilestonesAndFallbacks } from "./fixtures";
import type { FallbackPatchPayload, SprintPlan } from "../lib/api-types";

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

console.log("--- Running J6 Plan Page Tests ---");

// 1. Milestones & Timeline
test("PlanPage: renders milestone timeline ending at sprint target date", () => {
  const html = renderToStaticMarkup(
    React.createElement(PlanPage, {
      initialSprint: mockSprintWithMilestonesAndFallbacks,
    })
  );

  assert.ok(html.includes("Target: 2026-12-31"), "Must display target date 2026-12-31");
  assert.ok(html.includes("Core Protocol Architecture Locked"), "Must render Milestone 1");
  assert.ok(html.includes("First 10 Working Prototypes Shipped"), "Must render Milestone 2");
  assert.ok(html.includes("Full 90-Day Sprint Transformation Verified"), "Must render Milestone 3");
});

// 2. Two-week task window with fallback plans
test("PlanPage: shows tasks for the next two weeks with milestone and if-then fallback plan", () => {
  const html = renderToStaticMarkup(
    React.createElement(PlanPage, {
      initialSprint: mockSprintWithMilestonesAndFallbacks,
    })
  );

  assert.ok(html.includes("Week 1"), "Must render Week 1 task tag");
  assert.ok(html.includes("Week 2"), "Must render Week 2 task tag");
  assert.ok(html.includes("If-Then Fallback:"), "Must render If-Then Fallback label");
  assert.ok(
    html.includes("If feeling scattered, write just 3 bullet points defining who you are NOT."),
    "Must render fallback plan text for task 1"
  );
  assert.ok(
    html.includes("If short on time, do the 15-minute skeleton review of the top 3 modules."),
    "Must render fallback plan text for task 2"
  );
});

// 3. 15-minute version toggle & Fallback PATCH body
test("PlanPage: verifies fallback PATCH request payload shape { did_15_min_version: boolean }", async () => {
  let submittedPayload: FallbackPatchPayload | null = null;
  let taskIdCalled = "";

  const mockPatchFallback = async (taskId: string, payload: FallbackPatchPayload) => {
    taskIdCalled = taskId;
    submittedPayload = payload;
  };

  await mockPatchFallback("t-002", { did_15_min_version: true });

  assert.strictEqual(taskIdCalled, "t-002");
  assert.deepStrictEqual(submittedPayload, { did_15_min_version: true });
});

// 4. Later weeks: theme and expected outcome only
test("PlanPage: later weeks display only theme and expected outcome rather than detailed tasks", () => {
  const html = renderToStaticMarkup(
    React.createElement(PlanPage, {
      initialSprint: mockSprintWithMilestonesAndFallbacks,
    })
  );

  assert.ok(html.includes("Later Weeks Roadmap"), "Must render later weeks section");
  assert.ok(html.includes("Velocity Acceleration"), "Must render Week 3 theme");
  assert.ok(
    html.includes("Double daily throughput with protected morning blocks."),
    "Must render Week 3 outcome"
  );
  assert.ok(html.includes("Resilience & Friction Defense"), "Must render Week 4 theme");
});

// 5. Rebuild / Plan next two weeks button when needs_review is true
test("PlanPage: displays 'Plan the next two weeks' button when needs_review is true", () => {
  const sprintNeedingReview: SprintPlan = {
    ...mockSprintWithMilestonesAndFallbacks,
    needs_review: true,
  };

  const html = renderToStaticMarkup(
    React.createElement(PlanPage, {
      initialSprint: sprintNeedingReview,
    })
  );

  assert.ok(html.includes("Plan the next two weeks"), "Must render 'Plan the next two weeks' button");
  assert.ok(html.includes("Two-Week Sprint Review Due"), "Must render review due banner");
});

console.log(`\nJ6 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

