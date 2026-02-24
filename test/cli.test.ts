import { describe, expect, test } from "bun:test";
import { buildState } from "../src/shared/state.ts";

describe("buildState", () => {
  test("first iteration — empty input", () => {
    const state = buildState({});
    expect(state.iteration).toBe(1);
    expect(state.threads).toEqual([]);
  });

  test("increments iteration from previous state", () => {
    const state = buildState({
      state: { iteration: 3, threads: [] },
    });
    expect(state.iteration).toBe(4);
  });

  test("preserves existing threads", () => {
    const threads = [
      {
        id: "t1",
        file: "foo.ts",
        line: 10,
        side: "new" as const,
        type: "fix" as const,
        messages: [
          { author: "user" as const, text: "fix this", timestamp: 1000 },
        ],
        resolved: false,
      },
    ];
    const state = buildState({
      state: { iteration: 1, threads },
    });
    expect(state.threads).toHaveLength(1);
    expect(state.threads[0]!.id).toBe("t1");
  });

  test("applies model responses to matching threads", () => {
    const threads = [
      {
        id: "t1",
        file: "foo.ts",
        line: 10,
        side: "new" as const,
        type: "question" as const,
        messages: [
          { author: "user" as const, text: "why async?", timestamp: 1000 },
        ],
        resolved: false,
      },
    ];
    const state = buildState({
      state: { iteration: 1, threads },
      modelResponses: [
        { threadId: "t1", text: "Because it calls an API" },
      ],
    });
    expect(state.threads[0]!.messages).toHaveLength(2);
    expect(state.threads[0]!.messages[1]!.author).toBe("model");
    expect(state.threads[0]!.messages[1]!.text).toBe("Because it calls an API");
  });

  test("ignores model responses for unknown threads", () => {
    const state = buildState({
      state: { iteration: 1, threads: [] },
      modelResponses: [
        { threadId: "nonexistent", text: "hello" },
      ],
    });
    expect(state.threads).toHaveLength(0);
  });
});
