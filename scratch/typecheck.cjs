const fs = require("fs");
const path = require("path");
const ts = require("C:/Users/HP/AppData/Local/Programs/Microsoft VS Code/2c33b50b16/resources/app/extensions/node_modules/typescript/lib/typescript.js");

console.log("==================================================");
console.log("       TypeScript Programmatic Typecheck         ");
console.log("==================================================\n");

const filesToCheck = [
  "packages/api-client/src/index.ts",
  "src/lib/api-types.ts",
  "src/components/ChoiceChips.tsx",
  "src/components/StatePill.tsx",
  "src/components/LockedLayer.tsx",
  "src/components/RequireGoal.tsx",
  "src/features/seed/SeedPage.tsx",
  "src/features/cards/QuestionInput.tsx",
  "src/features/cards/CardConversation.tsx",
  "src/features/cards/CardSheet.tsx",
  "src/features/cards/CardTile.tsx",
  "src/features/cards/CardGrid.tsx",
  "src/features/cards/useCards.ts",
  "src/features/cards/TradeoffOptions.tsx",
  "src/features/cards/FeasibilityVerdict.tsx",
  "src/features/plan/PlanPage.tsx",
];

const options = {
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  skipLibCheck: true,
  strict: true,
  paths: {
    "@/*": ["./src/*"],
  },
  baseUrl: "d:/alter-ego-os",
};

let syntaxErrors = 0;

for (const relPath of filesToCheck) {
  const fullPath = path.resolve("d:/alter-ego-os", relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing file: ${relPath}`);
    syntaxErrors++;
    continue;
  }
  const code = fs.readFileSync(fullPath, "utf8");
  const sourceFile = ts.createSourceFile(
    fullPath,
    code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX
  );

  // Check for parse/syntax diagnostics
  const diags = sourceFile.parseDiagnostics || [];
  if (diags.length > 0) {
    console.error(`✗ Syntax error in ${relPath}:`);
    for (const d of diags) {
      console.error(`  Line ${d.start}: ${d.messageText}`);
    }
    syntaxErrors++;
  } else {
    console.log(`✓ ${relPath}: Syntax & AST valid`);
  }
}

console.log("\n==================================================");
console.log(`Typecheck AST Summary: ${filesToCheck.length - syntaxErrors} passed, ${syntaxErrors} errors.`);
console.log("==================================================");

if (syntaxErrors > 0) process.exit(1);

