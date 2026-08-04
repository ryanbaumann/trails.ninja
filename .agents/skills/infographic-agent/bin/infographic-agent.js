#!/usr/bin/env node
/**
 * infographic-agent CLI
 *
 * Thin Node.js shim that delegates to `portable_infographic.py`, which is
 * bundled in this npm package. Node is only used here because npm/npx needs a
 * JS entry-point; all the heavy lifting (the two Gemini agents that research
 * and render the infographic) lives in the Python script.
 *
 * The ONLY runtime dependency is Google's GenAI SDK — there is no browser,
 * Playwright, or Chromium download.
 *
 * Usage (via npx):
 *   npx infographic-agent "Top 5 programming languages in 2026"
 *
 * First-time setup:
 *   npx infographic-agent --install   # pip install google-genai pillow
 *   # then just run it — the CLI walks you through getting a free API key.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "../portable_infographic.py");
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));

// ─── Helpers ────────────────────────────────────────────────────────────────

function print(msg) {
  process.stdout.write(msg + "\n");
}

function err(msg) {
  process.stderr.write("[infographic-agent] " + msg + "\n");
}

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "inherit" });
}

// ─── Resolve Python interpreter ─────────────────────────────────────────────

function findPython() {
  for (const candidate of ["python3", "python"]) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) {
      const match = (result.stdout + result.stderr).match(/Python (\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major >= 3 && minor >= 9) return candidate;
      }
    }
  }
  return null;
}

// ─── Pre-flight checks ───────────────────────────────────────────────────────

if (!existsSync(scriptPath)) {
  err(
    `Could not find portable_infographic.py at: ${scriptPath}\n` +
    "  This is a packaging bug — please open an issue at\n" +
    "  https://github.com/ryanbaumann/infographic-agent/issues"
  );
  process.exit(1);
}

const python = findPython();

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const doInstall = args.includes("--install");

// ─── --help ──────────────────────────────────────────────────────────────────

if (showHelp) {
  print(`
infographic-agent v${pkg.version}

Generate a professional infographic PNG directly with Gemini: a research
agent (gemini-3.5-flash) prepares and validates the prompt, then the image
model (gemini-3.1-flash-lite-image) renders it. No browser or Playwright needed.

Usage:
  npx infographic-agent "<topic>" [options]

Options:
  --text <string>        Content to visualize (alternative to the positional topic)
  --output, -o <path>    Output PNG path (default: infographic.png)
  --mode, -m <mode>      data-story | executive-summary | technical-deep-dive |
                         classroom | quick-slide | custom  (default: data-story)
  --aspect, -a <ratio>   1:1 | 9:16 | 16:9 | 3:4 | 4:3 | 1:4  (default: 9:16)
  --instructions, -i     Extra styling / content instructions
  --no-research          Skip the research agent; generate straight from your text
  --no-open              Do not auto-open the result
  --yes, -y              Non-interactive: generate once and exit (no refine loop)
  --setup                (Re)configure your free Gemini API key and exit
  --install              Install Python dependencies (google-genai, pillow)
  --help, -h             Show this help message

Getting started (a free key takes ~20 seconds):
  npx infographic-agent --install
  npx infographic-agent "Top 5 programming languages in 2026"
  # → the CLI walks you through grabbing a free key from Google AI Studio.

Examples:
  npx infographic-agent "Q2 sales highlights" -o sales.png -m executive-summary
  npx infographic-agent --text "$(cat report.txt)" -a 16:9
`.trim());
  process.exit(0);
}

// ─── Require Python from here on ─────────────────────────────────────────────

if (!python) {
  err(
    "Python 3.9+ is required but was not found on your PATH.\n\n" +
    "  Install Python from https://www.python.org/downloads/ and make sure\n" +
    "  it is on your PATH, then re-run:\n\n" +
    "    npx infographic-agent ..."
  );
  process.exit(1);
}

// ─── --install: first-time dependency setup ─────────────────────────────────

if (doInstall) {
  print("Installing Python dependencies (google-genai, pillow)...");
  const result = run(python, ["-m", "pip", "install", "--upgrade", "google-genai>=1.47.0", "pillow"]);
  if (result.status !== 0) process.exit(result.status);

  print(`
✓ Setup complete!

  Generate your first infographic (the CLI will help you get a free API key):

    npx infographic-agent "Top 5 programming languages in 2026"
`.trim());
  process.exit(0);
}

// ─── Delegate to Python script ───────────────────────────────────────────────

const result = run(python, [scriptPath, ...args]);
process.exit(typeof result.status === "number" ? result.status : 1);
