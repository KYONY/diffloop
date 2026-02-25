# DiffLoop

![DiffLoop](DiffLoop.png)

> Interactive code review UI for AI agents in Claude Code

**Bun 1.3+** | **Preact** | **diff2html** | **33 tests passing**

---

DiffLoop opens a browser-based diff viewer where you can leave inline comments on code changes made by an AI agent. The agent reads your feedback, fixes the code, answers questions, and re-opens DiffLoop — creating a review loop until you approve.

Think of it as a **local GitLab MR review** — but for your terminal AI workflow.

## How It Works

![Review Loop](docs/images/review-loop.svg)

```
Agent makes changes → tries to commit
        ↓
  Hook intercepts → DiffLoop opens in browser
        ↓
  You review diffs, leave comments (Fix / Question)
        ↓
  ┌── Submit Review ──→ Commit blocked, agent gets feedback
  │                      Agent fixes code, tries to commit again
  │                      Hook fires again → you see new diffs
  │                      Loop until satisfied
  │
  └── Approve ─────────→ Commit proceeds
```

## Features

- **Pre-commit hook** — automatically opens on `git commit`, blocks until approved
- **Inline comments** — click any line number to add a Fix request or Question
- **Multi-line selection** — drag, Shift+click (range), Ctrl+click (toggle individual lines)
- **Side-by-side & unified** diff view modes
- **File tree sidebar** — navigate files, see comment badges per file
- **Review loop** — submit feedback → agent fixes → re-review → approve
- **Edit & delete** — click any comment indicator to modify or remove
- **File collapse** — click file headers, comment badges on collapsed files
- **Dark theme** — GitHub-dark inspired, easy on the eyes
- **Zero config** — ephemeral server, no database

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.3+

### Install & Build

```bash
git clone <repo-url> && cd diffloop
bun install
bun run build
```

### Run Standalone

```bash
echo '{}' | bun src/cli.ts
```

Opens browser at `http://localhost:<random-port>` with diffs of your current git changes.

### Integrate with Claude Code

Add DiffLoop as a pre-commit hook in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^Bash$",
        "hooks": [
          {
            "type": "command",
            "command": "/bin/bash /path/to/diffloop/scripts/pre-commit-hook.sh",
            "timeout": 1800
          }
        ]
      }
    ]
  }
}
```

Now every `git commit` by the agent triggers a code review. See [docs/integration.md](docs/integration.md) for details.

## Usage

### Leaving Comments

![Line Selection](docs/images/line-selection.svg)

| Action | Effect |
|--------|--------|
| Click line number | Select single line |
| Drag across line numbers | Select range |
| Shift+click | Extend selection to range |
| Ctrl+click | Toggle individual lines |

After selecting, choose comment type:

![Comment Types](docs/images/comment-types.svg)

- **Fix** — request a code change (agent will modify the code)
- **Question** — ask about the code (agent will reply in the terminal)

### Review Actions

| Button | What happens |
|--------|-------------|
| **Submit Review** | Sends feedback to the agent. Agent processes fixes, then re-opens DiffLoop |
| **Approve** | Ends the review loop. Commit proceeds |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Enter` | Submit comment / Save edit |
| `Esc` | Cancel comment / Close editor |

## Architecture

```
┌─────────────┐     stdin (JSON)      ┌──────────────┐
│ Claude Code  │ ──────────────────▶  │  DiffLoop    │
│  (terminal)  │                      │  CLI + Server │
│              │ ◀──────────────────  │              │
└─────────────┘     stdout (JSON)     └──────┬───────┘
                                             │ HTTP
                                      ┌──────▼───────┐
                                      │   Browser UI  │
                                      │  (Preact app) │
                                      └──────────────┘
```

See [docs/architecture.md](docs/architecture.md) for details.

## Project Structure

```
diffloop/
├── src/
│   ├── cli.ts                 # Entry point: stdin → server → stdout
│   ├── server/
│   │   ├── index.ts           # HTTP server + API endpoints
│   │   └── diff.ts            # Git diff collection & parsing
│   ├── shared/
│   │   ├── types.ts           # TypeScript interfaces
│   │   └── state.ts           # State management between iterations
│   └── ui/
│       ├── app.tsx            # Root Preact component
│       ├── styles.css         # Dark theme styles
│       └── components/
│           ├── DiffView.tsx   # Diff viewer + inline comments
│           ├── FileTree.tsx   # Sidebar file navigator
│           ├── Toolbar.tsx    # Submit / Approve buttons
│           ├── CommentForm.tsx
│           ├── CommentThread.tsx
│           └── ThreadEditor.tsx
├── test/                      # 33 tests across 5 files
├── scripts/
│   └── pre-commit-hook.sh     # PreToolUse hook for Claude Code
├── build.ts                   # Bundles UI → dist/
├── dist/                      # Built output (HTML + JS)
└── .claude/commands/
    └── diffloop.md            # Slash command (alternative)
```

## API Reference

See [docs/api.md](docs/api.md) for the full HTTP API and data types.

## Development

```bash
# Run tests
bun test

# Build UI
bun run build

# Run dev (start server directly)
bun run dev
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript (strict) |
| UI | [Preact](https://preactjs.com) |
| Diff rendering | [diff2html](https://diff2html.xyz) |
| Testing | bun:test + [happy-dom](https://github.com/nicedoc/happy-dom) |
| Build | Bun bundler (single-pass) |

## License

MIT
