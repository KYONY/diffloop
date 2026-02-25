# Architecture

## Overview

DiffLoop is an ephemeral review server. Each invocation is a short-lived process:

1. Read input from stdin
2. Collect git diffs
3. Start HTTP server
4. Wait for user decision
5. Write output to stdout
6. Exit

State flows through stdin/stdout JSON between iterations. Between iterations, state is persisted in `.diffloop/<branch>/state.json` inside the project directory (gitignored), isolated per branch.

## System Diagram

```mermaid
graph TB
    subgraph Terminal
        CC[Claude Code Agent]
    end

    subgraph "DiffLoop Process (ephemeral)"
        CLI[cli.ts<br/>Entry Point]
        DIFF[diff.ts<br/>Git Diff Collector]
        STATE[state.ts<br/>State Builder]
        SRV[index.ts<br/>HTTP Server]
    end

    subgraph Browser
        APP[app.tsx<br/>Root Component]
        DV[DiffView.tsx<br/>Diff + Comments]
        FT[FileTree.tsx<br/>Sidebar]
        TB[Toolbar.tsx<br/>Actions]
    end

    CC -->|"stdin JSON"| CLI
    CLI --> DIFF
    CLI --> STATE
    CLI --> SRV
    SRV -->|"GET /, /app.js"| APP
    SRV -->|"GET /api/diff"| APP
    SRV -->|"GET /api/state"| APP
    APP --> DV
    APP --> FT
    APP --> TB
    TB -->|"POST /api/submit"| SRV
    TB -->|"POST /api/approve"| SRV
    SRV -->|"resolves promise"| CLI
    CLI -->|"stdout JSON"| CC
```

## Review Loop Flow

```mermaid
stateDiagram-v2
    [*] --> Iteration1: echo '{}' | diffloop

    state Iteration1 {
        [*] --> CollectDiffs
        CollectDiffs --> StartServer
        StartServer --> WaitForUser
        WaitForUser --> Submit: Submit Review
        WaitForUser --> Save: Save & Close
        WaitForUser --> Approve: Approve
    }

    Submit --> AgentProcesses: stdout {feedback, state}
    Save --> SaveState: stdout {decision: "save", state}
    SaveState --> [*]: commit deferred, resume on next git commit

    state AgentProcesses {
        [*] --> ReadFeedback
        ReadFeedback --> FixCode: Fix requests
        ReadFeedback --> PrepareAnswers: Questions
        FixCode --> NextIteration
        PrepareAnswers --> NextIteration
    }

    NextIteration --> IterationN: echo '{state, modelResponses}' | diffloop

    state IterationN {
        [*] --> ShowNewDiffs
        ShowNewDiffs --> ShowResponses: Agent answers in threads
        ShowResponses --> UserReviews
        UserReviews --> SubmitAgain: Submit Review
        UserReviews --> SaveN: Save & Close
        UserReviews --> ApproveN: Approve
    }

    SubmitAgain --> AgentProcesses
    SaveN --> SaveState
    Approve --> [*]: stdout {decision: "allow"}
    ApproveN --> [*]: stdout {decision: "allow"}
```

## Component Architecture

```mermaid
graph TD
    APP[App] --> HEADER[Header<br/>Iteration + file count]
    APP --> MAIN[Main Layout]
    APP --> TOOLBAR[Toolbar<br/>Submit / Approve]

    MAIN --> FILETREE[FileTree<br/>Sidebar]
    MAIN --> DIFFVIEW[DiffView<br/>Main content]

    DIFFVIEW --> |inline| CF[CommentForm<br/>New comments]
    DIFFVIEW --> |inline| TE[ThreadEditor<br/>Edit + conversations]
    DIFFVIEW --> |below diff| CT[CommentThread<br/>Thread display]
    CF --> MDT[MarkdownToolbar<br/>Shared toolbar]
    TE --> MDT
    TE --> MT[MessageText<br/>Markdown rendering]

    FILETREE --> |click| DIFFVIEW
    TOOLBAR --> |save| API3["/api/save"]
    TOOLBAR --> |submit| API["/api/submit"]
    TOOLBAR --> |approve| API2["/api/approve"]

    style APP fill:#161b22,stroke:#58a6ff,color:#c9d1d9
    style DIFFVIEW fill:#161b22,stroke:#3fb950,color:#c9d1d9
    style FILETREE fill:#161b22,stroke:#d29922,color:#c9d1d9
    style TOOLBAR fill:#161b22,stroke:#f85149,color:#c9d1d9
```

## Data Flow

### Stdin → State

```
StdinInput {
  state?: ReviewState        ← previous iteration's state
  modelResponses?: [{        ← agent's answers to questions
    threadId, text
  }]
}
        │
        ▼
  buildState()
        │
        ▼
ReviewState {
  iteration: N+1             ← incremented
  threads: [                 ← preserved + responses applied
    Thread { messages: [..., {author: "model", text}] }
  ]
}
```

### State → Stdout

```
User clicks Submit Review
        │
        ▼
  formatFeedback(state)
        │
        ▼
Decision {
  decision: "deny"
  feedback: "## Fix Requests\n- **file:42** — change X to Y\n..."
  state: ReviewState         ← for next iteration
}
        │
        ▼
  stdout JSON → Claude Code reads and processes
```

## Git Diff Collection

```mermaid
graph LR
    A["git diff"] --> COMBINE
    B["git diff --staged"] --> COMBINE
    C["git ls-files --others"] --> D["git diff --no-index<br/>per file"]
    D --> COMBINE
    COMBINE[Combine] --> PARSE["parseDiffFiles()"]
    PARSE --> OUT["DiffData {files, rawUnifiedDiff}"]
```

Three sources of changes are collected in parallel:
1. **Unstaged** — `git diff`
2. **Staged** — `git diff --staged`
3. **Untracked** — `git ls-files --others` → `git diff --no-index -- /dev/null <file>`

## Thread Lifecycle

```
Create (click line → fill form → submit)
  │
  ├── Type: "fix" → Agent makes code changes
  │   └── On next iteration: user sees new diff, can verify fix
  │
  └── Type: "question" → Agent prepares answer
      └── On next iteration: model response appears in thread
          └── User can reply → new iteration → agent responds again

Edit (click 💬 indicator → ThreadEditor)
  ├── Change text
  ├── Change type (fix ↔ question)
  └── Delete

Resolve (click Resolve in thread)
  └── Thread hidden from feedback, appears dimmed
      └── Can be reopened (Unresolve)
```

## Line Selection Model

```
                    ┌─────────────────────┐
                    │  CommentTarget      │
                    │  {                  │
                    │    file: string     │
                    │    lines: number[]  │
                    │    side: "old"|"new"│
                    │  }                  │
                    └─────────────────────┘
                              ▲
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    Click (single)      Shift+click          Ctrl+click
    lines: [42]         (range)              (toggle)
                        lines: [42..50]      lines: [42, 45, 48]
                              │
                              │
                        Drag (mousedown
                        → mouseenter
                        → mouseup)
                        lines: [42..50]
```

## Build Pipeline

```
src/ui/app.tsx ──► Bun.build() ──► dist/app.js (minified ESM)
                                        │
src/ui/styles.css ──────────────────────┤
diff2html.min.css ──────────────────────┤
                                        ▼
                                  dist/index.html
                                  (CSS inlined, JS external)
```

The build produces two files:
- `dist/index.html` — HTML shell with all CSS inlined
- `dist/app.js` — minified Preact bundle

The server serves both: HTML on `/`, JS on `/app.js`.
