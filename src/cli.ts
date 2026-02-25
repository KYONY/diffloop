#!/usr/bin/env bun

import { join, basename } from "path";
import { collectDiffs } from "./server/diff.ts";
import { createServer } from "./server/index.ts";
import { buildState } from "./shared/state.ts";
import type { StdinInput } from "./shared/types.ts";

async function readStdin(): Promise<StdinInput> {
  try {
    const text = await new Response(Bun.stdin.stream()).text();
    if (!text.trim()) return {};
    return JSON.parse(text) as StdinInput;
  } catch {
    return {};
  }
}

function openBrowser(url: string): void {
  if (process.env.DIFFLOOP_NO_BROWSER) return;

  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";

  try {
    const proc = Bun.spawn([cmd, url], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    // Consume and discard all output
    proc.stdout.pipeTo(new WritableStream());
    proc.stderr.pipeTo(new WritableStream());
  } catch {
    // Browser failed to open, user will use the URL manually
  }
}

async function getGitBranch(): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    return text.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const input = await readStdin();
  const state = buildState(input);
  const diffData = await collectDiffs();
  const branch = await getGitBranch();
  const project = basename(process.cwd());

  // Try to load built assets
  let htmlContent: string | undefined;
  let jsContent: string | undefined;
  const distDir = join(import.meta.dir, "..", "dist");

  const htmlFile = Bun.file(join(distDir, "index.html"));
  if (await htmlFile.exists()) {
    htmlContent = await htmlFile.text();
  }

  const jsFile = Bun.file(join(distDir, "app.js"));
  if (await jsFile.exists()) {
    jsContent = await jsFile.text();
  }

  const { server, waitForDecision } = createServer({
    diffData,
    state,
    branch,
    project,
    htmlContent,
    jsContent,
  });

  const url = `http://localhost:${server.port}`;
  console.error(`\n  DiffLoop v0.1.0\n`);
  console.error(`  URL:       ${url}`);
  console.error(`  Iteration: ${state.iteration}`);
  console.error(`  Files:     ${diffData.files.length} changed`);
  console.error(`\n  Open the URL above in your browser.`);
  console.error(`  Approve or Submit Review to continue.\n`);

  openBrowser(url);

  const decision = await waitForDecision();

  server.stop();

  // Write decision to stdout for Claude Code
  process.stdout.write(JSON.stringify(decision));
}

main().catch((err) => {
  console.error("diffloop error:", err);
  process.exit(1);
});
