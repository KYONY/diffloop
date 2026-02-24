import { describe, expect, test } from "bun:test";
import { buildState, formatFeedback } from "../src/shared/state.ts";
import type { ReviewState, Thread } from "../src/shared/types.ts";

describe("state persistence between iterations", () => {
  test("iteration 1 → submit → iteration 2 preserves threads", () => {
    // Iteration 1: user creates threads
    const iter1 = buildState({});
    expect(iter1.iteration).toBe(1);

    // User adds threads during review (simulated)
    const withThreads: ReviewState = {
      ...iter1,
      threads: [
        {
          id: "t1",
          file: "src/app.ts",
          line: 10,
          side: "new",
          type: "fix",
          messages: [
            { author: "user", text: "rename variable", timestamp: 1000 },
          ],
          resolved: false,
        },
        {
          id: "t2",
          file: "src/app.ts",
          line: 20,
          side: "new",
          type: "question",
          messages: [
            { author: "user", text: "why is this needed?", timestamp: 1001 },
          ],
          resolved: false,
        },
      ],
    };

    // Submit sends state back. Iteration 2: model responds
    const iter2 = buildState({
      state: withThreads,
      modelResponses: [
        { threadId: "t1", text: "Done, renamed to userId" },
        { threadId: "t2", text: "It handles edge cases for null input" },
      ],
    });

    expect(iter2.iteration).toBe(2);
    expect(iter2.threads).toHaveLength(2);

    // Thread t1 has model response
    const t1 = iter2.threads.find((t) => t.id === "t1")!;
    expect(t1.messages).toHaveLength(2);
    expect(t1.messages[1]!.author).toBe("model");
    expect(t1.messages[1]!.text).toBe("Done, renamed to userId");

    // Thread t2 has model response
    const t2 = iter2.threads.find((t) => t.id === "t2")!;
    expect(t2.messages).toHaveLength(2);
    expect(t2.messages[1]!.author).toBe("model");
  });

  test("resolved threads survive iterations", () => {
    const state: ReviewState = {
      iteration: 2,
      threads: [
        {
          id: "t1",
          file: "foo.ts",
          line: 5,
          side: "new",
          type: "fix",
          messages: [{ author: "user", text: "fix", timestamp: 1000 }],
          resolved: true,
        },
        {
          id: "t2",
          file: "bar.ts",
          line: 10,
          side: "new",
          type: "question",
          messages: [{ author: "user", text: "why?", timestamp: 1001 }],
          resolved: false,
        },
      ],
    };

    const iter3 = buildState({ state });
    expect(iter3.iteration).toBe(3);
    expect(iter3.threads[0]!.resolved).toBe(true);
    expect(iter3.threads[1]!.resolved).toBe(false);
  });

  test("multi-message threads preserve full history", () => {
    const state: ReviewState = {
      iteration: 2,
      threads: [
        {
          id: "t1",
          file: "foo.ts",
          line: 5,
          side: "new",
          type: "question",
          messages: [
            { author: "user", text: "why async?", timestamp: 1000 },
            { author: "model", text: "because API call", timestamp: 2000 },
          ],
          resolved: false,
        },
      ],
    };

    // User continues the conversation in iteration 3
    const iter3 = buildState({
      state: {
        ...state,
        threads: [
          {
            ...state.threads[0]!,
            messages: [
              ...state.threads[0]!.messages,
              {
                author: "user" as const,
                text: "can we make it sync?",
                timestamp: 3000,
              },
            ],
          },
        ],
      },
      modelResponses: [
        { threadId: "t1", text: "No, the API requires async" },
      ],
    });

    const t1 = iter3.threads[0]!;
    expect(t1.messages).toHaveLength(4);
    expect(t1.messages[0]!.text).toBe("why async?");
    expect(t1.messages[1]!.text).toBe("because API call");
    expect(t1.messages[2]!.text).toBe("can we make it sync?");
    expect(t1.messages[3]!.text).toBe("No, the API requires async");
  });
});

describe("formatFeedback for Claude Code", () => {
  test("produces structured markdown", () => {
    const state: ReviewState = {
      iteration: 1,
      threads: [
        {
          id: "t1",
          file: "src/app.ts",
          line: 42,
          side: "new",
          type: "fix",
          messages: [
            { author: "user", text: "rename foo to userId", timestamp: 1000 },
          ],
          resolved: false,
        },
        {
          id: "t2",
          file: "src/utils.ts",
          line: 15,
          side: "new",
          type: "question",
          messages: [
            { author: "user", text: "is this thread-safe?", timestamp: 1001 },
          ],
          resolved: false,
        },
        {
          id: "t3",
          file: "src/old.ts",
          line: 1,
          side: "new",
          type: "fix",
          messages: [
            { author: "user", text: "resolved already", timestamp: 999 },
          ],
          resolved: true,
        },
      ],
    };

    const fb = formatFeedback(state);
    expect(fb).toContain("## Code Review Feedback");
    expect(fb).toContain("### Fix Requests");
    expect(fb).toContain("**src/app.ts:42** — rename foo to userId");
    expect(fb).toContain("### Questions");
    expect(fb).toContain("**src/utils.ts:15** — is this thread-safe?");
    // Resolved thread excluded
    expect(fb).not.toContain("src/old.ts");
  });
});
