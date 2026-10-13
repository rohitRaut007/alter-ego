// Regenerates the OpenAPI schema from Django and the typed client from it.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const api = join(root, "apps", "api");
const venvPy = join(api, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.PYTHON ?? (existsSync(venvPy) ? venvPy : "python");
const out = join(root, "packages", "api-client", "openapi.yaml");

execFileSync(python, ["manage.py", "spectacular", "--file", out, "--validate", "--fail-on-warn"], {
  cwd: api,
  stdio: "inherit",
  env: {
    DJANGO_SECRET_KEY: "schema-generation-only",
    DATABASE_URL: "sqlite:///:memory:",
    // Schema generation never touches data; this key is a throwaway.
    FIELD_ENCRYPTION_KEYS: "schema:MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    ...process.env,
  },
});
execFileSync("pnpm", ["--filter", "@alter-ego/api-client", "run", "generate"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
