import { describe, expect, test, afterEach } from "bun:test";
import { createServer } from "../src/server/index.ts";
import type { DiffData, ReviewState } from "../src/shared/types.ts";

const mockDiff: DiffData = {
  files: [
    {
      filename: "src/foo.ts",
      status: "modified",
      rawDiff: "diff --git a/src/foo.ts b/src/foo.ts\n-old\n+new",
    },
  ],
  rawUnifiedDiff: "diff --git a/src/foo.ts b/src/foo.ts\n-old\n+new",
};

const mockState: ReviewState = {
  iteration: 1,
  threads: [],
};

let server: ReturnType<typeof Bun.serve> | null = null;

afterEach(() => {
  server?.stop();
  server = null;
});

function setup(state?: ReviewState) {
  const result = createServer({
    diffData: mockDiff,
    state: state ?? mockState,
  });
  server = result.server;
  return result;
}

describe("HTTP server", () => {
  test("GET / returns HTML", async () => {
    const { server: s } = setup();
    const res = await fetch(`http://localhost:${s.port}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("diffloop");
  });

  test("GET /api/diff returns diff data", async () => {
    const { server: s } = setup();
    const res = await fetch(`http://localhost:${s.port}/api/diff`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files).toHaveLength(1);
    expect(data.files[0].filename).toBe("src/foo.ts");
    expect(data.rawUnifiedDiff).toContain("-old");
  });

  test("GET /api/state returns review state", async () => {
    const state: ReviewState = {
      iteration: 2,
      threads: [
        {
          id: "t1",
          file: "foo.ts",
          line: 10,
          side: "new",
          type: "fix",
          messages: [{ author: "user", text: "fix this", timestamp: 1000 }],
          resolved: false,
        },
      ],
    };
    const { server: s } = setup(state);
    const res = await fetch(`http://localhost:${s.port}/api/state`);
    const data = await res.json();
    expect(data.iteration).toBe(2);
    expect(data.threads).toHaveLength(1);
    expect(data.threads[0].id).toBe("t1");
  });

  test("POST /api/approve resolves with allow", async () => {
    const { server: s, waitForDecision } = setup();
    const res = await fetch(`http://localhost:${s.port}/api/approve`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const decision = await waitForDecision();
    expect(decision).toEqual({ decision: "allow" });
  });

  test("POST /api/submit resolves with deny + feedback", async () => {
    const { server: s, waitForDecision } = setup();
    const submitState: ReviewState = {
      iteration: 1,
      threads: [
        {
          id: "t1",
          file: "foo.ts",
          line: 5,
          side: "new",
          type: "fix",
          messages: [
            { author: "user", text: "change var name", timestamp: 1000 },
          ],
          resolved: false,
        },
      ],
    };
    const res = await fetch(`http://localhost:${s.port}/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback: "## Review\n- fix: change var name at foo.ts:5",
        state: submitState,
      }),
    });
    expect(res.status).toBe(200);
    const decision = await waitForDecision();
    expect(decision).toEqual({
      decision: "deny",
      feedback: "## Review\n- fix: change var name at foo.ts:5",
      state: {
        ...submitState,
        previousRawDiff: mockDiff.rawUnifiedDiff,
      },
    });
  });

  test("unknown route returns 404", async () => {
    const { server: s } = setup();
    const res = await fetch(`http://localhost:${s.port}/nonexistent`);
    expect(res.status).toBe(404);
  });
});
