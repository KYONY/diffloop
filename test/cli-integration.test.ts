import { describe, test, expect } from "bun:test";

/**
 * Reads stderr chunks in the background, resolves port as soon as found.
 * getText() returns all collected stderr after process exits.
 */
function collectStderr(stderr: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let text = "";
  let portResolve: (port: number) => void;
  const portPromise = new Promise<number>((r) => {
    portResolve = r;
  });

  const reader = stderr.getReader();
  const done = (async () => {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      text += decoder.decode(result.value, { stream: true });
      const match = text.match(/localhost:(\d+)/);
      if (match) portResolve(parseInt(match[1]!, 10));
    }
  })();

  return {
    waitForPort: () => portPromise,
    getText: async () => {
      await done;
      return text;
    },
  };
}

describe("CLI integration", () => {
  test("approve flow: stdin → server → stdout {decision: allow}", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts"], {
      env: { ...process.env, DIFFLOOP_NO_BROWSER: "1" },
      stdin: new Blob(["{}"]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = collectStderr(proc.stderr);
    const port = await stderr.waitForPort();

    const res = await fetch(`http://localhost:${port}/api/approve`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const stdout = await new Response(proc.stdout).text();
    expect(JSON.parse(stdout)).toEqual({ decision: "allow" });

    await proc.exited;
    expect(proc.exitCode).toBe(0);
  }, 15000);

  test("submit flow: stdin → server → stdout {decision: deny}", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts"], {
      env: { ...process.env, DIFFLOOP_NO_BROWSER: "1" },
      stdin: new Blob(["{}"]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = collectStderr(proc.stderr);
    const port = await stderr.waitForPort();

    const submitBody = {
      feedback: "## Review\n- fix variable name",
      state: {
        iteration: 1,
        threads: [
          {
            id: "t1",
            file: "test.ts",
            line: 1,
            side: "new",
            type: "fix",
            messages: [
              { author: "user", text: "fix this", timestamp: Date.now() },
            ],
            resolved: false,
          },
        ],
      },
    };

    const res = await fetch(`http://localhost:${port}/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submitBody),
    });
    expect(res.status).toBe(200);

    const stdout = await new Response(proc.stdout).text();
    const decision = JSON.parse(stdout);
    expect(decision.decision).toBe("deny");
    expect(decision.feedback).toBe("## Review\n- fix variable name");
    expect(decision.state.threads).toHaveLength(1);

    await proc.exited;
    expect(proc.exitCode).toBe(0);
  }, 15000);

  test("stderr shows version, iteration, file count", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts"], {
      env: { ...process.env, DIFFLOOP_NO_BROWSER: "1" },
      stdin: new Blob(["{}"]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = collectStderr(proc.stderr);
    const port = await stderr.waitForPort();

    // Approve to let process exit so stderr completes
    await fetch(`http://localhost:${port}/api/approve`, { method: "POST" });
    await proc.exited;

    const text = await stderr.getText();
    expect(text).toContain("DiffLoop");
    expect(text).toContain("Iteration: 1");
    expect(text).toContain("changed");
  }, 15000);

  test("save flow: stdin → server → stdout {decision: save}", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts"], {
      env: { ...process.env, DIFFLOOP_NO_BROWSER: "1" },
      stdin: new Blob(["{}"]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = collectStderr(proc.stderr);
    const port = await stderr.waitForPort();

    const saveBody = {
      state: {
        iteration: 1,
        threads: [
          {
            id: "t1",
            file: "test.ts",
            line: 1,
            side: "new",
            type: "fix",
            messages: [
              { author: "user", text: "fix this", timestamp: Date.now() },
            ],
            resolved: false,
          },
        ],
      },
    };

    const res = await fetch(`http://localhost:${port}/api/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saveBody),
    });
    expect(res.status).toBe(200);

    const stdout = await new Response(proc.stdout).text();
    const decision = JSON.parse(stdout);
    expect(decision.decision).toBe("save");
    expect(decision.state.threads).toHaveLength(1);
    expect(decision.state.iteration).toBe(0);

    await proc.exited;
    expect(proc.exitCode).toBe(0);
  }, 15000);

  test("iteration 2 preserves threads from stdin", async () => {
    const input = {
      state: {
        iteration: 1,
        threads: [
          {
            id: "t1",
            file: "foo.ts",
            line: 5,
            side: "new",
            type: "question",
            messages: [
              { author: "user", text: "why async?", timestamp: 1000 },
            ],
            resolved: false,
          },
        ],
      },
      modelResponses: [
        { threadId: "t1", text: "Because it calls an external API" },
      ],
    };

    const proc = Bun.spawn(["bun", "src/cli.ts"], {
      env: { ...process.env, DIFFLOOP_NO_BROWSER: "1" },
      stdin: new Blob([JSON.stringify(input)]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = collectStderr(proc.stderr);
    const port = await stderr.waitForPort();

    // Check that state endpoint returns iteration 2 with model response
    const stateRes = await fetch(`http://localhost:${port}/api/state`);
    const state = await stateRes.json();
    expect(state.iteration).toBe(2);
    expect(state.threads).toHaveLength(1);
    expect(state.threads[0].messages).toHaveLength(2);
    expect(state.threads[0].messages[1].author).toBe("model");
    expect(state.threads[0].messages[1].text).toBe(
      "Because it calls an external API",
    );

    // Clean up
    await fetch(`http://localhost:${port}/api/approve`, { method: "POST" });
    await proc.exited;
  }, 15000);
});
