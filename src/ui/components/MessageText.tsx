import type { VNode } from "preact";

/**
 * Render inline markdown: `code`, **bold**, _italic_, ~~strike~~
 */
function renderInline(text: string): VNode[] {
  const parts: VNode[] = [];
  // Match inline patterns: `code`, **bold**, _italic_, ~~strike~~
  const regex = /(`([^`]+?)`|\*\*(.+?)\*\*|_(.+?)_|~~(.+?)~~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    if (match[2]) {
      // Inline code: `code`
      parts.push(<code key={key++} class="inline-code">{match[2]}</code>);
    } else if (match[3]) {
      // Bold: **text**
      parts.push(<strong key={key++}>{match[3]}</strong>);
    } else if (match[4]) {
      // Italic: _text_
      parts.push(<em key={key++}>{match[4]}</em>);
    } else if (match[5]) {
      // Strikethrough: ~~text~~
      parts.push(<s key={key++}>{match[5]}</s>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  if (parts.length === 0) {
    return [<span key={0}>{text}</span>];
  }

  return parts;
}

/**
 * Render message text with fenced code blocks and inline markdown.
 */
export function MessageText({ text }: { text: string }): VNode {
  const parts: VNode[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      parts.push(
        <span style={{ whiteSpace: "pre-wrap" }}>{renderInline(before)}</span>
      );
    }

    const code = match[2]!;
    parts.push(
      <pre class="code-block">
        <code>{code}</code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    parts.push(
      <span style={{ whiteSpace: "pre-wrap" }}>{renderInline(rest)}</span>
    );
  }

  if (parts.length === 0) {
    return (
      <span style={{ whiteSpace: "pre-wrap" }}>{renderInline(text)}</span>
    );
  }

  return <>{parts}</>;
}
