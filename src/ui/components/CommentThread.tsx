import type { Thread } from "../../shared/types.ts";

interface Props {
  thread: Thread;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
}

function formatThreadLines(thread: Thread): string {
  if (thread.lines && thread.lines.length > 0) {
    const sorted = [...thread.lines].sort((a, b) => a - b);
    const groups: string[] = [];
    let start = sorted[0]!;
    let end = start;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i]!;
      } else {
        groups.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i]!;
        end = start;
      }
    }
    groups.push(start === end ? `${start}` : `${start}-${end}`);
    return groups.join(", ");
  }
  if (thread.endLine) return `${thread.line}-${thread.endLine}`;
  return `${thread.line}`;
}

export function CommentThread({ thread, onResolve, onUnresolve }: Props) {
  const typeLabel = thread.type === "fix" ? "Fix" : "Question";
  const typeClass = thread.type === "fix" ? "type-fix" : "type-question";

  return (
    <div class={`thread ${thread.resolved ? "thread-resolved" : ""}`}>
      <div class="thread-header">
        <span class={`thread-type ${typeClass}`}>{typeLabel}</span>
        <span class="thread-location">
          {thread.file}:{formatThreadLines(thread)}
        </span>
        {thread.resolved ? (
          <button
            class="thread-resolve-btn"
            onClick={() => onUnresolve(thread.id)}
          >
            Reopen
          </button>
        ) : (
          <button
            class="thread-resolve-btn"
            onClick={() => onResolve(thread.id)}
          >
            Resolve
          </button>
        )}
      </div>
      <div class="thread-messages">
        {thread.messages.map((msg, i) => (
          <div
            key={i}
            class={`message ${msg.author === "model" ? "message-model" : "message-user"}`}
          >
            <span class="message-author">
              {msg.author === "model" ? "Agent" : "You"}
            </span>
            <div class="message-text">{msg.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
