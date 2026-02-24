#!/usr/bin/env bun

import { join } from "path";
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
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";
  Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
}

async function main(): Promise<void> {
  const input = await readStdin();
  const state = buildState(input);
  const diffData = await collectDiffs();

  // Try to load built HTML
  let htmlContent: string | undefined;
  const distPath = join(import.meta.dir, "..", "dist", "index.html");
  const distFile = Bun.file(distPath);
  if (await distFile.exists()) {
    htmlContent = await distFile.text();
  }

  const { server, waitForDecision } = createServer({
    diffData,
    state,
    htmlContent,
  });

  const url = `http://localhost:${server.port}`;
  console.error(`diffloop v0.1.0 — ${url}`);
  console.error(
    `Iteration ${state.iteration} | ${diffData.files.length} file(s) changed`
  );

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
