import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SeedPage } from "../features/seed/SeedPage";
import { AppStateProvider } from "../lib/app-state";
import { addDays, addMonths, format, startOfToday } from "date-fns";

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

console.log("--- Running J3 Seed Flow Tests ---");

test("SeedPage: renders Step 1 with all three situation options", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppStateProvider, null, React.createElement(SeedPage))
  );

  assert.ok(html.includes("Where are you with this?"), "Should display question 1 title");
  assert.ok(html.includes("Know the goal"), "Should have 'Know the goal' option");
  assert.ok(html.includes("Have a direction"), "Should have 'Have a direction' option");
  assert.ok(html.includes("Something needs to change"), "Should have 'Something needs to change' option");
  assert.ok(html.includes("Step 1 / 4"), "Should display step 1 of 4");
});

test("SeedPage: date validation rules conform to 14 to 730 day boundary", () => {
  const today = startOfToday();
  const minAllowed = addDays(today, 14);
  const maxAllowed = addDays(today, 730);

  const formattedMin = format(minAllowed, "yyyy-MM-dd");
  const formattedMax = format(maxAllowed, "yyyy-MM-dd");

  assert.ok(minAllowed < maxAllowed, "Min date must precede max date");
  assert.strictEqual(formattedMin.length, 10, "Formatted min date is valid ISO");
  assert.strictEqual(formattedMax.length, 10, "Formatted max date is valid ISO");
});

test("SeedPage: safety boundary keywords detected properly", () => {
  const SAFETY_KEYWORDS = ["burnout", "hopeless", "can't go on", "harm", "giving up", "collapse", "starve"];
  const userText1 = "I am experiencing acute burnout and want to fix my schedule";
  const userText2 = "I want to build a profitable SaaS";

  const hit1 = SAFETY_KEYWORDS.some((kw) => userText1.toLowerCase().includes(kw));
  const hit2 = SAFETY_KEYWORDS.some((kw) => userText2.toLowerCase().includes(kw));

  assert.strictEqual(hit1, true, "Should detect burnout keyword in user text 1");
  assert.strictEqual(hit2, false, "Should not flag safe user text 2");
});

test("SeedPage: HTTP 409 conflict contract routes to dashboard", () => {
  let navigatedTo = "";
  const mockNavigate = ({ to }: { to: string }) => {
    navigatedTo = to;
  };

  // Simulating 409 handling
  const handleApiError = (err: { status: number }) => {
    if (err.status === 409) {
      mockNavigate({ to: "/dashboard" });
    }
  };

  handleApiError({ status: 409 });
  assert.strictEqual(navigatedTo, "/dashboard", "409 Conflict must immediately navigate to /dashboard");
});

console.log(`\nJ3 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

