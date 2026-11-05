const fs = require("fs");
const path = require("path");
const ts = require("typescript");

console.log("==================================================");
console.log("    TypeScript Full Semantic Compiler Check       ");
console.log("==================================================\n");

const rootDir = process.cwd();
const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");

if (!configPath) {
  console.error("Could not find tsconfig.json");
  process.exit(1);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);

const program = ts.createProgram({
  rootNames: parsedConfig.fileNames,
  options: {
    ...parsedConfig.options,
    noEmit: true,
  },
});

const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length > 0) {
  console.error(`Found ${diagnostics.length} type errors:\n`);
  for (const diag of diagnostics) {
    const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
    if (diag.file && diag.start !== undefined) {
      const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
      const relFile = path.relative(rootDir, diag.file.fileName);
      console.error(`${relFile}(${line + 1},${character + 1}): error TS${diag.code}: ${message}`);
    } else {
      console.error(`Error: ${message}`);
    }
  }
  process.exit(1);
} else {
  console.log(`[PASS] Full semantic typecheck succeeded with 0 errors across ${parsedConfig.fileNames.length} files.`);
  process.exit(0);
}
