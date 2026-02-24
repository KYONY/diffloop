# diffloop — Implementation Plan

## Overview

diffloop — interactive code review tool for Claude Code. Shows diffs in browser, allows inline comments (fix requests + questions), loops until approved.

## Architecture

```
/diffloop slash command → PermissionRequest hook → Bun process
  → reads stdin (previous state) → collects git diffs → starts HTTP server
  → opens browser → user reviews + comments → Submit/Approve
  → writes stdout (feedback + state) → process exits
  → Claude Code processes feedback → hook fires again (loop)
```

## Steps

### Step 1: Project init + shared types — DONE
- [x] bun init, package.json (bin: diffloop), tsconfig (Preact JSX)
- [x] Install: preact, diff2html, happy-dom (dev)
- [x] `src/shared/types.ts` — ReviewState, Thread, Comment, FileDiff, Decision

### Step 2: Git diff collection — DONE
- [x] `src/server/diff.ts` — collectDiffs() via git diff + git diff --staged
- [x] `test/diff.test.ts` — 6 tests (parsing, empty, multiple files, new/deleted/renamed)

### Step 3: HTTP server + CLI entry — DONE
- [x] `src/server/index.ts` — Bun HTTP server (GET /, /api/diff, /api/state, POST /api/approve, /api/submit)
- [x] `src/cli.ts` — read stdin, collect diffs, start server, open browser, wait, write stdout
- [x] `test/server.test.ts` — 6 tests (endpoints, approve, submit, 404)
- [x] `test/cli.test.ts` — 5 tests (buildState, iteration, model responses)

### Step 4: UI — diff rendering — DONE
- [x] `src/ui/index.html` — HTML shell
- [x] `src/ui/app.tsx` — root Preact component, fetch /api/diff, render diff2html
- [x] `src/ui/components/DiffView.tsx` — diff2html wrapper, side-by-side/unified toggle
- [x] `src/ui/styles.css` — dark theme, diff2html overrides

### Step 5: UI — inline comments + threads — DONE
- [x] `src/ui/components/CommentForm.tsx` — textarea, type (fix/question), submit
- [x] `src/ui/components/CommentThread.tsx` — thread display, resolve, message chain
- [x] `src/ui/components/Toolbar.tsx` — Submit Review / Approve, counters
- [x] Clickable "+" zones on diff lines
- [x] `test/ui.test.ts` — 12 tests (state management, formatFeedback)

### Step 6: Build script — single HTML — DONE
- [x] `build.ts` — bundles to dist/index.html (114 KB)
- [x] Server serves bundled file when available

### Step 7: State persistence between iterations — DONE
- [x] `src/shared/state.ts` — buildState, formatFeedback (extracted from cli.ts)
- [x] `test/state.test.ts` — 4 tests (multi-iteration, resolved threads, message history)

### Step 8: Hook config + slash command — DONE
- [x] `hooks/hooks.json` — PermissionRequest hook config
- [x] `.claude/commands/diffloop.md` — slash command prompt

## Test Summary

**33 tests, 81 assertions, 0 failures** across 5 test files.

## Tech Stack

| Component | Choice |
|-----------|--------|
| Runtime | Bun 1.3+ |
| Language | TypeScript |
| UI | Preact |
| Diff render | diff2html |
| Testing | bun:test + happy-dom |
