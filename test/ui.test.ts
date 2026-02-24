import { describe, expect, test } from "bun:test";
import type { ReviewState, Thread } from "../src/shared/types.ts";

// Test the comment state management logic (same logic as in DiffView + Toolbar)

function addThread(state: ReviewState, thread: Thread): ReviewState {
  return { ...state, threads: [...state.threads, thread] };
}

function resolveThread(state: ReviewState, id: string): ReviewState {
  return {
    ...state,
    threads: state.threads.map((t) =>
      t.id === id ? { ...t, resolved: true } : t
    ),
  };
}

function unresolveThread(state: ReviewState, id: string): ReviewState {
  return {
    ...state,
    threads: state.threads.map((t) =>
      t.id === id ? { ...t, resolved: false } : t
    ),
  };
}

function formatFeedback(state: ReviewState): string {
  const open = state.threads.filter((t) => !t.resolved);
  if (open.length === 0) return "No comments.";

  const fixes = open.filter((t) => t.type === "fix");
  const questions = open.filter((t) => t.type === "question");

  let md = "## Code Review Feedback\n\n";

  if (fixes.length > 0) {
    md += "### Fix Requests\n";
    for (const t of fixes) {
      const lastMsg = t.messages[t.messages.length - 1];
      md += `- **${t.file}:${t.line}** — ${lastMsg?.text ?? ""}\n`;
    }
    md += "\n";
  }

  if (questions.length > 0) {
    md += "### Questions\n";
    for (const t of questions) {
      const lastMsg = t.messages[t.messages.length - 1];
      md += `- **${t.file}:${t.line}** — ${lastMsg?.text ?? ""}\n`;
    }
    md += "\n";
  }

  return md;
}

const baseState: ReviewState = { iteration: 1, threads: [] };

const sampleThread: Thread = {
  id: "t1",
  file: "src/foo.ts",
  line: 42,
  side: "new",
  type: "fix",
  messages: [{ author: "user", text: "rename this variable", timestamp: 1000 }],
  resolved: false,
};

describe("comment state management", () => {
  test("add thread to empty state", () => {
    const next = addThread(baseState, sampleThread);
    expect(next.threads).toHaveLength(1);
    expect(next.threads[0]!.id).toBe("t1");
  });

  test("add multiple threads", () => {
    let s = addThread(baseState, sampleThread);
    s = addThread(s, { ...sampleThread, id: "t2", line: 50 });
    expect(s.threads).toHaveLength(2);
  });

  test("resolve thread", () => {
    const s = addThread(baseState, sampleThread);
    const resolved = resolveThread(s, "t1");
    expect(resolved.threads[0]!.resolved).toBe(true);
  });

  test("unresolve thread", () => {
    let s = addThread(baseState, sampleThread);
    s = resolveThread(s, "t1");
    s = unresolveThread(s, "t1");
    expect(s.threads[0]!.resolved).toBe(false);
  });

  test("resolve non-existent thread does nothing", () => {
    const s = addThread(baseState, sampleThread);
    const same = resolveThread(s, "nonexistent");
    expect(same.threads[0]!.resolved).toBe(false);
  });

  test("does not mutate original state", () => {
    const s = addThread(baseState, sampleThread);
    resolveThread(s, "t1");
    expect(s.threads[0]!.resolved).toBe(false);
  });
});

describe("formatFeedback", () => {
  test("empty state returns no comments", () => {
    expect(formatFeedback(baseState)).toBe("No comments.");
  });

  test("only resolved threads returns no comments", () => {
    const s = addThread(baseState, { ...sampleThread, resolved: true });
    expect(formatFeedback(s)).toBe("No comments.");
  });

  test("formats fix requests", () => {
    const s = addThread(baseState, sampleThread);
    const fb = formatFeedback(s);
    expect(fb).toContain("### Fix Requests");
    expect(fb).toContain("**src/foo.ts:42** — rename this variable");
  });

  test("formats questions", () => {
    const s = addThread(baseState, {
      ...sampleThread,
      id: "t2",
      type: "question",
      messages: [{ author: "user", text: "why is this async?", timestamp: 1000 }],
    });
    const fb = formatFeedback(s);
    expect(fb).toContain("### Questions");
    expect(fb).toContain("**src/foo.ts:42** — why is this async?");
  });

  test("formats mixed fix + question", () => {
    let s = addThread(baseState, sampleThread);
    s = addThread(s, {
      ...sampleThread,
      id: "t2",
      type: "question",
      line: 10,
      messages: [{ author: "user", text: "explain this", timestamp: 1000 }],
    });
    const fb = formatFeedback(s);
    expect(fb).toContain("### Fix Requests");
    expect(fb).toContain("### Questions");
  });

  test("ignores resolved threads in feedback", () => {
    let s = addThread(baseState, sampleThread);
    s = addThread(s, {
      ...sampleThread,
      id: "t2",
      line: 50,
      resolved: true,
    });
    const fb = formatFeedback(s);
    expect(fb).toContain("src/foo.ts:42");
    expect(fb).not.toContain("src/foo.ts:50");
  });
});
