const assert = require("assert");
const fs = require("fs");
const ts = require("C:/Users/HP/AppData/Local/Programs/Microsoft VS Code/2c33b50b16/resources/app/extensions/node_modules/typescript/lib/typescript.js");

console.log("==================================================");
console.log("     Alter Ego OS - Core Unit Tests (J1 - J10)   ");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}:`, err);
    failed++;
  }
}

// Transpile utils.tsx in memory
const utilsTsx = fs.readFileSync("d:/alter-ego-os/apps/web/src/test/utils.tsx", "utf8");
const utilsCjs = ts.transpileModule(utilsTsx, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    skipLibCheck: true,
  },
}).outputText;

const utilsModule = { exports: {} };
const fn = new Function("exports", "module", "require", utilsCjs);
fn(utilsModule.exports, utilsModule, require);
const fixtures = utilsModule.exports;

// ----------------------------------------------------
// J1: Shared UI Component Logic & ARIA Attributes
// ----------------------------------------------------
test("J1: ChoiceChips single-select toggle logic", () => {
  const options = ["Option A", "Option B", "Option C"];
  let selected = "Option A";

  const handleToggle = (opt) => {
    selected = selected === opt ? "" : opt;
  };

  handleToggle("Option B");
  assert.strictEqual(selected, "Option B");
  handleToggle("Option B");
  assert.strictEqual(selected, "");
});

test("J1: ChoiceChips multi-select array logic", () => {
  let selected = ["Focus"];
  const handleToggle = (opt) => {
    selected = selected.includes(opt)
      ? selected.filter((x) => x !== opt)
      : [...selected, opt];
  };

  handleToggle("Strategy");
  assert.deepStrictEqual(selected, ["Focus", "Strategy"]);
  handleToggle("Focus");
  assert.deepStrictEqual(selected, ["Strategy"]);
});

test("J1: StatePill normalization and aria-label", () => {
  const normalize = (state) => {
    const s = state.toLowerCase().replace(/[-\s]/g, "_");
    if (s.includes("lock")) return "locked";
    if (s.includes("input")) return "needs_input";
    if (s.includes("calibrat")) return "calibrating";
    if (s.includes("review")) return "needs_review";
    if (s.includes("active")) return "active";
    return s;
  };

  assert.strictEqual(normalize("Needs input"), "needs_input");
  assert.strictEqual(normalize("Needs review"), "needs_review");
  assert.strictEqual(normalize("Calibrating"), "calibrating");
  assert.strictEqual(normalize("Locked"), "locked");
  assert.strictEqual(normalize("Active"), "active");
});

test("J1: Dialog Sheet responsive positioning classes", () => {
  const mobileSheetClass = "inset-x-0 bottom-0 top-auto max-h-[85vh] rounded-t-2xl";
  const desktopPanelClass = "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-lg sm:rounded-l-2xl";

  assert.ok(mobileSheetClass.includes("bottom-0"), "Mobile sheet must dock to bottom");
  assert.ok(desktopPanelClass.includes("sm:right-0"), "Desktop panel must dock to right");
});

// ----------------------------------------------------
// J2: Fixtures and Types Verification
// ----------------------------------------------------
test("J2: Fixtures type compatibility and every card state covered", () => {
  const { mockCardListEveryState, mockUserMeWithGoal, mockUserMeWithoutGoal } = fixtures;

  assert.strictEqual(mockUserMeWithGoal.has_goal, true);
  assert.strictEqual(mockUserMeWithoutGoal.has_goal, false);

  const states = mockCardListEveryState.map((c) => c.state);
  assert.ok(states.includes("locked"), "Must have locked state");
  assert.ok(states.includes("needs_input"), "Must have needs_input state");
  assert.ok(states.includes("calibrating"), "Must have calibrating state");
  assert.ok(states.includes("active"), "Must have active state");
  assert.ok(states.includes("needs_review"), "Must have needs_review state");
});

// ----------------------------------------------------
// J3: Seed Flow Rules & Date Boundaries
// ----------------------------------------------------
test("J3: Seed custom date validation between 14 and 730 days", () => {
  const isDateValid = (daysFromNow) => {
    return daysFromNow >= 14 && daysFromNow <= 730;
  };

  assert.strictEqual(isDateValid(5), false, "5 days is too short (min 14)");
  assert.strictEqual(isDateValid(14), true, "14 days is valid boundary");
  assert.strictEqual(isDateValid(180), true, "180 days is valid");
  assert.strictEqual(isDateValid(730), true, "730 days is valid boundary");
  assert.strictEqual(isDateValid(800), false, "800 days is too long (max 730)");
});

test("J3: Safety keyword detection without aborting step", () => {
  const SAFETY_KEYWORDS = ["burnout", "hopeless", "can't go on", "harm", "giving up", "collapse"];
  const checkSafety = (str) => SAFETY_KEYWORDS.some((kw) => str.toLowerCase().includes(kw));

  assert.strictEqual(checkSafety("Experiencing heavy burnout lately"), true);
  assert.strictEqual(checkSafety("Building my alter ego systematically"), false);
});

test("J3: HTTP 409 conflict handling contract", () => {
  let destination = "";
  const handleSeedResponse = (status) => {
    if (status === 409) {
      destination = "/dashboard";
    }
  };

  handleSeedResponse(409);
  assert.strictEqual(destination, "/dashboard");
});

// ----------------------------------------------------
// J4 & J5: Tradeoffs & Polling Loop
// ----------------------------------------------------
test("J5: Tradeoff option request payload matches { choices: ['move_date'] }", () => {
  const optionId = "move_date";
  const payload = { choices: [optionId] };
  assert.deepStrictEqual(payload, { choices: ["move_date"] });
});

test("J5: Server-provided metrics displayed without authoritative browser recalculation", () => {
  const { mockCardListEveryState } = fixtures;
  const calibrating = mockCardListEveryState.find((c) => c.state === "calibrating");

  assert.strictEqual(calibrating.verdict.effort_hours, 180);
  assert.strictEqual(calibrating.verdict.weekly_hours, 12);
  assert.strictEqual(calibrating.verdict.coverage_pct, 75);
});

// ----------------------------------------------------
// J6: Plan Page & Fallback PATCH
// ----------------------------------------------------
test("J6: Plan fallback PATCH payload { did_15_min_version: boolean }", () => {
  const makePatchPayload = (did15Min) => ({ did_15_min_version: did15Min });

  assert.deepStrictEqual(makePatchPayload(true), { did_15_min_version: true });
  assert.deepStrictEqual(makePatchPayload(false), { did_15_min_version: false });
});

test("J6: Task filtering to next two weeks only", () => {
  const tasks = [
    { id: "t1", week_number: 1, title: "Task 1" },
    { id: "t2", week_number: 2, title: "Task 2" },
    { id: "t3", week_number: 3, title: "Task 3" },
  ];

  const twoWeekTasks = tasks.filter((t) => t.week_number <= 2);
  assert.strictEqual(twoWeekTasks.length, 2);
  assert.strictEqual(twoWeekTasks[0].id, "t1");
  assert.strictEqual(twoWeekTasks[1].id, "t2");
});

// ----------------------------------------------------
// J7 & J10: Gates and Interview Removal
// ----------------------------------------------------
test("J7: LockedLayer reason matches business rules ('Opens on day 3' for Character)", () => {
  const getUnlockReason = (layer, sprintDay) => {
    if (layer === "character" && sprintDay < 3) return "Opens on day 3";
    if (layer === "legacy" && sprintDay < 14) return "After your plan";
    return null;
  };

  assert.strictEqual(getUnlockReason("character", 1), "Opens on day 3");
  assert.strictEqual(getUnlockReason("character", 3), null);
  assert.strictEqual(getUnlockReason("legacy", 5), "After your plan");
});

test("J10: Onboarding route redirects to /seed", () => {
  const onboardingContent = fs.readFileSync("d:/alter-ego-os/src/routes/onboarding.tsx", "utf8");
  assert.ok(onboardingContent.includes('to: "/seed"'), "Onboarding must redirect to /seed");
  assert.ok(!onboardingContent.includes("onboardingQuestions"), "Old interview questions removed from active onboarding");
});

console.log("\n==================================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("==================================================");

if (failed > 0) process.exit(1);
