# Claude Code Integration

## Setup

### 1. Build DiffLoop

```bash
cd /path/to/diffloop
bun install
bun run build
```

### 2. Add Pre-Commit Hook (recommended)

Add DiffLoop as a `PreToolUse` hook in your **global** Claude Code settings (`~/.claude/settings.json`). This intercepts every `git commit` and opens DiffLoop for review.

Add this entry to the `hooks.PreToolUse` array:

```json
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
```

Update the path to your DiffLoop installation.

### How the Hook Works

```
Agent makes changes
        │
        ▼
Agent runs: git commit -m "..."
        │
        ▼
┌─ PreToolUse Hook ──────────────┐
│  DiffLoop opens in browser     │
│  You review diffs              │
│  You add comments              │
│                                │
│  ┌─ Approve ─┐  ┌─ Submit ──┐  ┌─ Save ────┐ │
│  │ exit: allow│  │ exit: deny│  │ exit: save │ │
│  └────────────┘  └───────────┘  └────────────┘ │
└────────────────────────────────────────────────┘
        │                 │                │
        ▼                 ▼                ▼
  Commit proceeds   Commit blocked   Commit deferred
                    Agent sees        State saved
                    feedback          Resume on next
                    Agent fixes       git commit
                    code, retries
```

### Opt-out

To skip DiffLoop for a specific commit:

```bash
DIFFLOOP_SKIP=1 git commit -m "quick fix"
```

Or the agent can set the env var before committing if you tell it to skip review.

### 3. Alternative: Slash Command

You can also use DiffLoop manually via a slash command:

```bash
cp .claude/commands/diffloop.md ~/.claude/commands/diffloop.md
```

Then type `/diffloop` in Claude Code. This approach requires the agent to manage the loop manually.

## How the Review Loop Works

```
Iteration 1                     Iteration 2
───────────                     ───────────
Agent makes changes             Agent fixes code
        │                               │
        ▼                               ▼
  git commit                      git commit
        │                               │
        ▼                               ▼
  Hook → DiffLoop opens          Hook → DiffLoop opens
  User sees diffs                User sees NEW diffs
  User adds comments             User verifies fixes
        │                               │
        ▼                               ▼
  Submit Review                   Approve ──► Commit!
        │
        ▼
  Agent gets feedback
  (commit blocked)
  Agent fixes code
        │
        ▼
  Tries to commit again...
```

State (threads, comments) is preserved between iterations in a project-local `.diffloop/<branch>/state.json` file, isolated per branch.

## What the Agent Receives

### On Submit Review (commit blocked)

The hook blocks the commit with `permissionDecision: "deny"`. The agent receives the feedback as the denial reason:

```
## Code Review Feedback

### Fix Requests
- **src/api.ts:42-44** — Use async/await instead of .then()

### Questions
- **src/utils.ts:10** — Why is this function exported?
```

The agent then:
1. Makes the requested code changes (Fix requests)
2. Can answer questions in the terminal response
3. Tries to commit again → hook fires → DiffLoop opens with new diffs

### On Approve (commit proceeds)

The hook allows the commit with `permissionDecision: "allow"`. The `git commit` command executes normally.

### On Save & Close (commit deferred)

The hook blocks the commit with `permissionDecision: "deny"` and a short message:

```
DiffLoop: Review saved — commit deferred. Resume by running git commit again.
```

No thread feedback is provided. The agent should understand that no code changes are needed. When the user triggers `git commit` again, DiffLoop reopens with the saved threads at the same iteration.

## Tips

- Use **Fix** for concrete change requests — the agent will modify the code
- Use **Question** for understanding — the agent will answer in the terminal
- **Resolve** threads that are done — they won't appear in the feedback
- Write clear, specific comments — the agent sees the full markdown feedback
- Each iteration shows fresh diffs — you can verify fixes were applied
- The hook only fires on `git commit` — other git commands pass through
- Timeout is 30 minutes — plenty of time for review

## Thread Responses

Agent writes responses to `.diffloop/<branch>/responses.json` after fixing code. On the next `git commit`, the hook merges them into the thread history as model messages, visible in the browser UI.
