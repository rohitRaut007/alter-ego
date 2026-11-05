/**
 * Unified Test Runner for Alter Ego OS
 * Uses happy-dom for DOM environment and jiti for native TSX/TS execution
 */
import { Window } from "happy-dom";
import { createJiti } from "jiti";
import React from "react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// 1. Setup Happy-DOM environment
const window = new Window({
  url: "http://localhost:3000",
  width: 1280,
  height: 800,
});

globalThis.React = React;
globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.NodeFilter = window.NodeFilter;
globalThis.getComputedStyle = window.getComputedStyle
  ? window.getComputedStyle.bind(window)
  : () => ({ getPropertyValue: () => "" });
globalThis.MutationObserver =
  window.MutationObserver ||
  class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
try {
  Object.defineProperty(globalThis, "navigator", {
    value: window.navigator,
    configurable: true,
    writable: true,
  });
} catch {
  // Use existing global navigator
}
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.HTMLButtonElement = window.HTMLButtonElement;
globalThis.customElements = window.customElements;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.FocusEvent = window.FocusEvent;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// 2. Setup Jiti with JSX and path alias
const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    "@": path.resolve(rootDir, "src"),
  },
});

// 3. Test files to execute
const testFiles = [
  "./src/test/j1-shared-ui.test.ts",
  "./src/test/seed-flow.test.ts",
  "./src/test/dashboard-cards.test.ts",
  "./src/test/tradeoffs.test.ts",
  "./src/test/plan.test.ts",
  "./src/test/j7-gates-and-locks.test.ts",
];

console.log("=========================================");
console.log("  ALTER EGO OS - TEST SUITE EXECUTION    ");
console.log("=========================================\n");

let allPassed = true;

for (const testFile of testFiles) {
  const absPath = path.resolve(rootDir, testFile);
  console.log(`\n▶ Running ${testFile}...`);
  try {
    await jiti.import(absPath);
  } catch (err) {
    console.error(`\n❌ Test suite failed in ${testFile}:`, err);
    allPassed = false;
  }
}

if (!allPassed) {
  console.error("\n❌ ONE OR MORE TEST SUITES FAILED.");
  process.exit(1);
} else {
  console.log("\n=========================================");
  console.log("  ALL TEST SUITES PASSED SUCCESSFULLY!   ");
  console.log("=========================================\n");
  process.exit(0);
}
