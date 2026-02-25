# API Reference

## HTTP Endpoints

### `GET /`

Serves the HTML UI page.

**Response:** `text/html` — single-page app with inlined CSS.

### `GET /app.js`

Serves the bundled JavaScript.

**Response:** `application/javascript` — minified Preact bundle.

### `GET /api/diff`

Returns parsed diff data for all changed files.

**Response:**
```json
{
  "files": [
    {
      "filename": "src/app.ts",
      "status": "modified",
      "rawDiff": "diff --git a/src/app.ts b/src/app.ts\n..."
    },
    {
      "filename": "src/new-file.ts",
      "status": "added",
      "rawDiff": "..."
    }
  ],
  "rawUnifiedDiff": "diff --git a/...\n..."
}
```

### `GET /api/state`

Returns the current review state (iteration counter + threads from previous iterations).

**Response:**
```json
{
  "iteration": 1,
  "threads": []
}
```

On iteration 2+ with existing threads:
```json
{
  "iteration": 2,
  "threads": [
    {
      "id": "t_abc123",
      "file": "src/app.ts",
      "line": 42,
      "lines": [42, 43, 44],
      "side": "new",
      "type": "fix",
      "messages": [
        {
          "author": "user",
          "text": "Change variable name to camelCase",
          "timestamp": 1708789200000
        },
        {
          "author": "model",
          "text": "Done. Renamed `my_var` to `myVar` across 3 files.",
          "timestamp": 1708789260000
        }
      ],
      "resolved": false
    }
  ]
}
```

### `POST /api/approve`

User approves the changes. Ends the review loop.

**Request body:** none

**Effect:** Server resolves the decision promise and shuts down. CLI writes to stdout:
```json
{"decision": "allow"}
```

### `POST /api/submit`

User submits review feedback. Agent will process and re-open DiffLoop.

**Request body:**
```json
{
  "feedback": "## Code Review Feedback\n\n### Fix Requests\n- **src/app.ts:42-44** — Rename to camelCase\n\n### Questions\n- **src/utils.ts:10** — Why is this async?\n",
  "state": {
    "iteration": 1,
    "threads": [...]
  }
}
```

**Effect:** Server resolves and shuts down. CLI writes to stdout:
```json
{
  "decision": "deny",
  "feedback": "## Code Review Feedback\n...",
  "state": { "iteration": 1, "threads": [...] }
}
```

---

## CLI Contract

### Stdin

JSON input (optional, `{}` for first iteration):

```typescript
interface StdinInput {
  state?: ReviewState;
  modelResponses?: Array<{
    threadId: string;
    text: string;
  }>;
}
```

### Stdout

JSON decision output:

```typescript
type Decision =
  | { decision: "allow" }
  | { decision: "deny"; feedback: string; state: ReviewState };
```

### Stderr

Informational output (not parsed by Claude Code):

```
  DiffLoop v0.1.0

  URL:       http://localhost:43521
  Iteration: 1
  Files:     3 changed

  Open the URL above in your browser.
  Approve or Submit Review to continue.
```

---

## Data Types

### ReviewState

```typescript
interface ReviewState {
  iteration: number;    // Incremented each cycle
  threads: Thread[];    // All comment threads
}
```

### Thread

```typescript
interface Thread {
  id: string;                // Unique ID (e.g. "t_abc123")
  file: string;              // Filename (e.g. "src/app.ts")
  line: number;              // Primary line number
  endLine?: number;          // End of range (deprecated, use lines)
  lines?: number[];          // Selected lines [42, 43, 44] or [5, 8, 12]
  side: "old" | "new";       // Which side of the diff
  type: CommentType;         // "fix" or "question"
  messages: Message[];       // Conversation history
  resolved: boolean;         // Whether thread is resolved
}
```

### Message

```typescript
interface Message {
  author: "user" | "model";  // Who wrote this message
  text: string;               // Message content
  timestamp: number;          // Unix timestamp (ms)
}
```

### FileDiff

```typescript
interface FileDiff {
  filename: string;
  status: "modified" | "added" | "deleted" | "renamed";
  oldFilename?: string;       // Only for renamed files
  rawDiff: string;            // Raw unified diff text
}
```

### CommentType

```typescript
type CommentType = "fix" | "question";
```

- **fix** — Request a code change. The agent will modify the code.
- **question** — Ask about the code. The agent will reply in the thread.
