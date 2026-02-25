import type { RefObject } from "preact";

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement>;
  text: string;
  setText: (text: string) => void;
}

function insert(
  ta: HTMLTextAreaElement | null,
  text: string,
  setText: (t: string) => void,
  before: string,
  after: string,
  placeholder?: string
) {
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = text.slice(start, end);
  const prefix = text.slice(0, start);
  const suffix = text.slice(end);

  if (selected) {
    setText(`${prefix}${before}${selected}${after}${suffix}`);
    setTimeout(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = end + before.length;
      ta.focus();
    }, 0);
  } else {
    const fill = placeholder ?? "";
    setText(`${prefix}${before}${fill}${after}${suffix}`);
    setTimeout(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + fill.length;
      ta.focus();
    }, 0);
  }
}

function insertLine(
  ta: HTMLTextAreaElement | null,
  text: string,
  setText: (t: string) => void,
  prefix: string
) {
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  if (selected) {
    const lines = selected.split("\n").map((l) => `${prefix}${l}`).join("\n");
    setText(`${before}${lines}${after}`);
  } else {
    const nl = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    setText(`${before}${nl}${prefix}${after}`);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = before.length + nl.length + prefix.length;
      ta.focus();
    }, 0);
  }
}

export function MarkdownToolbar({ textareaRef, text, setText }: Props) {
  const ta = textareaRef.current;

  return (
    <div class="md-toolbar">
      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insert(ta, text, setText, "**", "**", "bold")}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insert(ta, text, setText, "_", "_", "italic")}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insert(ta, text, setText, "~~", "~~", "text")}
        title="Strikethrough"
      >
        <s>S</s>
      </button>

      <span class="md-toolbar-sep" />

      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insert(ta, text, setText, "`", "`", "code")}
        title="Inline code"
      >
        {"<>"}
      </button>
      <button
        type="button"
        class="md-tool-btn"
        onClick={() => {
          if (!ta) return;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const selected = text.slice(start, end);
          const before = text.slice(0, start);
          const after = text.slice(end);
          if (selected) {
            setText(`${before}\`\`\`\n${selected}\n\`\`\`${after}`);
          } else {
            setText(`${before}\`\`\`\n\n\`\`\`${after}`);
            setTimeout(() => {
              ta.selectionStart = ta.selectionEnd = start + 4;
              ta.focus();
            }, 0);
          }
        }}
        title="Code block"
      >
        {"</>"}
      </button>
      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insert(ta, text, setText, "[", "](url)", "text")}
        title="Link (Ctrl+K)"
      >
        {"🔗"}
      </button>

      <span class="md-toolbar-sep" />

      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insertLine(ta, text, setText, "> ")}
        title="Quote"
      >
        {'"'}
      </button>
      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insertLine(ta, text, setText, "- ")}
        title="Bullet list"
      >
        {"•"}
      </button>
      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insertLine(ta, text, setText, "1. ")}
        title="Numbered list"
      >
        {"1."}
      </button>
      <button
        type="button"
        class="md-tool-btn"
        onClick={() => insertLine(ta, text, setText, "- [ ] ")}
        title="Task list"
      >
        {"☐"}
      </button>
    </div>
  );
}
