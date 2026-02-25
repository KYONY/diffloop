import "./setup-dom";
import { describe, test, expect, beforeEach } from "bun:test";
import { render, h } from "preact";
import { MessageText } from "../src/ui/components/MessageText.tsx";
import { CommentThread } from "../src/ui/components/CommentThread.tsx";
import type { Thread } from "../src/shared/types.ts";

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

// --- MessageText ---

describe("MessageText", () => {
  test("renders plain text", () => {
    render(<MessageText text="hello world" />, container);
    expect(container.textContent).toBe("hello world");
  });

  test("renders inline code", () => {
    render(<MessageText text="use `useState` hook" />, container);
    const code = container.querySelector("code.inline-code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe("useState");
  });

  test("renders bold text", () => {
    render(<MessageText text="this is **important**" />, container);
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("important");
  });

  test("renders italic text", () => {
    render(<MessageText text="this is _emphasized_" />, container);
    const em = container.querySelector("em");
    expect(em).not.toBeNull();
    expect(em!.textContent).toBe("emphasized");
  });

  test("renders strikethrough", () => {
    render(<MessageText text="this is ~~removed~~" />, container);
    const s = container.querySelector("s");
    expect(s).not.toBeNull();
    expect(s!.textContent).toBe("removed");
  });

  test("renders fenced code block", () => {
    render(
      <MessageText text={"```ts\nconst x = 1;\n```"} />,
      container,
    );
    const pre = container.querySelector("pre.code-block");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBe("const x = 1;\n");
  });

  test("renders mixed inline and code block", () => {
    render(
      <MessageText
        text={"Use **bold** here\n```\ncode\n```\nand `inline` after"}
      />,
      container,
    );
    expect(container.querySelector("strong")).not.toBeNull();
    expect(container.querySelector("pre.code-block")).not.toBeNull();
    expect(container.querySelector("code.inline-code")).not.toBeNull();
  });

  test("renders multiple inline formats", () => {
    render(
      <MessageText text="`code` and **bold** and _italic_" />,
      container,
    );
    expect(container.querySelector("code.inline-code")!.textContent).toBe(
      "code",
    );
    expect(container.querySelector("strong")!.textContent).toBe("bold");
    expect(container.querySelector("em")!.textContent).toBe("italic");
  });
});

// --- CommentThread ---

const baseThread: Thread = {
  id: "t1",
  file: "src/app.ts",
  line: 42,
  side: "new",
  type: "fix",
  messages: [{ author: "user", text: "rename this variable", timestamp: 1000 }],
  resolved: false,
};

describe("CommentThread", () => {
  test("renders thread type label", () => {
    render(
      <CommentThread
        thread={baseThread}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const typeEl = container.querySelector(".thread-type");
    expect(typeEl!.textContent).toBe("Fix");
    expect(typeEl!.className).toContain("type-fix");
  });

  test("renders question type", () => {
    render(
      <CommentThread
        thread={{ ...baseThread, type: "question" }}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const typeEl = container.querySelector(".thread-type");
    expect(typeEl!.textContent).toBe("Question");
    expect(typeEl!.className).toContain("type-question");
  });

  test("renders file location", () => {
    render(
      <CommentThread
        thread={baseThread}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const loc = container.querySelector(".thread-location");
    expect(loc!.textContent).toBe("src/app.ts:42");
  });

  test("renders multi-line location with ranges", () => {
    render(
      <CommentThread
        thread={{ ...baseThread, lines: [42, 43, 44, 46] }}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const loc = container.querySelector(".thread-location");
    expect(loc!.textContent).toBe("src/app.ts:42-44, 46");
  });

  test("renders non-contiguous lines", () => {
    render(
      <CommentThread
        thread={{ ...baseThread, lines: [5, 8, 12] }}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const loc = container.querySelector(".thread-location");
    expect(loc!.textContent).toBe("src/app.ts:5, 8, 12");
  });

  test("renders endLine range", () => {
    render(
      <CommentThread
        thread={{ ...baseThread, endLine: 45 }}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const loc = container.querySelector(".thread-location");
    expect(loc!.textContent).toBe("src/app.ts:42-45");
  });

  test("renders user message", () => {
    render(
      <CommentThread
        thread={baseThread}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const msgs = container.querySelectorAll(".message");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.className).toContain("message-user");
    expect(msgs[0]!.querySelector(".message-author")!.textContent).toBe("You");
  });

  test("renders agent message", () => {
    const thread: Thread = {
      ...baseThread,
      messages: [
        ...baseThread.messages,
        { author: "model", text: "Done, renamed.", timestamp: 2000 },
      ],
    };
    render(
      <CommentThread
        thread={thread}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const msgs = container.querySelectorAll(".message");
    expect(msgs).toHaveLength(2);
    expect(msgs[1]!.className).toContain("message-model");
    expect(msgs[1]!.querySelector(".message-author")!.textContent).toBe(
      "Agent",
    );
  });

  test("shows Resolve button for open thread", () => {
    render(
      <CommentThread
        thread={baseThread}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const btn = container.querySelector(".thread-resolve-btn");
    expect(btn!.textContent).toBe("Resolve");
  });

  test("shows Reopen button for resolved thread", () => {
    render(
      <CommentThread
        thread={{ ...baseThread, resolved: true }}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const btn = container.querySelector(".thread-resolve-btn");
    expect(btn!.textContent).toBe("Reopen");
  });

  test("resolved thread has resolved class", () => {
    render(
      <CommentThread
        thread={{ ...baseThread, resolved: true }}
        onResolve={() => {}}
        onUnresolve={() => {}}
      />,
      container,
    );
    const threadEl = container.querySelector(".thread");
    expect(threadEl!.className).toContain("thread-resolved");
  });
});
