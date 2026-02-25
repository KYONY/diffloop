import type { RefObject, VNode } from "preact";

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

// SVG icons (16x16, stroke-based, matching GitHub/GitLab editor style)
const s = { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" };

function IconBold(): VNode {
  return <svg {...s}><path d="M4 2.5h4.5a2.5 2.5 0 010 5H4V2.5z"/><path d="M4 7.5h5.5a2.5 2.5 0 010 5H4V7.5z"/></svg>;
}
function IconItalic(): VNode {
  return <svg {...s}><line x1="10" y1="2.5" x2="6" y2="13.5"/><line x1="6" y1="2.5" x2="12" y2="2.5"/><line x1="4" y1="13.5" x2="10" y2="13.5"/></svg>;
}
function IconStrike(): VNode {
  return <svg {...s}><line x1="2" y1="8" x2="14" y2="8"/><path d="M10.5 3.5H7a2.5 2.5 0 000 5h2a2.5 2.5 0 010 5H5.5"/></svg>;
}
function IconCode(): VNode {
  return <svg {...s}><polyline points="5.5 4 2 8 5.5 12"/><polyline points="10.5 4 14 8 10.5 12"/></svg>;
}
function IconCodeBlock(): VNode {
  return <svg {...s}><rect x="2" y="2" width="12" height="12" rx="2"/><polyline points="6 6 4.5 8 6 10"/><polyline points="10 6 11.5 8 10 10"/></svg>;
}
function IconLink(): VNode {
  return <svg {...s}><path d="M7 9l2-2"/><path d="M5.5 7.5L4 9a2.83 2.83 0 004 4l1.5-1.5"/><path d="M10.5 8.5L12 7a2.83 2.83 0 00-4-4L6.5 4.5"/></svg>;
}
function IconQuote(): VNode {
  return <svg {...s}><path d="M3 5h4v3.5a2.5 2.5 0 01-2.5 2.5H3"/><path d="M9 5h4v3.5a2.5 2.5 0 01-2.5 2.5H9"/></svg>;
}
function IconBulletList(): VNode {
  return <svg {...s}><circle cx="3" cy="4" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><line x1="6.5" y1="4" x2="14" y2="4"/><line x1="6.5" y1="8" x2="14" y2="8"/><line x1="6.5" y1="12" x2="14" y2="12"/></svg>;
}
function IconNumberList(): VNode {
  return <svg {...s} fill="currentColor" stroke="none"><text x="1" y="5.5" font-size="5" font-family="monospace">1</text><text x="1" y="9.5" font-size="5" font-family="monospace">2</text><text x="1" y="13.5" font-size="5" font-family="monospace">3</text><rect x="6.5" y="3" width="7.5" height="1.2" rx="0.5"/><rect x="6.5" y="7" width="7.5" height="1.2" rx="0.5"/><rect x="6.5" y="11" width="7.5" height="1.2" rx="0.5"/></svg>;
}
function IconTaskList(): VNode {
  return <svg {...s}><rect x="2" y="2" width="4.5" height="4.5" rx="1"/><polyline points="3 4.5 4 5.5 6 3" stroke-width="1.2"/><rect x="2" y="9.5" width="4.5" height="4.5" rx="1"/><line x1="9" y1="4.25" x2="14" y2="4.25"/><line x1="9" y1="11.75" x2="14" y2="11.75"/></svg>;
}

export function MarkdownToolbar({ textareaRef, text, setText }: Props) {
  const ta = textareaRef.current;

  return (
    <div class="md-toolbar">
      <button type="button" class="md-tool-btn" onClick={() => insert(ta, text, setText, "**", "**", "bold")} title="Bold (Ctrl+B)">
        <IconBold />
      </button>
      <button type="button" class="md-tool-btn" onClick={() => insert(ta, text, setText, "_", "_", "italic")} title="Italic (Ctrl+I)">
        <IconItalic />
      </button>
      <button type="button" class="md-tool-btn" onClick={() => insert(ta, text, setText, "~~", "~~", "text")} title="Strikethrough">
        <IconStrike />
      </button>

      <span class="md-toolbar-sep" />

      <button type="button" class="md-tool-btn" onClick={() => insert(ta, text, setText, "`", "`", "code")} title="Inline code">
        <IconCode />
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
        <IconCodeBlock />
      </button>
      <button type="button" class="md-tool-btn" onClick={() => insert(ta, text, setText, "[", "](url)", "text")} title="Link (Ctrl+K)">
        <IconLink />
      </button>

      <span class="md-toolbar-sep" />

      <button type="button" class="md-tool-btn" onClick={() => insertLine(ta, text, setText, "> ")} title="Quote">
        <IconQuote />
      </button>
      <button type="button" class="md-tool-btn" onClick={() => insertLine(ta, text, setText, "- ")} title="Bullet list">
        <IconBulletList />
      </button>
      <button type="button" class="md-tool-btn" onClick={() => insertLine(ta, text, setText, "1. ")} title="Numbered list">
        <IconNumberList />
      </button>
      <button type="button" class="md-tool-btn" onClick={() => insertLine(ta, text, setText, "- [ ] ")} title="Task list">
        <IconTaskList />
      </button>
    </div>
  );
}
