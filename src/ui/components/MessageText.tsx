import type { VNode } from "preact";

/**
 * Render message text with fenced code block support.
 * Splits on ```[lang]\n...\n``` and renders code blocks as <pre><code>.
 */
export function MessageText({ text }: { text: string }): VNode {
  const parts: VNode[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      parts.push(<span style={{ whiteSpace: "pre-wrap" }}>{before}</span>);
    }

    // Code block
    const code = match[2]!;
    parts.push(
      <pre class="code-block">
        <code>{code}</code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    parts.push(<span style={{ whiteSpace: "pre-wrap" }}>{rest}</span>);
  }

  if (parts.length === 0) {
    return <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>;
  }

  return <>{parts}</>;
}
